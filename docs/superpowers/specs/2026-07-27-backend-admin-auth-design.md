# GeoVibes Backend, Admin Panel, Onboarding, and Authentication Design

**Date:** 2026-07-27  
**Status:** Approved design  
**Scope:** Local-first backend and internal admin panel, plus public mobile onboarding and optional user authentication

## 1. Purpose

GeoVibes currently runs as an Expo mobile app backed by localized mock data and local AsyncStorage state. This project introduces a separate `backend/` application that owns the catalog, authentication, user profiles, and administrative workflows.

The result must let trusted staff manage places, categories, and users from a web admin panel while the Expo app remains a public-facing consumer. The mobile app must not contain catalog-editing controls or catalog mutation endpoints.

The first implementation is local-first. It must remain configurable for a later production domain and hosted PostgreSQL/media storage without changing the core data model or public API contract.

## 2. Product Decisions

- Mobile accounts are optional. Guests can complete onboarding, browse all published content, and save places locally.
- Version-one authentication uses an editable public username and password.
- Authentication identities use permanent internal user IDs so password credentials can later coexist with or be replaced by phone OTP or passkeys.
- Account recovery is not included in version one. The signup screen must state this clearly.
- The admin panel is for trusted staff only.
- A venue-owner portal, place claiming, and venue-scoped permissions are separate future work.
- Places and categories use `draft`, `published`, and `archived` lifecycle states.
- Content may be published with only one language. Russian, Kazakh, and English are recommended but not mandatory.
- The product never automatically translates public content. Missing requested translations fall back to an existing human-authored translation unchanged.
- External navigation uses 2GIS in version one.
- Latitude and longitude remain the canonical location data to preserve a future path to OpenStreetMap, MapLibre, Leaflet, spatial search, routing, and location analysis.

## 3. Architecture

### 3.1 Repository boundary

The existing Expo project remains at the repository root. A new `backend/` directory contains an independently runnable full-stack Next.js application:

```text
geovibes-kz/
├── app/                     # Existing Expo Router app
├── components/              # Existing mobile components
├── lib/                     # Existing mobile libraries
└── backend/
    ├── app/                 # Next.js App Router pages and route handlers
    ├── components/          # Admin-only web components
    ├── db/                  # Drizzle schema, migrations, and seeds
    ├── lib/                 # Auth, services, validation, and storage
    ├── public/              # Static admin assets
    ├── storage/             # Git-ignored local media mount
    ├── tests/
    ├── Dockerfile
    ├── compose.yaml
    └── package.json
```

The two applications have separate package manifests, environment files, build processes, and runtime configuration. The mobile app communicates with the backend only through the versioned HTTP API.

### 3.2 Technology

- Next.js App Router with TypeScript
- PostgreSQL
- Drizzle ORM and committed SQL migrations
- Zod-compatible request and form validation
- Argon2id password hashing
- Opaque, revocable database sessions
- Docker Compose for local PostgreSQL and backend startup
- Playwright for critical admin and integration flows

### 3.3 Server boundaries

The Next.js application contains three explicit boundaries:

1. The admin web interface under `/admin`.
2. Versioned public/mobile endpoints under `/api/v1`.
3. Internal admin endpoints under `/api/admin`.

Route handlers remain thin. Domain services own business rules, database transactions, authorization decisions, translation selection, and publication behavior. Admin Server Components may call domain services directly rather than making unnecessary loopback HTTP requests.

The mobile API is public for published catalog reads and authenticated for user-owned data. It does not expose catalog mutation operations to ordinary users.

## 4. Authentication and Authorization

### 4.1 User identity

Every user has:

- A permanent opaque ID
- A unique normalized username used for sign-in
- An editable display username shown publicly
- A role: `user`, `editor`, or `admin`
- A status: `active` or `suspended`
- Preferred language
- Onboarding completion state and timestamps

Changing a username does not change the user ID or disconnect saved places, sessions, interests, or future authentication credentials.

### 4.2 Credentials

Password credentials are stored separately from the user profile. Passwords are hashed with Argon2id and are never logged, returned, displayed to staff, or manually edited through the admin panel.

The credential boundary must allow future credential types, including:

- Verified phone number plus SMS, WhatsApp, or Telegram OTP
- Passkeys associated with a stable production relying-party domain

Adding a future credential must not require replacing user IDs or migrating user-owned records.

### 4.3 Sessions

Sessions use cryptographically random opaque tokens. Only a one-way digest of each token is stored in PostgreSQL.

- The web admin uses secure, HTTP-only, same-site cookies.
- Expo stores its session credential in SecureStore.
- Sessions are revocable individually and expire after a configured duration.
- Signing out revokes the active session and clears private client caches.
- Suspending a user revokes all active sessions.
- Authentication endpoints use rate limits and generic failure messages to reduce username enumeration and credential attacks.

### 4.4 Staff authorization

Public signup always creates a `user`. It can never accept or infer a staff role.

- `editor` can manage places, categories, translations, and media.
- `admin` can perform all editor actions, manage user status, change staff roles, and inspect the audit log.
- The first admin is created through an explicit local bootstrap command.
- Every protected server action, domain operation, and route handler performs authorization. Hiding a navigation item is not an authorization mechanism.

## 5. Data Model

### 5.1 Catalog

#### Places

A place contains:

- Permanent ID and unique slug
- Lifecycle status: `draft`, `published`, or `archived`
- Human-authored translations
- One or more category assignments
- Address, district, latitude, and longitude
- Optional 2GIS URL
- Optional phone, website, and Instagram URL
- Optional price level
- Structured opening hours
- Editorial tags
- Optional featured rank
- Ordered media records with one cover image
- Created, updated, published, and archived timestamps
- Staff attribution for meaningful lifecycle changes

#### Place translations

Each translation belongs to one place and one supported locale (`ru`, `kk`, or `en`) and contains localized descriptive fields. Place names may use the same text in multiple locales but are still stored explicitly when translations exist.

A place may be published with one or more translations. Empty translations are absent records, not copied or machine-generated text.

#### Categories

A category contains:

- Permanent ID and unique slug
- Lifecycle status
- Display order
- Cover media
- Human-authored name and tagline translations
- Created and updated timestamps

A category may be published with one or more translations and a cover image. An archived category cannot be newly assigned to a place. Archiving a category does not silently archive its places.

#### Category assignments

Places and categories have a many-to-many relationship with deterministic ordering. This supports venues that reasonably belong to more than one discovery category.

#### Media

Media records contain:

- Permanent ID
- Storage key
- MIME type
- Width, height, and byte size
- Alternative text when supplied
- Sort order
- Cover-image designation
- Upload and deletion timestamps

Binary files are not stored in PostgreSQL.

### 5.2 User-owned data

- Interests link a user to selected categories.
- Saved places link a user to places with a unique constraint preventing duplicates.
- Guest interests and saves remain in local mobile storage.
- Creating an account or signing in merges guest and server saves using set union, preserving both.
- Interests use the latest explicit user choice after the merge.

### 5.3 Audit events

Audit records capture actor, action, target type, target ID, timestamp, and a bounded metadata summary. Required events include:

- Place/category publication and archival
- User suspension and reactivation
- Staff role changes
- Relevant media deletion

Audit logs must not include passwords, session tokens, credential material, or unnecessary personal data.

## 6. Translation Behavior

Russian, Kazakh, and English are supported, recommended languages. They are not all required for publication.

The admin editor shows:

- A tab per supported language
- Completion indicators
- A summary of missing languages
- A publication warning when one or more recommended translations are absent

The warning is confirmable and does not block publication. Its meaning is: publishing fewer languages may exclude some visitors.

The mobile client sends its preferred locale. Translation resolution is deterministic:

1. Return the requested human-authored locale when available.
2. Otherwise return one available human-authored locale unchanged.
3. Include the returned `contentLanguage` in the API response.

No public request triggers automatic translation. A future admin-side translation assistant may generate drafts, but generated content must be reviewed and explicitly published by staff.

## 7. Admin Panel

### 7.1 Login

`/admin/login` is visually separate from mobile onboarding. Successful authentication still requires an active `editor` or `admin` role. Authenticated ordinary users receive no admin access.

### 7.2 Dashboard

The dashboard shows actionable counts:

- Total and published places
- Draft and archived places
- Categories
- Registered users
- Content with missing recommended translations

### 7.3 Places

The places index supports:

- Search
- Status, category, and translation-completeness filters
- Stable pagination and sorting
- Create, edit, preview, publish, and archive actions

The editor separates core details, translations, location, opening hours, categories/tags, and media. It warns before leaving with unsaved changes. Publication shows validation errors inline and asks for confirmation when translations are missing.

Preview uses the current draft without making it publicly visible. Editing an already-published place does not expose invalid partial data: a failed save or publication leaves the last successfully stored/published state intact.

### 7.4 Categories

Staff can create, edit, reorder, publish, and archive categories. The interface shows place usage before archival and prevents assignment of archived categories.

### 7.5 Users

Admins can:

- Search and inspect users
- View role, status, public profile information, and account timestamps
- Suspend or reactivate an account
- Promote or demote staff roles with confirmation

Admins cannot view passwords or session tokens. Destructive role/status changes create audit events.

### 7.6 Strict editing boundary

Catalog editing exists only in the admin panel and protected admin server interfaces. The Expo app contains no place/category editors, staff controls, or hidden catalog mutation affordances.

Ordinary mobile users may only change their own:

- Display username
- Password through an authenticated change-password operation
- Preferred language
- Interests
- Saved places

These are profile operations, not catalog editing.

## 8. Mobile Onboarding and Authentication UX

### 8.1 First-launch flow

The onboarding flow is:

1. **Welcome:** GeoVibes identity and concise product value.
2. **Language:** Russian, Kazakh, or English.
3. **Interests:** Optional category selection used to order initial discovery content.
4. **Your GeoVibes:** Create account, sign in, or continue as guest.

Interests and authentication are skippable. The user can edit language and interests later.

### 8.2 Signup and sign-in

Signup requests:

- Public username
- Password
- Password confirmation

The UI includes username availability feedback, show/hide password controls, clear password requirements, inline validation, disabled duplicate submissions, progress states, and accessible error messages.

Before signup completes, the interface explains that account recovery is not yet available. Authentication failure messages do not reveal whether a username exists.

### 8.3 Guest behavior and merge

Guests receive the complete published catalog experience. Saves and interests persist locally.

When a guest creates an account or signs in:

- Local and server saved-place IDs are unioned.
- The explicit interests selected during the current onboarding/profile action become the account interests.
- A failed merge retains local data and can be retried.
- Successful synchronization does not delete local data until the server result is confirmed.

Signing out returns the app to guest mode without blocking catalog access.

## 9. API Contract

The first public API version is rooted at `/api/v1`.

### 9.1 Public catalog

The API provides paginated endpoints for:

- Categories
- Places
- Place detail by stable ID or slug
- Category-filtered and text-search results

Only published places and categories are returned. Archived or draft records cannot be retrieved through public identifiers.

Responses use stable JSON envelopes, include `contentLanguage`, and provide pagination metadata where applicable.

### 9.2 Authentication

The API provides operations for:

- Signup
- Sign-in
- Sign-out
- Current session/user
- Change password while authenticated

Account recovery is intentionally absent in this phase.

### 9.3 User profile

Authenticated users can:

- Read and update their public username
- Read and update preferred language and interests
- List, add, and remove saved places

Mutations are idempotent where practical. Saving an already-saved place succeeds without creating a duplicate.

### 9.4 Admin API

Admin mutations live under `/api/admin`, not `/api/v1`. Every endpoint enforces role requirements and validates payload type, size, and content. Stable error codes distinguish validation, authentication, authorization, conflict, rate-limit, and internal failures without exposing server internals.

## 10. Maps and Location

Each place stores vendor-neutral coordinates as the source of truth.

Version one may store an optional validated 2GIS URL and exposes it for external directions. The core place schema does not require a 2GIS object ID.

Future embedded maps and analysis can use the existing coordinates with OpenStreetMap-compatible tooling such as MapLibre or Leaflet. Routing, spatial search, travel-time analysis, and location analytics are outside this implementation.

## 11. Media Storage

Media uses an application-owned storage interface.

### Local

- Uploads are stored in a dedicated Docker/local volume.
- The volume is excluded from Git.
- Seed media can reference committed fixture assets or copied development fixtures.

### Future production

The interface can be replaced with S3/R2-compatible object storage. Database records and admin editor behavior remain unchanged.

Upload validation covers allowed MIME types, maximum size, image dimensions, generated safe storage keys, and server-side metadata extraction. Files are never addressed using untrusted user-provided paths.

## 12. Error Handling and Reliability

- Every external payload is validated at the boundary.
- Multi-record writes use PostgreSQL transactions.
- Publication failures preserve the preceding stored and public state.
- Admin validation is displayed next to the relevant field.
- Archive, suspension, and staff-role mutations require confirmation.
- Expired admin sessions redirect to login without leaking the attempted resource.
- Mobile catalog requests use a bounded local cache for temporary offline use.
- Personal mobile mutations retry safely and do not duplicate saves.
- API logs use request IDs and omit secrets and credential data.
- Client-facing internal errors use a generic message and stable code.

## 13. Testing

### 13.1 Unit tests

- Username normalization and validation
- Password/session helpers
- Translation selection
- Publication and lifecycle rules
- Permission policies
- Guest-data merge behavior
- Media validation

### 13.2 Database and service integration tests

- Constraints and cascades
- Lifecycle transitions
- Published-content isolation
- Session expiry and revocation
- Suspension behavior
- Role changes and audit records
- Idempotent saved-place mutations

Tests use a real disposable PostgreSQL database initialized from committed migrations.

### 13.3 API tests

- Public catalog filtering, localization, search, and pagination
- Signup/sign-in/sign-out/current-session behavior
- Generic authentication errors and rate limiting
- User ownership boundaries
- Editor/admin authorization on every mutation class
- Stable validation and conflict responses

### 13.4 End-to-end tests

- Bootstrap an admin and sign into the panel
- Create a one-language category and acknowledge the publication warning
- Create a place, upload/reorder media, preview it, and publish it
- Confirm published content appears in the mobile/public API
- Confirm drafts and archived content remain unavailable publicly
- Complete mobile onboarding as a guest
- Create an account and merge local saves
- Sign out and continue browsing as a guest
- Suspend a user and verify session revocation

### 13.5 Existing mobile verification

The existing Expo typecheck and layout tests remain part of verification. New onboarding/authentication screens receive focused interaction and layout coverage across the supported mobile viewports.

## 14. Local Development and Operations

A fresh checkout must be able to:

1. Copy documented example environment variables.
2. Start PostgreSQL and the backend with Docker Compose.
3. Apply migrations.
4. Seed initial categories/places.
5. Bootstrap the first admin.
6. Start the Expo app against the documented local API URL.

The configuration distinguishes local, test, and future production origins. Development-only wildcard origins or insecure cookies must never be enabled in production configuration.

The existing mock catalog is used only as a seed/migration source during integration. Once the API-backed catalog is active, it is not maintained as a second source of truth.

## 15. Delivery Sequence

Implementation should proceed in dependency order:

1. Create the isolated backend and local PostgreSQL environment.
2. Add schema, migrations, seed data, and domain services.
3. Add authentication, sessions, roles, and admin bootstrap.
4. Add public and admin API contracts.
5. Build the admin shell and catalog/user workflows.
6. Add media upload/storage.
7. Replace mobile mock catalog reads with the public API and cache.
8. Implement onboarding, optional authentication, profile, and guest merge.
9. Add end-to-end verification and operational documentation.

## 16. Completion Criteria

The phase is complete when:

- A fresh checkout starts the local backend and PostgreSQL from documented commands.
- A bootstrapped admin can manage places, categories, translations, media, and users entirely in the web panel.
- One-language content can be published after an explicit missing-language warning.
- The Expo app displays only published content and never automatically translates it.
- The Expo app can finish onboarding and remain fully browsable as a guest.
- A user can create a username/password account, sign in, synchronize saves/interests, sign out, and continue as a guest.
- Draft and archived content cannot leak through the public API.
- Staff authorization is enforced server-side.
- Automated tests cover the critical flows described above.

## 17. Deferred Work

- Production hosting and custom-domain configuration
- SMS, WhatsApp, or Telegram OTP
- Passkeys
- Account recovery
- Venue-owner portal, claims, and venue-scoped permissions
- Automatic translation
- Embedded maps, routing, and location analysis
- Catalog editing from the public app
- Subscriptions, payments, and premium entitlements
- Business analytics and user behavior analytics

