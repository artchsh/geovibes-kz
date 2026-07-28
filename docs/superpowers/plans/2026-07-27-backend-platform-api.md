# GeoVibes Backend Platform and API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the isolated local-first Next.js/PostgreSQL backend, authentication system, versioned public API, media storage, seed data, and automated backend tests.

**Architecture:** A standalone `backend/` Next.js App Router application owns PostgreSQL, domain services, authentication, and HTTP route handlers. Route handlers validate transport data and delegate to focused services; public catalog reads use immutable published revisions while staff-facing mutations operate on draft revisions.

**Tech Stack:** Next.js, TypeScript, PostgreSQL, Drizzle ORM, Zod, `@node-rs/argon2`, Vitest, Docker Compose, Sharp

## Global Constraints

- The existing Expo application remains at the repository root; all backend runtime code lives under `backend/`.
- Mobile accounts are optional; public catalog reads do not require authentication.
- Version-one credentials are normalized public username plus password.
- Passwords use Argon2id and never appear in logs, responses, admin views, fixtures, or audit metadata.
- Public signup always creates role `user`; only an existing `admin` can grant staff roles.
- Catalog lifecycle values are exactly `draft`, `published`, and `archived`.
- Public endpoints return only published revisions.
- Russian, Kazakh, and English are recommended but not all required.
- The API never generates or automatically translates catalog text.
- Translation fallback is requested locale, then primary locale, then fixed order `ru`, `kk`, `en`.
- Coordinates are canonical; a 2GIS URL is optional vendor-specific metadata.
- Binary media is not stored in PostgreSQL.
- Production hosting, passkeys, OTP, account recovery, embedded maps, venue-owner access, and payments are excluded.

---

## Planned File Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── admin/media/route.ts
│   │   ├── auth/[action]/route.ts
│   │   └── v1/
│   │       ├── categories/route.ts
│   │       ├── places/[slug]/route.ts
│   │       ├── places/route.ts
│   │       ├── profile/route.ts
│   │       └── saved-places/route.ts
│   ├── health/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── db/
│   ├── migrations/
│   ├── schema/
│   │   ├── audit.ts
│   │   ├── auth.ts
│   │   ├── catalog.ts
│   │   ├── index.ts
│   │   └── users.ts
│   ├── client.ts
│   ├── migrate.ts
│   └── seed.ts
├── lib/
│   ├── api/
│   │   ├── errors.ts
│   │   ├── request.ts
│   │   └── response.ts
│   ├── auth/
│   │   ├── authorization.ts
│   │   ├── password.ts
│   │   ├── rate-limit.ts
│   │   ├── session.ts
│   │   └── username.ts
│   ├── catalog/
│   │   ├── category-service.ts
│   │   ├── place-service.ts
│   │   ├── publication.ts
│   │   ├── queries.ts
│   │   └── translation.ts
│   ├── media/
│   │   ├── local-storage.ts
│   │   ├── service.ts
│   │   └── storage.ts
│   ├── users/
│   │   ├── auth-service.ts
│   │   ├── profile-service.ts
│   │   └── saved-place-service.ts
│   ├── env.ts
│   └── result.ts
├── scripts/bootstrap-admin.ts
├── storage/.gitkeep
├── tests/
│   ├── api/
│   ├── integration/
│   ├── unit/
│   └── setup/
├── .env.example
├── Dockerfile
├── compose.yaml
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Task 1: Bootstrap the isolated backend and test harness

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/next.config.ts`
- Create: `backend/app/layout.tsx`
- Create: `backend/app/page.tsx`
- Create: `backend/app/health/route.ts`
- Create: `backend/lib/env.ts`
- Create: `backend/.env.example`
- Create: `backend/compose.yaml`
- Create: `backend/Dockerfile`
- Create: `backend/vitest.config.ts`
- Create: `backend/tests/unit/env.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `env` with validated `DATABASE_URL`, `AUTH_SECRET`, `APP_ORIGIN`, `MOBILE_ORIGINS`, `SESSION_TTL_DAYS`, `MEDIA_ROOT`, and `MAX_UPLOAD_BYTES`.
- Produces: `GET /health -> { status: "ok" }`.

- [ ] **Step 1: Write the environment validation test**

```ts
// backend/tests/unit/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("rejects a short auth secret", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/geovibes",
        AUTH_SECRET: "short",
        APP_ORIGIN: "http://localhost:3001",
        MOBILE_ORIGINS: "geovibes://,http://localhost:8081",
        SESSION_TTL_DAYS: "30",
        MEDIA_ROOT: "./storage",
        MAX_UPLOAD_BYTES: "10485760",
      }),
    ).toThrow(/AUTH_SECRET/);
  });
});
```

- [ ] **Step 2: Scaffold the package and run the test to verify failure**

```json
{
  "name": "geovibes-backend",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Run: `cd backend && npm test -- tests/unit/env.test.ts`

Expected: FAIL because `@/lib/env` does not exist.

- [ ] **Step 3: Install the backend dependencies**

Run:

```bash
cd backend
npm install next react react-dom zod drizzle-orm pg @node-rs/argon2 sharp
npm install -D typescript @types/node @types/react @types/react-dom @types/pg drizzle-kit vitest
```

Expected: `backend/package-lock.json` is created and npm reports no installation error.

- [ ] **Step 4: Implement validated environment loading**

```ts
// backend/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url(),
  MOBILE_ORIGINS: z.string().transform((value) =>
    value.split(",").map((origin) => origin.trim()).filter(Boolean),
  ),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  MEDIA_ROOT: z.string().min(1).default("./storage"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).default(10_485_760),
});

export type AppEnv = z.infer<typeof envSchema>;
export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv => envSchema.parse(input);
export const env = parseEnv(process.env);
```

Add `@/* -> ./*` to `tsconfig.json`, create the minimal App Router layout/page, and implement:

```ts
// backend/app/health/route.ts
export function GET() {
  return Response.json({ status: "ok" });
}
```

- [ ] **Step 5: Add local PostgreSQL and container configuration**

Use a named `postgres-data` volume and a bind/named media volume. Expose backend port `3001` and PostgreSQL port `5432`. Add exact example values to `.env.example`; use a 32-plus-character development-only `AUTH_SECRET`.

Add these entries to the root `.gitignore`:

```gitignore
backend/.env
backend/.next/
backend/node_modules/
backend/storage/*
!backend/storage/.gitkeep
```

- [ ] **Step 6: Verify the scaffold**

Run:

```bash
cd backend
npm test -- tests/unit/env.test.ts
npm run typecheck
npm run build
docker compose config
```

Expected: all commands exit `0`; the env test passes and Compose reports valid services.

- [ ] **Step 7: Commit**

```bash
git add .gitignore backend
git commit -m "feat(backend): scaffold Next.js service and local postgres"
```

### Task 2: Add the PostgreSQL schema and migrations

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/db/client.ts`
- Create: `backend/db/schema/auth.ts`
- Create: `backend/db/schema/users.ts`
- Create: `backend/db/schema/catalog.ts`
- Create: `backend/db/schema/audit.ts`
- Create: `backend/db/schema/index.ts`
- Create: `backend/db/migrate.ts`
- Create: `backend/tests/integration/schema.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: exported Drizzle tables `users`, `passwordCredentials`, `sessions`, `userInterests`, `savedPlaces`, `places`, `placeRevisions`, `placeTranslations`, `categories`, `categoryRevisions`, `categoryTranslations`, `placeRevisionCategories`, `media`, `placeRevisionMedia`, and `auditEvents`.
- Produces: enums `userRole`, `userStatus`, `contentStatus`, and `supportedLocale`.
- Produces: `db` PostgreSQL Drizzle client.

- [ ] **Step 1: Write the schema constraint integration test**

```ts
// backend/tests/integration/schema.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { resetTestDatabase } from "@/tests/setup/database";

describe("user schema", () => {
  beforeAll(resetTestDatabase);
  afterAll(() => db.$client.end());

  it("enforces normalized username uniqueness", async () => {
    await db.insert(users).values({
      normalizedUsername: "almaty",
      displayUsername: "Almaty",
    });

    await expect(
      db.insert(users).values({
        normalizedUsername: "almaty",
        displayUsername: "ALMATY",
      }),
    ).rejects.toThrow();

    expect(await db.query.users.findFirst({
      where: eq(users.normalizedUsername, "almaty"),
    })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the integration test to verify failure**

Run: `cd backend && npm test -- tests/integration/schema.test.ts`

Expected: FAIL because schema/client modules do not exist.

- [ ] **Step 3: Define enums and auth/user tables**

Use UUID primary keys generated by PostgreSQL. Define:

```ts
export const userRole = pgEnum("user_role", ["user", "editor", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);
export const contentStatus = pgEnum("content_status", ["draft", "published", "archived"]);
export const supportedLocale = pgEnum("supported_locale", ["ru", "kk", "en"]);
```

Make `users.normalizedUsername` unique and store password hashes only in `passwordCredentials`. Store `sessions.tokenDigest` as a unique fixed-length hex string, plus `expiresAt`, `lastUsedAt`, and `revokedAt`.

- [ ] **Step 4: Define catalog revision tables**

Keep stable identity/lifecycle on `places` and `categories`. Store mutable content on revision tables. The identity rows have nullable `draftRevisionId` and `publishedRevisionId`; add those foreign keys in generated SQL after both tables exist if Drizzle circular references require it.

Translations have unique `(revisionId, locale)` constraints. `placeRevisionCategories` has unique `(placeRevisionId, categoryId)`. Media assignments have unique sort ordering per revision and enforce at most one cover image through a partial unique SQL index.

- [ ] **Step 5: Define audit and user-owned data**

`savedPlaces` and `userInterests` use composite primary keys to make inserts idempotent. `auditEvents.metadata` is bounded JSONB and never stores credential data.

Generate and inspect the SQL:

```bash
cd backend
npx drizzle-kit generate
```

Expected: a migration creates all tables, enum types, foreign keys, unique constraints, and indexes.

- [ ] **Step 6: Add deterministic test database reset**

Create `backend/tests/setup/database.ts` exporting:

```ts
export async function resetTestDatabase(): Promise<void> {
  await sqlClient.unsafe("drop schema if exists public cascade");
  await sqlClient.unsafe("create schema public");
  await migrate(db, { migrationsFolder: "./db/migrations" });
}
```

Require `TEST_DATABASE_URL` and refuse to reset a URL whose database name does not end in `_test`.

- [ ] **Step 7: Verify migrations and constraints**

Run:

```bash
cd backend
npm run db:migrate
npm test -- tests/integration/schema.test.ts
npm run typecheck
```

Expected: migration succeeds; uniqueness test passes; typecheck exits `0`.

- [ ] **Step 8: Commit**

```bash
git add backend/db backend/drizzle.config.ts backend/tests backend/package.json backend/package-lock.json
git commit -m "feat(backend): add catalog auth and audit schema"
```

### Task 3: Implement authentication primitives and authorization policy

**Files:**
- Create: `backend/lib/auth/username.ts`
- Create: `backend/lib/auth/password.ts`
- Create: `backend/lib/auth/session.ts`
- Create: `backend/lib/auth/authorization.ts`
- Create: `backend/lib/auth/rate-limit.ts`
- Create: `backend/lib/result.ts`
- Create: `backend/tests/unit/auth/username.test.ts`
- Create: `backend/tests/unit/auth/password.test.ts`
- Create: `backend/tests/integration/session.test.ts`
- Create: `backend/tests/unit/auth/authorization.test.ts`

**Interfaces:**
- Produces: `normalizeUsername(value: string): string`.
- Produces: `hashPassword(password: string): Promise<string>` and `verifyPassword(hash: string, password: string): Promise<boolean>`.
- Produces: `createSession(userId: string, context: SessionContext): Promise<{ token: string; session: SessionRecord }>` and `readSession(token: string): Promise<AuthenticatedUser | null>`.
- Produces: `revokeSession`, `revokeAllUserSessions`, and `requireRole`.
- Produces: `consumeRateLimit(key, rule): Promise<{ allowed: boolean; retryAfterSeconds: number }>` backed by PostgreSQL for local correctness.

- [ ] **Step 1: Write username and password tests**

```ts
it("normalizes case and trims a valid username", () => {
  expect(normalizeUsername("  Geo.Vibes_01 ")).toBe("geo.vibes_01");
});

it.each(["ab", "has space", "кириллица", "admin"])(
  "rejects reserved or invalid username %s",
  (value) => expect(() => normalizeUsername(value)).toThrow(),
);

it("hashes and verifies without returning the original password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  expect(hash).not.toContain("correct horse");
  await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/unit/auth`

Expected: FAIL because authentication modules do not exist.

- [ ] **Step 3: Implement username and Argon2id helpers**

Username rules:

```ts
const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const RESERVED = new Set(["admin", "api", "support", "geovibes", "root"]);
```

Use `@node-rs/argon2` with Argon2id, memory cost `19456`, time cost `2`, parallelism `1`, and a maximum accepted password byte length of `256`. Require at least `10` Unicode characters.

- [ ] **Step 4: Write the failing session integration test**

```ts
it("stores only a digest and rejects a revoked session", async () => {
  const { token, session } = await createSession(user.id, {
    userAgent: "vitest",
    ipAddress: "127.0.0.1",
  });

  expect(session.tokenDigest).not.toBe(token);
  expect(await readSession(token)).toMatchObject({ id: user.id });

  await revokeSession(session.id);
  expect(await readSession(token)).toBeNull();
});
```

Run: `cd backend && npm test -- tests/integration/session.test.ts`

Expected: FAIL because session functions do not exist.

- [ ] **Step 5: Implement sessions, rate limiting, and roles**

Generate tokens with `randomBytes(32).toString("base64url")`. Store `sha256(token + AUTH_SECRET)` as the digest. Reject expired, revoked, or suspended users and update `lastUsedAt` no more than once every five minutes.

Use this role ordering:

```ts
const roleRank = { user: 0, editor: 1, admin: 2 } as const;

export function requireRole(
  user: AuthenticatedUser | null,
  minimum: keyof typeof roleRank,
): AuthenticatedUser {
  if (!user) throw new AppError("AUTH_REQUIRED", 401);
  if (roleRank[user.role] < roleRank[minimum]) {
    throw new AppError("FORBIDDEN", 403);
  }
  return user;
}
```

Rate-limit login by normalized username plus IP and signup by IP. Persist window counters so multiple Next.js processes behave consistently.

- [ ] **Step 6: Verify the authentication primitives**

Run:

```bash
cd backend
npm test -- tests/unit/auth tests/integration/session.test.ts
npm run typecheck
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/lib/auth backend/lib/result.ts backend/tests
git commit -m "feat(auth): add password sessions and role policies"
```

### Task 4: Build user authentication services and HTTP endpoints

**Files:**
- Create: `backend/lib/api/errors.ts`
- Create: `backend/lib/api/request.ts`
- Create: `backend/lib/api/response.ts`
- Create: `backend/lib/users/auth-service.ts`
- Create: `backend/app/api/auth/[action]/route.ts`
- Create: `backend/scripts/bootstrap-admin.ts`
- Create: `backend/tests/api/auth.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `signUp(input, context)`, `signIn(input, context)`, `signOut(token)`, `getCurrentUser(token)`, and `changePassword(userId, input)`.
- Produces JSON errors `{ error: { code: string; message: string; fields?: Record<string,string> }, requestId: string }`.
- Produces routes `POST /api/auth/sign-up`, `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `GET /api/auth/me`, and `POST /api/auth/change-password`.

- [ ] **Step 1: Write endpoint tests**

```ts
it("creates only an ordinary user and returns a session", async () => {
  const response = await request("/api/auth/sign-up", {
    method: "POST",
    body: { username: "NewGuest", password: "very secure password" },
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    data: { user: { username: "NewGuest", role: "user" } },
  });
});

it("uses the same generic error for unknown user and wrong password", async () => {
  const missing = await signInRequest("missing", "wrong password");
  const wrong = await signInRequest("existing", "wrong password");
  expect(await missing.json()).toEqual(await wrong.json());
});
```

- [ ] **Step 2: Run endpoint tests to verify failure**

Run: `cd backend && npm test -- tests/api/auth.test.ts`

Expected: FAIL because the auth route and test app helper do not exist.

- [ ] **Step 3: Implement transactional signup and sign-in**

`signUp` normalizes the username, checks rate limits, hashes outside the transaction, then inserts user plus credential and creates a session. Convert unique constraint violations to `USERNAME_UNAVAILABLE`.

`signIn` consumes rate limit budget, performs a dummy Argon2 verification when no credential exists, rejects suspended users, and always returns `INVALID_CREDENTIALS` for identity/password mismatch.

- [ ] **Step 4: Implement transport helpers and routes**

Accept a bearer token for native clients and an HTTP-only cookie for same-origin web clients. Use one `readRequestSession(request)` helper so endpoint behavior is identical.

Set admin/web cookies with:

```ts
{
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: env.SESSION_TTL_DAYS * 86_400,
}
```

Never include the session token in response JSON when a secure cookie is the selected transport; native auth responses may return a token only when the request explicitly declares the native client header.

- [ ] **Step 5: Add the bootstrap command**

Implement:

```bash
npm run admin:bootstrap -- --username geovibes.admin
```

Read the password from an interactive hidden prompt, refuse non-interactive plaintext password arguments, create or promote exactly one user, revoke existing sessions after promotion, and print only the user ID and username.

- [ ] **Step 6: Verify API behavior**

Run:

```bash
cd backend
npm test -- tests/api/auth.test.ts
npm run typecheck
```

Expected: signup, sign-in, sign-out, current-user, change-password, suspension, and rate-limit cases pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/auth backend/lib/api backend/lib/users/auth-service.ts backend/scripts backend/tests backend/package.json
git commit -m "feat(auth): expose username password API"
```

### Task 5: Implement catalog revision and publication services

**Files:**
- Create: `backend/lib/catalog/translation.ts`
- Create: `backend/lib/catalog/publication.ts`
- Create: `backend/lib/catalog/place-service.ts`
- Create: `backend/lib/catalog/category-service.ts`
- Create: `backend/tests/unit/catalog/translation.test.ts`
- Create: `backend/tests/integration/catalog-publication.test.ts`

**Interfaces:**
- Produces: `selectTranslation<T>(translations, requested, primary): SelectedTranslation<T>`.
- Produces: `createPlaceDraft`, `updatePlaceDraft`, `publishPlace`, `archivePlace`, `restorePlace`.
- Produces: equivalent category service operations.
- Produces: `MissingTranslationWarning` as a successful publish result warning, not a validation failure.

- [ ] **Step 1: Write deterministic translation tests**

```ts
it("returns the primary human-authored locale when requested text is absent", () => {
  const selected = selectTranslation(
    [{ locale: "ru", value: "Бар" }, { locale: "en", value: "Bar" }],
    "kk",
    "en",
  );
  expect(selected).toEqual({ locale: "en", value: "Bar" });
});

it("uses ru, kk, en fixed order only when primary locale is invalid", () => {
  const selected = selectTranslation(
    [{ locale: "en", value: "Bar" }, { locale: "ru", value: "Бар" }],
    "kk",
    null,
  );
  expect(selected.locale).toBe("ru");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/unit/catalog/translation.test.ts`

Expected: FAIL because `selectTranslation` does not exist.

- [ ] **Step 3: Implement translation selection**

Use exact locale unions:

```ts
export type SupportedLocale = "ru" | "kk" | "en";
export type SelectedTranslation<T> = { locale: SupportedLocale; value: T };
```

Throw `CONTENT_HAS_NO_TRANSLATION` only when the published revision contains zero human-authored translations.

- [ ] **Step 4: Write publication integration tests**

Cover these cases:

```ts
it("keeps the previous published revision live while draft changes", async () => {
  const place = await publishedPlaceFixture({ ru: { name: "Old" } });
  await updatePlaceDraft(editor, place.id, { ru: { name: "New" } });
  expect((await getPublicPlace(place.slug, "ru")).name).toBe("Old");
  await publishPlace(editor, place.id, { acknowledgeMissingLocales: true });
  expect((await getPublicPlace(place.slug, "ru")).name).toBe("New");
});

it("allows one-language publication only with acknowledgement", async () => {
  const place = await draftPlaceFixture({ ru: { name: "Тест" } });
  await expect(publishPlace(editor, place.id, {
    acknowledgeMissingLocales: false,
  })).rejects.toMatchObject({ code: "MISSING_LOCALES_CONFIRMATION_REQUIRED" });
});
```

- [ ] **Step 5: Implement draft, publish, archive, and audit transactions**

Require at publication:

- At least one translation
- Primary locale present in translations
- At least one non-archived category for a place
- Coordinates within valid latitude/longitude ranges
- One cover image for a place
- One cover image for a category

Publish by validating the draft, cloning/freezing the published snapshot as needed, atomically setting `publishedRevisionId`, updating lifecycle timestamps, and inserting an audit event. Do not mutate the previous published revision.

- [ ] **Step 6: Verify catalog services**

Run:

```bash
cd backend
npm test -- tests/unit/catalog tests/integration/catalog-publication.test.ts
npm run typecheck
```

Expected: all translation, revision, lifecycle, archived-category, and audit tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/lib/catalog backend/tests
git commit -m "feat(catalog): add draft publication lifecycle"
```

### Task 6: Expose the public catalog API

**Files:**
- Create: `backend/lib/catalog/queries.ts`
- Create: `backend/app/api/v1/categories/route.ts`
- Create: `backend/app/api/v1/places/route.ts`
- Create: `backend/app/api/v1/places/[slug]/route.ts`
- Create: `backend/tests/api/catalog.test.ts`

**Interfaces:**
- Produces: `listCategories({ locale })`.
- Produces: `listPlaces({ locale, category, query, cursor, limit })`.
- Produces: `getPlaceBySlug({ slug, locale })`.
- Produces: cursor envelopes `{ data, page: { nextCursor: string | null, hasMore: boolean } }`.

- [ ] **Step 1: Write public API isolation tests**

```ts
it("returns only published entities and reports the actual content language", async () => {
  await categoryFixture({ status: "draft" });
  await categoryFixture({ status: "archived" });
  await categoryFixture({ status: "published", primaryLocale: "ru" });

  const response = await request("/api/v1/categories?locale=kk");
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual([
    expect.objectContaining({ contentLanguage: "ru" }),
  ]);
});

it("does not resolve an archived place by its former public slug", async () => {
  const place = await publishedPlaceFixture();
  await archivePlace(admin, place.id);
  expect((await request(`/api/v1/places/${place.slug}`)).status).toBe(404);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/api/catalog.test.ts`

Expected: FAIL with missing public route handlers.

- [ ] **Step 3: Implement indexed catalog queries**

Use published revision joins only. Enforce `limit` from `1` through `50`, default `20`. Cursor contains the sort key plus stable ID and is base64url-encoded JSON signed with `AUTH_SECRET` to reject tampering.

Search normalized place names/descriptions with PostgreSQL `websearch_to_tsquery` where available and a deterministic `ILIKE` fallback for seed/test datasets. Category filtering uses category slug.

- [ ] **Step 4: Implement response DTOs**

Return only public fields. Every localized entity includes:

```ts
type LocalizedContent = {
  requestedLanguage: "ru" | "kk" | "en";
  contentLanguage: "ru" | "kk" | "en";
};
```

Do not return draft revision IDs, internal media storage paths, staff IDs, audit metadata, user counts, or unpublished translations.

- [ ] **Step 5: Verify catalog routes**

Run:

```bash
cd backend
npm test -- tests/api/catalog.test.ts
npm run typecheck
```

Expected: draft isolation, archive behavior, language selection, category filtering, search, cursor pagination, and validation cases pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1 backend/lib/catalog/queries.ts backend/tests/api/catalog.test.ts
git commit -m "feat(api): expose published catalog endpoints"
```

### Task 7: Add profile, interests, saved places, and guest merge

**Files:**
- Create: `backend/lib/users/profile-service.ts`
- Create: `backend/lib/users/saved-place-service.ts`
- Create: `backend/app/api/v1/profile/route.ts`
- Create: `backend/app/api/v1/saved-places/route.ts`
- Create: `backend/tests/api/profile.test.ts`
- Create: `backend/tests/integration/guest-merge.test.ts`

**Interfaces:**
- Produces: `updateProfile(userId, input)`.
- Produces: `listSavedPlaces`, `savePlace`, `removeSavedPlace`.
- Produces: `mergeGuestState(userId, { savedPlaceIds, interestCategoryIds })`.
- Produces idempotent `PUT`/`DELETE /api/v1/saved-places`.

- [ ] **Step 1: Write guest merge and ownership tests**

```ts
it("unions saved places and uses the explicit incoming interest selection", async () => {
  await savePlace(user.id, placeA.id);
  await setInterests(user.id, [categoryA.id]);

  await mergeGuestState(user.id, {
    savedPlaceIds: [placeA.id, placeB.id],
    interestCategoryIds: [categoryB.id],
  });

  expect(await savedIds(user.id)).toEqual([placeA.id, placeB.id].sort());
  expect(await interestIds(user.id)).toEqual([categoryB.id]);
});

it("cannot modify another user's saved places", async () => {
  const response = await authenticatedRequest(otherUser, "/api/v1/saved-places", {
    method: "DELETE",
    body: { placeId: userSavedPlace.id },
  });
  expect(response.status).toBe(204);
  expect(await isSaved(user.id, userSavedPlace.id)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/integration/guest-merge.test.ts tests/api/profile.test.ts`

Expected: FAIL because profile/saved-place services do not exist.

- [ ] **Step 3: Implement transactional merge and profile updates**

Validate that referenced places/categories are currently published before accepting new guest links. Use `onConflictDoNothing` for saves. Replace interests in one transaction only when `interestCategoryIds` is present; omitted interests leave server choices unchanged.

Username changes normalize and reserve the new name, return `USERNAME_UNAVAILABLE` on conflict, and do not change the user ID.

- [ ] **Step 4: Implement authenticated routes**

`GET/PATCH /api/v1/profile` returns/updates the current user. `POST /api/v1/profile/merge-guest` performs the merge. `GET/PUT/DELETE /api/v1/saved-places` operates only on the current session user.

- [ ] **Step 5: Verify profile APIs**

Run:

```bash
cd backend
npm test -- tests/api/profile.test.ts tests/integration/guest-merge.test.ts
npm run typecheck
```

Expected: ownership, idempotency, merge rollback, username conflict, suspended-session, and invalid catalog reference cases pass.

- [ ] **Step 6: Commit**

```bash
git add backend/lib/users backend/app/api/v1 backend/tests
git commit -m "feat(api): add profiles interests and saved places"
```

### Task 8: Implement validated local media storage

**Files:**
- Create: `backend/lib/media/storage.ts`
- Create: `backend/lib/media/local-storage.ts`
- Create: `backend/lib/media/service.ts`
- Create: `backend/app/api/admin/media/route.ts`
- Create: `backend/tests/unit/media/service.test.ts`
- Create: `backend/tests/integration/media-upload.test.ts`
- Create: `backend/storage/.gitkeep`

**Interfaces:**
- Produces: `MediaStorage` with `put`, `open`, and `delete`.
- Produces: `uploadImage(actor, file): Promise<MediaRecord>`.
- Produces: protected `POST /api/admin/media`.

- [ ] **Step 1: Write media validation tests**

```ts
it("rejects a file whose bytes do not match its declared image MIME type", async () => {
  const file = new File([new TextEncoder().encode("not an image")], "fake.jpg", {
    type: "image/jpeg",
  });
  await expect(uploadImage(editor, file)).rejects.toMatchObject({
    code: "INVALID_IMAGE",
  });
});

it("uses generated storage keys instead of the submitted filename", async () => {
  const record = await uploadImage(editor, jpegFixture("../../escape.jpg"));
  expect(record.storageKey).toMatch(/^[a-f0-9]{2}\/[a-f0-9-]+\.jpg$/);
  expect(record.storageKey).not.toContain("..");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/unit/media/service.test.ts`

Expected: FAIL because media services do not exist.

- [ ] **Step 3: Define and implement the storage adapter**

```ts
export interface MediaStorage {
  put(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<void>;
  open(key: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(key: string): Promise<void>;
}
```

`LocalMediaStorage` resolves every key under `MEDIA_ROOT`, rejects traversal after `path.resolve`, writes atomically through a temporary file in the same directory, and never trusts the upload filename.

- [ ] **Step 4: Implement image inspection and protected upload**

Use Sharp metadata to allow JPEG, PNG, and WebP only. Reject animated images, dimensions below `320x180`, dimensions above `8000x8000`, and files above `MAX_UPLOAD_BYTES`. Store detected MIME type, width, height, and byte size.

Require `editor` for upload and return a public media ID/URL, never the filesystem path.

- [ ] **Step 5: Verify storage behavior**

Run:

```bash
cd backend
npm test -- tests/unit/media tests/integration/media-upload.test.ts
npm run typecheck
```

Expected: valid image, invalid bytes, size, dimensions, traversal, authorization, and cleanup cases pass.

- [ ] **Step 6: Commit**

```bash
git add backend/lib/media backend/app/api/admin/media backend/tests backend/storage
git commit -m "feat(media): add secure local image storage"
```

### Task 9: Seed the current catalog and document backend operation

**Files:**
- Create: `backend/db/seed.ts`
- Create: `backend/db/seed-data.ts`
- Create: `backend/tests/integration/seed.test.ts`
- Create: `backend/README.md`
- Modify: `backend/package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: idempotent `npm run db:seed`.
- Produces: documented commands for local startup, migration, test database, seeding, and admin bootstrap.

- [ ] **Step 1: Write the idempotent seed test**

```ts
it("can seed twice without duplicate categories or places", async () => {
  await seedDatabase();
  await seedDatabase();
  expect(await countPublishedCategories()).toBe(5);
  expect(await countPublishedPlaces()).toBe(14);
});
```

- [ ] **Step 2: Run the seed test to verify failure**

Run: `cd backend && npm test -- tests/integration/seed.test.ts`

Expected: FAIL because `seedDatabase` does not exist.

- [ ] **Step 3: Convert the existing mock catalog into explicit seed records**

Copy the human-authored catalog strings from `locales/ru.json`, `locales/kk.json`, and `locales/en.json` into typed backend seed fixtures. Preserve stable slugs and coordinates. Treat committed mobile images as development seed inputs copied through the media service; do not make runtime backend code import from the Expo `lib/` directory.

Seed through domain services or equivalent validated transactions so seeded published revisions obey the same invariants as admin-published content.

- [ ] **Step 4: Add operational scripts and documentation**

Add scripts:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx db/migrate.ts",
  "db:seed": "tsx db/seed.ts",
  "admin:bootstrap": "tsx scripts/bootstrap-admin.ts",
  "test:integration": "vitest run tests/integration tests/api"
}
```

Install `tsx` as a dev dependency. Document emulator/device API URLs separately: Android emulator uses `http://10.0.2.2:3001`; iOS simulator uses `http://localhost:3001`; physical devices use the development machine LAN IP.

- [ ] **Step 5: Run the complete backend verification**

Run:

```bash
cd backend
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm test
npm run typecheck
npm run build
docker compose config
```

Expected: every command exits `0`; the seed is idempotent; build completes; no draft/archived fixture appears in public API tests.

- [ ] **Step 6: Review the diff for secrets and generated artifacts**

Run:

```bash
git status --short
git diff --check
git grep -n "postgres://.*:.*@" -- ':!backend/.env.example' ':!docs'
```

Expected: only intended source/docs/migrations are present, whitespace check passes, and no real credential is found.

- [ ] **Step 7: Commit**

```bash
git add backend README.md
git commit -m "feat(backend): seed catalog and document local operation"
```

## Backend Plan Completion Gate

Run the full verification from a clean database:

```bash
cd backend
docker compose down -v
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm test
npm run typecheck
npm run build
```

The backend plan is complete only when a fresh database can be migrated and seeded, all backend tests pass, and the published catalog/auth/profile APIs work without the admin UI or Expo app.
