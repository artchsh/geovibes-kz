# GeoVibes Internal Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished staff-only web panel for managing catalog revisions, translations, media, users, roles, and audit history.

**Architecture:** The admin UI runs inside the existing `backend/` Next.js application and calls backend domain services directly from authenticated Server Actions. Server Components perform reads, Client Components manage form interaction, and every mutation rechecks role authorization in the service layer.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, React Hook Form, Zod, Lucide React, Sonner, Vitest, Testing Library, Playwright

## Global Constraints

- This plan begins only after `2026-07-27-backend-platform-api.md` passes its completion gate.
- The admin panel is available only to active `editor` and `admin` users.
- Public signup can never grant staff access.
- Catalog editing exists only under the backend admin surface; no catalog editor is added to Expo.
- Editors manage places, categories, translations, and media.
- Only admins manage user suspension and staff roles.
- Draft edits never change the public published revision until Publish succeeds.
- One-language publication is allowed only after an explicit missing-language confirmation.
- No admin action automatically translates text.
- Passwords and session tokens are never displayed.
- Every lifecycle, suspension, role, and relevant media-deletion mutation is audited.
- Venue-owner access, place claiming, analytics, payments, and production deployment are excluded.

---

## Planned File Structure

```text
backend/
├── app/
│   ├── admin/
│   │   ├── (authenticated)/
│   │   │   ├── audit/page.tsx
│   │   │   ├── categories/[id]/page.tsx
│   │   │   ├── categories/new/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── places/[id]/page.tsx
│   │   │   ├── places/new/page.tsx
│   │   │   ├── places/page.tsx
│   │   │   ├── users/[id]/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── login/page.tsx
│   │   ├── actions.ts
│   │   └── layout.tsx
│   ├── globals.css
│   └── unauthorized.tsx
├── components/admin/
│   ├── app-shell.tsx
│   ├── data-table.tsx
│   ├── empty-state.tsx
│   ├── field-error.tsx
│   ├── filters.tsx
│   ├── form-actions.tsx
│   ├── language-tabs.tsx
│   ├── media-editor.tsx
│   ├── publish-dialog.tsx
│   ├── status-badge.tsx
│   └── unsaved-changes.tsx
├── lib/admin/
│   ├── actions/
│   │   ├── category-actions.ts
│   │   ├── place-actions.ts
│   │   └── user-actions.ts
│   ├── dashboard-query.ts
│   ├── form-state.ts
│   ├── guards.ts
│   └── schemas.ts
└── tests/
    ├── admin/
    └── e2e/admin/
```

### Task 1: Add the admin visual foundation and component test harness

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/app/globals.css`
- Modify: `backend/app/layout.tsx`
- Create: `backend/postcss.config.mjs`
- Create: `backend/components/admin/status-badge.tsx`
- Create: `backend/components/admin/field-error.tsx`
- Create: `backend/components/admin/empty-state.tsx`
- Create: `backend/tests/admin/status-badge.test.tsx`
- Modify: `backend/vitest.config.ts`

**Interfaces:**
- Produces: shared admin design tokens and accessible primitives.
- Produces: `StatusBadge({ status })`, `FieldError({ id, message })`, and `EmptyState`.

- [ ] **Step 1: Install UI and test dependencies**

Run:

```bash
cd backend
npm install lucide-react react-hook-form @hookform/resolvers sonner
npm install -D tailwindcss @tailwindcss/postcss @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Write the failing status badge accessibility test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/admin/status-badge";

describe("StatusBadge", () => {
  it("renders status as readable text rather than color alone", () => {
    render(<StatusBadge status="published" />);
    expect(screen.getByText("Published")).toBeVisible();
  });
});
```

Run: `cd backend && npm test -- tests/admin/status-badge.test.tsx`

Expected: FAIL because `StatusBadge` does not exist.

- [ ] **Step 3: Define the visual system**

Use restrained GeoVibes admin tokens:

```css
@import "tailwindcss";

:root {
  --admin-bg: #f6f3ee;
  --admin-surface: #ffffff;
  --admin-ink: #171717;
  --admin-muted: #6f6b66;
  --admin-border: #e6e0d8;
  --admin-accent: #e5484d;
  --admin-success: #2f7d4a;
  --admin-warning: #a86200;
  --admin-radius: 14px;
}
```

Use system sans-serif for dense admin content, a maximum content width of `1600px`, visible focus rings, minimum `44px` interactive targets, and no mobile-app decorative phone mockups.

- [ ] **Step 4: Implement the primitives and jsdom setup**

`StatusBadge` maps all lifecycle/user values to text plus icon/color. `FieldError` uses `role="alert"` and a stable ID for `aria-describedby`. `EmptyState` accepts one optional primary action.

- [ ] **Step 5: Verify UI foundations**

Run:

```bash
cd backend
npm test -- tests/admin/status-badge.test.tsx
npm run typecheck
npm run build
```

Expected: component test passes and production build exits `0`.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(admin): add visual foundation and test harness"
```

### Task 2: Implement staff login, guards, and the admin shell

**Files:**
- Create: `backend/lib/admin/guards.ts`
- Create: `backend/app/admin/layout.tsx`
- Create: `backend/app/admin/login/page.tsx`
- Create: `backend/app/admin/actions.ts`
- Create: `backend/app/admin/(authenticated)/layout.tsx`
- Create: `backend/components/admin/app-shell.tsx`
- Create: `backend/app/unauthorized.tsx`
- Create: `backend/tests/admin/guards.test.ts`
- Create: `backend/tests/e2e/admin/login.spec.ts`

**Interfaces:**
- Consumes: `readRequestSession` and `requireRole` from the backend plan.
- Produces: `requireAdminPageUser(minimum: "editor" | "admin")`.
- Produces: `adminLoginAction(previousState, formData): Promise<AdminFormState>`.
- Produces: authenticated shell navigation.

- [ ] **Step 1: Write guard tests**

```ts
it("redirects unauthenticated users to admin login with a safe return path", async () => {
  mockPageSession(null);
  await expect(requireAdminPageUser("editor", "/admin/places"))
    .rejects.toMatchObject({ digest: expect.stringContaining("/admin/login") });
});

it("rejects ordinary authenticated users", async () => {
  mockPageSession(userFixture({ role: "user" }));
  await expect(requireAdminPageUser("editor", "/admin"))
    .rejects.toMatchObject({ digest: expect.stringContaining("/unauthorized") });
});
```

- [ ] **Step 2: Run guard tests to verify failure**

Run: `cd backend && npm test -- tests/admin/guards.test.ts`

Expected: FAIL because admin guards do not exist.

- [ ] **Step 3: Implement login and safe redirects**

Validate `returnTo` against an allowlist of paths beginning with `/admin/`; never redirect to a supplied absolute URL. Use the existing auth service so login rate limits and generic errors remain identical.

The login form contains username, password, submit progress, one generic credential error, and no signup link.

- [ ] **Step 4: Implement the authenticated shell**

Navigation:

```ts
const editorNavigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/places", label: "Places", icon: MapPin },
  { href: "/admin/categories", label: "Categories", icon: Shapes },
];

const adminNavigation = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];
```

Render admin-only links only for admins, but preserve server authorization on target pages/actions. Add current staff username and sign-out action.

- [ ] **Step 5: Write and run Playwright login smoke test**

Test invalid login, valid editor login, ordinary-user denial, and sign-out:

```bash
cd backend
npx playwright test tests/e2e/admin/login.spec.ts
```

Expected: all four cases pass against a migrated test database.

- [ ] **Step 6: Commit**

```bash
git add backend/app/admin backend/app/unauthorized.tsx backend/components/admin/app-shell.tsx backend/lib/admin/guards.ts backend/tests
git commit -m "feat(admin): add staff login guards and shell"
```

### Task 3: Build the actionable dashboard

**Files:**
- Create: `backend/lib/admin/dashboard-query.ts`
- Create: `backend/app/admin/(authenticated)/page.tsx`
- Create: `backend/components/admin/metric-card.tsx`
- Create: `backend/components/admin/recent-activity.tsx`
- Create: `backend/tests/admin/dashboard-query.test.ts`

**Interfaces:**
- Produces: `getDashboardSummary(): Promise<DashboardSummary>`.
- Produces: counts for published/draft/archived places, categories, users, and incomplete translations.

- [ ] **Step 1: Write the dashboard query test**

```ts
it("counts incomplete recommended translations without treating them as invalid", async () => {
  await publishedPlaceFixture({ translations: ["ru"] });
  await publishedPlaceFixture({ translations: ["ru", "kk", "en"] });
  const summary = await getDashboardSummary();
  expect(summary.places.published).toBe(2);
  expect(summary.incompleteTranslations).toBe(1);
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `cd backend && npm test -- tests/admin/dashboard-query.test.ts`

Expected: FAIL because the query does not exist.

- [ ] **Step 3: Implement one bounded aggregate query**

Return:

```ts
type DashboardSummary = {
  places: { total: number; draft: number; published: number; archived: number };
  categories: number;
  users: number;
  incompleteTranslations: number;
  recentEvents: Array<{
    id: string;
    action: string;
    actorUsername: string;
    createdAt: string;
  }>;
};
```

Limit recent events to `10` and do not return audit metadata on the dashboard.

- [ ] **Step 4: Build the dashboard page**

Use metric cards with direct links to filtered place/category lists. Add a prominent “Create place” action and an incomplete-translations card that links to `/admin/places?translations=incomplete`.

- [ ] **Step 5: Verify**

Run:

```bash
cd backend
npm test -- tests/admin/dashboard-query.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add backend/lib/admin/dashboard-query.ts backend/app/admin backend/components/admin backend/tests/admin
git commit -m "feat(admin): add catalog dashboard"
```

### Task 4: Build the places index with search, filtering, and pagination

**Files:**
- Create: `backend/app/admin/(authenticated)/places/page.tsx`
- Create: `backend/components/admin/data-table.tsx`
- Create: `backend/components/admin/filters.tsx`
- Create: `backend/lib/admin/place-list-query.ts`
- Create: `backend/tests/admin/place-list-query.test.ts`
- Create: `backend/tests/e2e/admin/places-list.spec.ts`

**Interfaces:**
- Produces: `listAdminPlaces(input: AdminPlaceListInput)`.
- Produces: URL-driven filters `query`, `status`, `category`, `translations`, `page`, and `sort`.

- [ ] **Step 1: Write filter tests**

```ts
it("filters by draft status and missing translations together", async () => {
  await placeFixture({ status: "draft", translationLocales: ["ru"] });
  await placeFixture({ status: "draft", translationLocales: ["ru", "kk", "en"] });
  await placeFixture({ status: "published", translationLocales: ["ru"] });

  const result = await listAdminPlaces({
    status: "draft",
    translations: "incomplete",
    page: 1,
    pageSize: 25,
  });
  expect(result.items).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/admin/place-list-query.test.ts`

Expected: FAIL because the admin list query does not exist.

- [ ] **Step 3: Implement validated URL-driven queries**

Use stable sorting by `updatedAt desc, id desc` by default. Cap page size at `100`; use `25` in the UI. Return lifecycle status, primary locale, present locales, categories, cover thumbnail URL, and updated timestamp.

- [ ] **Step 4: Implement the accessible table and filters**

The table must have real column headers, textual status, an empty state, row links, pagination, and a “Create place” button. Filters submit as query parameters so URLs are shareable and browser navigation works.

- [ ] **Step 5: Verify list behavior**

Run:

```bash
cd backend
npm test -- tests/admin/place-list-query.test.ts
npx playwright test tests/e2e/admin/places-list.spec.ts
npm run typecheck
```

Expected: search, combined filters, empty state, pagination, and row navigation pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/admin backend/components/admin backend/lib/admin/place-list-query.ts backend/tests
git commit -m "feat(admin): add places search and filters"
```

### Task 5: Build the place draft editor and publication workflow

**Files:**
- Create: `backend/lib/admin/schemas.ts`
- Create: `backend/lib/admin/form-state.ts`
- Create: `backend/lib/admin/actions/place-actions.ts`
- Create: `backend/app/admin/(authenticated)/places/new/page.tsx`
- Create: `backend/app/admin/(authenticated)/places/[id]/page.tsx`
- Create: `backend/components/admin/place-form.tsx`
- Create: `backend/components/admin/language-tabs.tsx`
- Create: `backend/components/admin/form-actions.tsx`
- Create: `backend/components/admin/publish-dialog.tsx`
- Create: `backend/components/admin/unsaved-changes.tsx`
- Create: `backend/tests/admin/place-actions.test.ts`
- Create: `backend/tests/e2e/admin/place-editor.spec.ts`

**Interfaces:**
- Consumes: catalog draft/publication services from backend Task 5.
- Produces: `savePlaceDraftAction`, `publishPlaceAction`, `archivePlaceAction`, and `restorePlaceAction`.
- Produces: `PlaceDraftInput` validated from form data.

- [ ] **Step 1: Write place action tests**

```ts
it("returns field errors without mutating a published revision", async () => {
  const place = await publishedPlaceFixture({ name: "Live" });
  const result = await savePlaceDraftAction(editorSession, invalidFormData({
    id: place.id,
    latitude: "999",
  }));
  expect(result.status).toBe("error");
  expect(result.fieldErrors.latitude).toBeDefined();
  expect((await getPublicPlace(place.slug, "ru")).name).toBe("Live");
});

it("requires explicit missing-language acknowledgement", async () => {
  const result = await publishPlaceAction(editorSession, {
    placeId: oneLanguageDraft.id,
    acknowledgeMissingLocales: false,
  });
  expect(result).toMatchObject({
    status: "confirmation-required",
    missingLocales: ["kk", "en"],
  });
});
```

- [ ] **Step 2: Run action tests to verify failure**

Run: `cd backend && npm test -- tests/admin/place-actions.test.ts`

Expected: FAIL because actions/schemas do not exist.

- [ ] **Step 3: Define the form schema and state**

Use:

```ts
type AdminFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "confirmation-required"; message: string; missingLocales: SupportedLocale[] };
```

Parse nested translation fields explicitly and reject a primary locale without a matching translation. Preserve submitted values after validation failure.

- [ ] **Step 4: Implement the editor**

Sections:

- Basics: slug and primary language
- Translations: language tabs with name/description/tagline fields
- Classification: categories and editorial tags
- Location: address, district, latitude, longitude, optional 2GIS URL
- Contact: phone, website, Instagram
- Details: price level and opening hours
- Media: integrated in Task 6

Show completion dots on each language tab. Empty locale forms create no translation record. Add an unsaved-changes browser guard only when form state differs from its initial serialized value.

- [ ] **Step 5: Implement lifecycle controls**

Save draft and Publish are separate buttons. Publishing with missing languages opens a dialog with the exact missing locales and requires an unchecked acknowledgement checkbox. Archive/restore use separate confirmation dialogs.

Preview opens `/admin/places/[id]/preview` backed by draft DTOs and marked with a persistent “Draft preview—not public” banner.

- [ ] **Step 6: Run focused and E2E tests**

Run:

```bash
cd backend
npm test -- tests/admin/place-actions.test.ts
npx playwright test tests/e2e/admin/place-editor.spec.ts
npm run typecheck
```

Expected: save, invalid field, unsaved warning, one-language confirmation, publish, archive, restore, preview, and live-revision isolation cases pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/admin backend/components/admin backend/lib/admin backend/tests
git commit -m "feat(admin): add place draft and publish editor"
```

### Task 6: Add ordered media management to the place editor

**Files:**
- Create: `backend/components/admin/media-editor.tsx`
- Create: `backend/lib/admin/actions/media-actions.ts`
- Modify: `backend/components/admin/place-form.tsx`
- Modify: `backend/lib/admin/actions/place-actions.ts`
- Create: `backend/tests/admin/media-actions.test.ts`
- Create: `backend/tests/e2e/admin/media-editor.spec.ts`

**Interfaces:**
- Consumes: `uploadImage` and revision media services from the backend plan.
- Produces: `uploadMediaAction`, `reorderPlaceMediaAction`, `setCoverMediaAction`, and `deleteMediaAction`.

- [ ] **Step 1: Write media action authorization and ordering tests**

```ts
it("reorders only media attached to the current draft revision", async () => {
  const result = await reorderPlaceMediaAction(editor, {
    placeId: place.id,
    mediaIds: [mediaB.id, mediaA.id],
  });
  expect(result.status).toBe("success");
  expect(await draftMediaIds(place.id)).toEqual([mediaB.id, mediaA.id]);
  expect(await publishedMediaIds(place.id)).toEqual(originalPublishedIds);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/admin/media-actions.test.ts`

Expected: FAIL because media actions do not exist.

- [ ] **Step 3: Implement upload, ordering, cover, and deletion actions**

Validate ownership of every media ID and require `editor`. Deleting media referenced by a published revision must not delete its bytes; mark it pending deletion until no revision references it. Create an audit event when bytes are actually removed.

- [ ] **Step 4: Build the media editor**

Support multi-file selection, per-file progress, thumbnail grid, keyboard-accessible move-left/move-right controls, cover selection, alt text, and delete confirmation. Do not require drag-and-drop for accessibility; drag-and-drop may enhance the same ordered controls.

- [ ] **Step 5: Verify**

Run:

```bash
cd backend
npm test -- tests/admin/media-actions.test.ts
npx playwright test tests/e2e/admin/media-editor.spec.ts
npm run typecheck
```

Expected: upload validation, reorder, cover, delete, draft isolation, and keyboard controls pass.

- [ ] **Step 6: Commit**

```bash
git add backend/components/admin backend/lib/admin/actions backend/tests
git commit -m "feat(admin): add ordered place media editor"
```

### Task 7: Build category management

**Files:**
- Create: `backend/lib/admin/actions/category-actions.ts`
- Create: `backend/lib/admin/category-list-query.ts`
- Create: `backend/app/admin/(authenticated)/categories/page.tsx`
- Create: `backend/app/admin/(authenticated)/categories/new/page.tsx`
- Create: `backend/app/admin/(authenticated)/categories/[id]/page.tsx`
- Create: `backend/components/admin/category-form.tsx`
- Create: `backend/tests/admin/category-actions.test.ts`
- Create: `backend/tests/e2e/admin/categories.spec.ts`

**Interfaces:**
- Consumes: category draft/publication services.
- Produces: category list, create/edit/reorder/publish/archive UI.

- [ ] **Step 1: Write category lifecycle tests**

```ts
it("warns with current place usage before category archival", async () => {
  const result = await inspectCategoryArchive(admin, usedCategory.id);
  expect(result).toEqual({
    publishedPlaceCount: 3,
    draftPlaceCount: 1,
  });
});

it("prevents assigning an archived category", async () => {
  await expect(assignCategoryToDraft(place.id, archivedCategory.id))
    .rejects.toMatchObject({ code: "CATEGORY_ARCHIVED" });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/admin/category-actions.test.ts`

Expected: FAIL because category admin actions do not exist.

- [ ] **Step 3: Implement category forms and ordering**

Reuse the translation-tab and publish-confirmation primitives. Require slug, primary locale, at least one human-authored name/tagline translation, and cover image for publication.

Ordering updates accept the complete ordered active category ID list in one transaction and reject missing/duplicate IDs.

- [ ] **Step 4: Implement category index and archive usage dialog**

Show cover, localized name, locales present, status, display order, and place usage. Before archive, display affected published/draft counts; do not silently archive or detach places.

- [ ] **Step 5: Verify**

Run:

```bash
cd backend
npm test -- tests/admin/category-actions.test.ts
npx playwright test tests/e2e/admin/categories.spec.ts
npm run typecheck
```

Expected: create, one-language publish, reorder, usage warning, archive, restore, and archived-assignment prevention pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/admin backend/components/admin backend/lib/admin backend/tests
git commit -m "feat(admin): add category management"
```

### Task 8: Add admin-only user management and audit views

**Files:**
- Create: `backend/lib/admin/actions/user-actions.ts`
- Create: `backend/lib/admin/user-list-query.ts`
- Create: `backend/lib/admin/audit-query.ts`
- Create: `backend/app/admin/(authenticated)/users/page.tsx`
- Create: `backend/app/admin/(authenticated)/users/[id]/page.tsx`
- Create: `backend/app/admin/(authenticated)/audit/page.tsx`
- Create: `backend/tests/admin/user-actions.test.ts`
- Create: `backend/tests/e2e/admin/users-audit.spec.ts`

**Interfaces:**
- Produces: `suspendUserAction`, `reactivateUserAction`, and `changeUserRoleAction`.
- Produces: paginated user and audit queries.

- [ ] **Step 1: Write user-policy tests**

```ts
it("prevents an admin from removing the final active admin", async () => {
  await expect(changeUserRole(lastAdmin, {
    userId: lastAdmin.id,
    role: "editor",
  })).rejects.toMatchObject({ code: "LAST_ADMIN_REQUIRED" });
});

it("suspension revokes every active session and writes one audit event", async () => {
  await suspendUserAction(admin, target.id);
  expect(await activeSessionCount(target.id)).toBe(0);
  expect(await auditCount("user.suspended", target.id)).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && npm test -- tests/admin/user-actions.test.ts`

Expected: FAIL because user admin actions do not exist.

- [ ] **Step 3: Implement protected user mutations**

Require `admin` within every action and service. Add safeguards:

- Cannot suspend self
- Cannot remove/suspend the final active admin
- No-op role/status requests do not create duplicate audit events
- Every real change revokes target sessions

- [ ] **Step 4: Build user and audit pages**

User list: username, role, status, preferred language, created/last-active timestamps, search, role/status filters.

User detail: public profile fields, counts of saves/interests, role and status controls. Never show password hashes, credential rows, session tokens/digests, IP addresses, or full user agents.

Audit list: timestamp, actor, action, target type/ID, bounded safe metadata. Add action/actor/date filters and stable pagination.

- [ ] **Step 5: Verify**

Run:

```bash
cd backend
npm test -- tests/admin/user-actions.test.ts
npx playwright test tests/e2e/admin/users-audit.spec.ts
npm run typecheck
```

Expected: editor denial, admin success, self/final-admin safeguards, session revocation, audit visibility, and secret-field absence pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/admin backend/lib/admin backend/tests
git commit -m "feat(admin): add user roles suspension and audit"
```

### Task 9: Complete admin regression coverage and operator documentation

**Files:**
- Create: `backend/tests/e2e/admin/full-publishing-flow.spec.ts`
- Create: `backend/tests/e2e/admin/accessibility.spec.ts`
- Modify: `backend/README.md`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `npm run test:admin-e2e`.
- Produces: documented staff workflows and recovery from common local failures.

- [ ] **Step 1: Write the end-to-end publishing journey**

The test must:

1. Bootstrap/login as admin.
2. Create a Russian-only category and acknowledge missing Kazakh/English.
3. Create a Russian-only place.
4. Upload two images, reorder them, and set the cover.
5. Preview the draft and verify it is absent from `/api/v1/places`.
6. Publish after acknowledging missing languages.
7. Verify the place appears publicly with `contentLanguage: "ru"`.
8. Edit the draft name and verify the previous public name remains.
9. Republish and verify the new public name.
10. Archive and verify public `404`.

- [ ] **Step 2: Add keyboard/accessibility smoke coverage**

Using Playwright plus `@axe-core/playwright`, check login, dashboard, list, and editor pages for serious/critical violations. Exercise language tabs, dialogs, media ordering, and form submission with keyboard input.

Install:

```bash
cd backend
npm install -D @axe-core/playwright
```

- [ ] **Step 3: Add scripts and operator documentation**

```json
{
  "test:admin": "vitest run tests/admin",
  "test:admin-e2e": "playwright test tests/e2e/admin"
}
```

Document bootstrap, login, draft/publish semantics, one-language warning, archive/restore, safe user suspension, and media-volume backup.

- [ ] **Step 4: Run the complete admin verification**

Run:

```bash
cd backend
npm test
npm run test:admin-e2e
npm run typecheck
npm run build
```

Expected: all backend/admin tests pass and the production build completes.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "test(admin): cover publishing and staff workflows"
```

## Admin Plan Completion Gate

The admin plan is complete only when an active editor can manage catalog drafts and publication, an admin can safely manage staff/users, one-language publication warns but succeeds, published revisions remain isolated from drafts, audit records are visible, and all unit/integration/E2E checks pass.
