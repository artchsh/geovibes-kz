# GeoVibes Implementation Plan Self-Review Corrections

This document is normative for the three implementation plans dated
2026-07-27. Apply each correction at the named task boundary. It resolves
spec-coverage and cross-plan interface gaps found during the required
writing-plans self-review.

## 1. Backend Task 2: persist rate limits and legacy catalog IDs

Add `rateLimitBuckets` to the exported Drizzle tables in
`backend/db/schema/auth.ts`:

```ts
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    keyDigest: varchar("key_digest", { length: 64 }).primaryKey(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limit_expiry_idx").on(table.expiresAt)],
);
```

The rate limiter from Backend Task 3 consumes this table in a transaction
using `INSERT ... ON CONFLICT ... DO UPDATE`. Add an integration test that
creates two limiter instances against the same test database and verifies the
combined attempts reach the configured limit.

Add nullable unique `legacyId` columns to stable `places` and `categories`
identity rows. Seeded records use the existing mock IDs (`"1"` through
`"14"` for places and `"1"` through `"5"` for categories). User-created
records leave `legacyId` null.

Public place/category DTOs include:

```ts
legacyId: string | null;
```

This field exists only for migration compatibility and is not used as a route
identifier.

## 2. Backend Task 4: enforce origin policy on cookie-authenticated writes

Create `backend/lib/api/origin.ts` and
`backend/tests/unit/api/origin.test.ts`.

```ts
export function assertTrustedWriteOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const bearer = request.headers.get("authorization")?.startsWith("Bearer ");

  if (bearer) return;
  if (!origin || ![env.APP_ORIGIN, ...env.MOBILE_ORIGINS].includes(origin)) {
    throw new AppError("UNTRUSTED_ORIGIN", 403);
  }
}
```

Call it before every state-changing route that accepts cookie
authentication. Native bearer requests do not require a browser Origin
header. Add tests for trusted admin origin, untrusted browser origin, missing
cookie-write origin, and native bearer requests.

For Expo web development, add exact configured origins to CORS responses.
Never reflect arbitrary origins and never use
`Access-Control-Allow-Origin: *` with credentials.

## 3. Backend Task 8: serve media through stable public IDs

Add:

- Create: `backend/app/media/[id]/route.ts`
- Create: `backend/tests/api/media-read.test.ts`

Implement:

```ts
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response>;
```

Resolve the media record by ID, then call `MediaStorage.open(storageKey)`.
Return the detected MIME type, an ETag derived from the immutable storage key,
and `Cache-Control: public, max-age=31536000, immutable`. Return `404` for
unknown, deleted, or physically missing media without exposing the storage
path.

API/admin DTO builders create public URLs with:

```ts
new URL(`/media/${media.id}`, env.APP_ORIGIN).toString();
```

Tests cover valid bytes/MIME, ETag `304`, missing record, missing file, and
absence of filesystem paths in headers or bodies.

## 4. Backend Task 9A: expose the protected admin HTTP contract

Execute this task after Backend Task 8 and before seed/documentation Task 9.

**Files:**

- Create: `backend/app/api/admin/places/route.ts`
- Create: `backend/app/api/admin/places/[id]/route.ts`
- Create: `backend/app/api/admin/places/[id]/publish/route.ts`
- Create: `backend/app/api/admin/categories/route.ts`
- Create: `backend/app/api/admin/categories/[id]/route.ts`
- Create: `backend/app/api/admin/categories/[id]/publish/route.ts`
- Create: `backend/app/api/admin/users/route.ts`
- Create: `backend/app/api/admin/users/[id]/route.ts`
- Create: `backend/app/api/admin/audit/route.ts`
- Create: `backend/tests/api/admin-contract.test.ts`

**Interfaces:**

- `GET/POST /api/admin/places`
- `GET/PATCH/DELETE /api/admin/places/:id`
- `POST /api/admin/places/:id/publish`
- Equivalent category routes
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id` for status/role only
- `GET /api/admin/audit`

Admin route handlers call the same domain services used by Server Actions.
They do not duplicate validation, publication, authorization, or audit
logic.

Write these tests first:

```ts
it("denies an ordinary authenticated user on every admin route", async () => {
  for (const requestCase of adminRouteCases()) {
    const response = await requestCase.as(ordinaryUser);
    expect(response.status).toBe(403);
  }
});

it("allows an editor to mutate catalog but not users", async () => {
  expect((await patchPlaceAs(editor)).status).toBe(200);
  expect((await patchUserAs(editor)).status).toBe(403);
});

it("keeps one-language publication as an explicit confirmation", async () => {
  const response = await publishRussianOnlyPlaceAs(editor, {
    acknowledgeMissingLocales: false,
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    error: {
      code: "MISSING_LOCALES_CONFIRMATION_REQUIRED",
    },
  });
});
```

Run:

```bash
cd backend
npm test -- tests/api/admin-contract.test.ts
npm run typecheck
```

Expected: route matrix, role matrix, origin enforcement, draft isolation,
publication confirmation, validation, pagination, and audit tests pass.

Commit:

```bash
git add backend/app/api/admin backend/tests/api/admin-contract.test.ts
git commit -m "feat(api): expose protected admin contract"
```

## 5. Admin Task 8: keep user policy in a domain service

Create `backend/lib/users/admin-user-service.ts`. Both admin Server Actions
and `/api/admin/users` handlers consume:

```ts
export async function suspendUser(
  actor: AuthenticatedUser,
  targetUserId: string,
): Promise<void>;

export async function reactivateUser(
  actor: AuthenticatedUser,
  targetUserId: string,
): Promise<void>;

export async function changeUserRole(
  actor: AuthenticatedUser,
  targetUserId: string,
  role: "user" | "editor" | "admin",
): Promise<void>;
```

The service owns admin authorization, self-protection, final-admin
protection, session revocation, transactions, and audit events. Server
Actions only parse form data and map service results to `AdminFormState`.

## 6. Mobile Tasks 3 and 5: migrate existing guest saves by legacy ID

When catalog data loads, build:

```ts
const placeIdByLegacyId = new Map(
  places
    .filter((place) => place.legacyId !== null)
    .map((place) => [place.legacyId as string, place.id]),
);
```

During the one-time `geovibes.savedVenueIds` migration:

1. Keep the old string IDs in `geovibes.pendingLegacySavedVenueIds`.
2. Resolve them after the first successful catalog/cache load.
3. Write resolved permanent IDs to `geovibes.guestSavedPlaceIds`.
4. Retain unresolved legacy IDs for a future retry.
5. Remove the pending key only when every legacy ID is resolved.

Add tests for full resolution, partial resolution, offline resolution from
cache, and retry after a newer catalog arrives.

## 7. Mobile Tasks 3 and 4: make interests affect ordering without hiding content

Add:

```ts
export function rankCatalogForInterests(
  places: CatalogPlace[],
  interestCategoryIds: string[],
): CatalogPlace[] {
  const interests = new Set(interestCategoryIds);
  return places
    .map((place, index) => ({
      place,
      index,
      interested: place.categoryIds.some((id) => interests.has(id)),
    }))
    .sort((a, b) =>
      Number(b.interested) - Number(a.interested) || a.index - b.index,
    )
    .map(({ place }) => place);
}
```

Use it only for the initial home discovery ordering. Category pages, search,
and explicit sorts retain server order. An empty interests list preserves
server order. No place is filtered out.

Add unit tests for preferred-first ordering, stable order within each group,
empty interests, and a place assigned to multiple categories.

## 8. Final cross-plan verification

Before claiming implementation complete, run:

```bash
cd backend
npm test
npm run typecheck
npm run build
cd ..
npm test -- tests/mobile --runInBand
npm run typecheck
npm run test:layout
```

Then verify the mutation boundary:

```bash
rg -n "/api/admin|publishPlace|archivePlace|updatePlaceDraft" app components lib
```

Expected: no matches in Expo production code. Backend admin code and tests are
outside these root mobile directories.
