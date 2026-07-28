# GeoVibes Mobile Onboarding and Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Expo app to the published catalog API and deliver polished optional-account onboarding, secure username/password sessions, guest continuity, and synchronized user saves/interests.

**Architecture:** The Expo app keeps public browsing available without a session. Focused API, catalog, authentication, and local-state modules sit behind React providers; the catalog repository serves cached published data during temporary network failures, while Expo SecureStore holds only the opaque session credential.

**Tech Stack:** Expo SDK 57, Expo Router, React Native, TypeScript, Expo SecureStore, AsyncStorage, NetInfo, Zod, Jest Expo, React Native Testing Library, Playwright

## Global Constraints

- This plan begins after `2026-07-27-backend-platform-api.md` passes its completion gate.
- Preserve the existing user-owned UI changes unless a task explicitly replaces the same onboarding/auth/catalog behavior.
- The public Expo app never contains place/category editing controls or admin mutation calls.
- Guests can complete onboarding, browse every published place/category, and save places locally.
- Account creation and sign-in are optional.
- Version-one signup uses editable public username plus password.
- Account recovery is absent; signup must explain this before submission.
- Session credentials are stored only in Expo SecureStore, never AsyncStorage.
- Guest saves and server saves merge by set union without data loss.
- Russian, Kazakh, and English remain supported UI languages.
- Catalog text is never automatically translated.
- If a requested catalog locale is absent, display the human-authored API fallback unchanged.
- External directions use the provided 2GIS URL.
- Embedded maps, OTP, passkeys, venue-owner features, subscriptions, and catalog editing are excluded.

---

## Planned File Structure

```text
app/
├── auth/
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── onboarding/
│   ├── _layout.tsx
│   ├── account.tsx
│   ├── index.tsx
│   ├── interests.tsx
│   └── language.tsx
├── (tabs)/
│   ├── index.tsx
│   ├── list.tsx
│   ├── profile.tsx
│   └── settings.tsx
├── category/[id].tsx
├── search.tsx
├── space/[id].tsx
└── _layout.tsx
components/
├── auth/
│   ├── auth-field.tsx
│   ├── password-field.tsx
│   └── session-banner.tsx
├── onboarding/
│   ├── onboarding-actions.tsx
│   ├── onboarding-progress.tsx
│   └── selectable-interest.tsx
└── ui/
lib/
├── api/
│   ├── client.ts
│   ├── config.ts
│   ├── errors.ts
│   └── schemas.ts
├── auth/
│   ├── auth-client.ts
│   ├── auth-context.tsx
│   ├── session-storage.ts
│   └── types.ts
├── catalog/
│   ├── cache.ts
│   ├── catalog-context.tsx
│   ├── catalog-repository.ts
│   ├── mappers.ts
│   └── types.ts
├── onboarding/
│   ├── onboarding-context.tsx
│   └── types.ts
├── user/
│   ├── guest-merge.ts
│   └── saved-places.ts
└── app-state.tsx
tests/
├── mobile/
└── mobile-layout.spec.ts
```

### Task 1: Add the mobile API foundation and test harness

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Create: `jest.config.js`
- Create: `jest.setup.ts`
- Create: `lib/api/config.ts`
- Create: `lib/api/errors.ts`
- Create: `lib/api/schemas.ts`
- Create: `lib/api/client.ts`
- Create: `tests/mobile/api-client.test.ts`

**Interfaces:**
- Produces: `getApiBaseUrl(): string`.
- Produces: `apiRequest<T>(path, options): Promise<T>`.
- Produces: `ApiError` with `code`, `status`, `fieldErrors`, and `requestId`.
- Produces: Zod schemas for API envelopes and errors.

- [ ] **Step 1: Install Expo-safe runtime and test dependencies**

Run:

```bash
npx expo install expo-secure-store @react-native-community/netinfo
npm install zod
npm install -D jest jest-expo @testing-library/react-native @types/jest
```

Add the `expo-secure-store` config plugin to `app.json` and preserve every existing Expo setting.

- [ ] **Step 2: Write API client tests**

```ts
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

it("parses a successful data envelope", async () => {
  mockFetchJson(200, { data: { status: "ok" }, requestId: "req-1" });
  await expect(apiRequest<{ status: string }>("/health")).resolves.toEqual({
    status: "ok",
  });
});

it("throws a typed API error", async () => {
  mockFetchJson(401, {
    error: { code: "AUTH_REQUIRED", message: "Sign in required" },
    requestId: "req-2",
  });
  await expect(apiRequest("/api/v1/profile")).rejects.toEqual(
    expect.objectContaining<ApiError>({
      code: "AUTH_REQUIRED",
      status: 401,
      requestId: "req-2",
    }),
  );
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- tests/mobile/api-client.test.ts --runInBand`

Expected: FAIL because the API modules do not exist.

- [ ] **Step 4: Implement environment-aware API configuration**

Require `EXPO_PUBLIC_API_URL` outside development. In development, accept the documented explicit value rather than guessing the host. Normalize one trailing slash away and reject non-HTTP(S) URLs.

Example:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

- [ ] **Step 5: Implement the typed request client**

```ts
type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  sessionToken?: string | null;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T>;
```

Add `Accept-Language`, `Content-Type`, app version, and bearer headers when present. Use `AbortController` with a default `10_000ms` timeout. Parse JSON only for JSON responses and map stable backend errors to `ApiError`.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- tests/mobile/api-client.test.ts --runInBand
npm run typecheck
```

Expected: success, validation, error, timeout, empty-response, and bearer-header tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json jest.config.js jest.setup.ts lib/api tests/mobile
git commit -m "feat(mobile): add typed backend API client"
```

### Task 2: Implement secure mobile session storage and authentication state

**Files:**
- Create: `lib/auth/types.ts`
- Create: `lib/auth/session-storage.ts`
- Create: `lib/auth/auth-client.ts`
- Create: `lib/auth/auth-context.tsx`
- Create: `tests/mobile/session-storage.test.ts`
- Create: `tests/mobile/auth-context.test.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `sessionStorage.get/set/clear`.
- Produces: `signUp`, `signIn`, `signOut`, `changePassword`, and `refreshCurrentUser`.
- Produces: `useAuth()` with `status: "loading" | "guest" | "authenticated"`.

- [ ] **Step 1: Write SecureStore behavior tests**

```ts
it("stores only the opaque token in SecureStore", async () => {
  await sessionStorage.set("opaque-token");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "geovibes.sessionToken",
    "opaque-token",
    expect.objectContaining({
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  );
});

it("clears a rejected session and becomes guest", async () => {
  mockStoredToken("expired-token");
  mockApiError("AUTH_REQUIRED", 401);
  const { result } = renderAuthHook();
  await waitFor(() => expect(result.current.status).toBe("guest"));
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/mobile/session-storage.test.ts tests/mobile/auth-context.test.tsx --runInBand`

Expected: FAIL because auth modules do not exist.

- [ ] **Step 3: Implement SecureStore and auth transport**

```ts
export type AuthUser = {
  id: string;
  username: string;
  role: "user" | "editor" | "admin";
  status: "active";
  preferredLanguage: "ru" | "kk" | "en";
};
```

Native auth requests send `X-GeoVibes-Client: expo-native`; store the returned opaque token in SecureStore before refreshing `/api/auth/me`. Never persist the password or include it in error reporting.

- [ ] **Step 4: Implement `AuthProvider`**

Expose:

```ts
type AuthContextValue = {
  status: "loading" | "guest" | "authenticated";
  user: AuthUser | null;
  sessionToken: string | null;
  signUp(input: CredentialsInput): Promise<void>;
  signIn(input: CredentialsInput): Promise<void>;
  signOut(): Promise<void>;
  refreshCurrentUser(): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
};
```

Startup reads SecureStore once. Network failure with a stored token produces a recoverable loading/error state rather than deleting a possibly valid session. Only an explicit `401` clears it.

- [ ] **Step 5: Compose the provider without breaking splash handling**

Wrap `AppStateProvider` with `AuthProvider`, then update the navigator readiness condition to wait for both local state and auth restoration. Preserve font and splash behavior.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- tests/mobile/session-storage.test.ts tests/mobile/auth-context.test.tsx --runInBand
npm run typecheck
```

Expected: valid restore, expired restore, offline restore, signup, sign-in, sign-out, and password redaction tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/auth app/_layout.tsx tests/mobile
git commit -m "feat(mobile): add secure optional authentication state"
```

### Task 3: Add the API-backed catalog repository and offline cache

**Files:**
- Create: `lib/catalog/types.ts`
- Create: `lib/catalog/mappers.ts`
- Create: `lib/catalog/cache.ts`
- Create: `lib/catalog/catalog-repository.ts`
- Create: `lib/catalog/catalog-context.tsx`
- Create: `tests/mobile/catalog-repository.test.ts`
- Create: `tests/mobile/catalog-cache.test.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `CatalogRepository.listCategories`, `listPlaces`, `getPlace`, and `searchPlaces`.
- Produces: `useCatalog()` and query hooks with loading, ready, stale, empty, and error states.
- Produces: versioned AsyncStorage cache containing only public catalog DTOs.

- [ ] **Step 1: Write fallback-language and offline-cache tests**

```ts
it("shows API fallback text unchanged and records its language", () => {
  const place = mapPlaceDto({
    id: "p1",
    name: "Только русский текст",
    requestedLanguage: "kk",
    contentLanguage: "ru",
  });
  expect(place.name).toBe("Только русский текст");
  expect(place.contentLanguage).toBe("ru");
});

it("returns stale cached catalog after a temporary network failure", async () => {
  await cache.write("ru", cachedCatalogFixture());
  mockNetworkFailure();
  const result = await repository.loadHome("ru");
  expect(result.source).toBe("cache");
  expect(result.stale).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/mobile/catalog-repository.test.ts tests/mobile/catalog-cache.test.ts --runInBand`

Expected: FAIL because catalog modules do not exist.

- [ ] **Step 3: Define public mobile domain types**

Use backend stable IDs and URLs:

```ts
export type CatalogPlace = {
  id: string;
  slug: string;
  name: string;
  description: string;
  requestedLanguage: SupportedLanguage;
  contentLanguage: SupportedLanguage;
  categoryIds: string[];
  coverImageUrl: string;
  latitude: number;
  longitude: number;
  twoGisUrl: string | null;
};
```

Do not use the old `ImageKey` union in API-backed types.

- [ ] **Step 4: Implement a bounded versioned cache**

Cache key format: `geovibes.catalog.v1.<locale>`. Store `{ cachedAt, categories, places }`. Reject malformed entries with Zod, expire after seven days, and cap stored home places to `200`. A cache may be displayed as stale while refresh runs.

- [ ] **Step 5: Implement repository and provider**

Network-first for pull-to-refresh and detail requests; stale-while-revalidate for home/category/list startup. Deduplicate simultaneous identical requests. Keep last good data when refresh fails and expose a non-blocking error.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- tests/mobile/catalog-repository.test.ts tests/mobile/catalog-cache.test.ts --runInBand
npm run typecheck
```

Expected: API mapping, exact human-authored fallback, corrupt cache, stale cache, request dedupe, empty, and retry cases pass.

- [ ] **Step 7: Commit**

```bash
git add lib/catalog app/_layout.tsx tests/mobile
git commit -m "feat(mobile): add API catalog repository and cache"
```

### Task 4: Replace mock catalog reads across public screens

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/list.tsx`
- Modify: `app/category/[id].tsx`
- Modify: `app/search.tsx`
- Modify: `app/space/[id].tsx`
- Modify: `components/ui/category-card.tsx`
- Modify: `components/ui/category-row.tsx`
- Modify: `components/ui/place-card.tsx`
- Modify: `components/ui/place-card-tall.tsx`
- Modify: `components/ui/space-gallery.tsx`
- Create: `components/ui/catalog-error.tsx`
- Create: `components/ui/catalog-skeleton.tsx`
- Create: `tests/mobile/catalog-screens.test.tsx`

**Interfaces:**
- Consumes: catalog hooks from Task 3.
- Produces: API-backed public discovery UI with loading, empty, stale, and retry behavior.

- [ ] **Step 1: Write public-screen behavior tests**

```tsx
it("renders API image URLs and fallback-language content without translating", async () => {
  renderHomeWithCatalog({
    places: [placeFixture({
      name: "Русское название",
      contentLanguage: "ru",
      requestedLanguage: "kk",
      coverImageUrl: "http://localhost:3001/media/p1.webp",
    })],
  });
  expect(await screen.findByText("Русское название")).toBeVisible();
  expect(mockTranslate).not.toHaveBeenCalledWith("Русское название");
});

it("keeps stale catalog visible while showing refresh failure", async () => {
  renderHomeWithStaleCatalog();
  expect(screen.getByText("Operation")).toBeVisible();
  expect(screen.getByText(/couldn.t refresh/i)).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify current mock-data behavior fails**

Run: `npm test -- tests/mobile/catalog-screens.test.tsx --runInBand`

Expected: FAIL because screens still call synchronous mock-data helpers.

- [ ] **Step 3: Update cards and galleries to accept URI-backed images**

Replace `imageKey` props with:

```ts
type CatalogImage = {
  id: string;
  url: string;
  altText: string | null;
};
```

Pass Expo Image sources as `{ uri: image.url }` and stable `recyclingKey` IDs. Preserve current dimensions, typography, and interaction states.

- [ ] **Step 4: Migrate screens one at a time**

For each screen:

1. Replace `getCategories/getPlaces/getSpaceDetail` imports.
2. Render skeleton only when no cache exists.
3. Render cached data during refresh.
4. Render a retry state when neither network nor cache has data.
5. Render a designed empty state for valid empty results.
6. Keep current routes using stable IDs/slugs.

Search uses a debounced `300ms` query, cancels superseded requests, and does not search for trimmed input shorter than two characters.

- [ ] **Step 5: Use 2GIS for external directions**

On place detail, show the directions action only when `twoGisUrl` is a valid HTTPS URL. Confirm `Linking.canOpenURL`, then open it. Do not construct Yandex or Google URLs and do not render an embedded map.

- [ ] **Step 6: Verify migrated public screens**

Run:

```bash
npm test -- tests/mobile/catalog-screens.test.tsx --runInBand
npm run typecheck
npm run test:layout
```

Expected: component tests, TypeScript, and existing mobile layout tests pass.

- [ ] **Step 7: Commit**

```bash
git add app components/ui tests/mobile
git commit -m "feat(mobile): connect public screens to catalog API"
```

### Task 5: Refactor local app state for guest onboarding, interests, and saves

**Files:**
- Modify: `lib/app-state.tsx`
- Create: `lib/onboarding/types.ts`
- Create: `lib/onboarding/onboarding-context.tsx`
- Create: `lib/user/saved-places.ts`
- Create: `lib/user/guest-merge.ts`
- Create: `tests/mobile/app-state.test.tsx`
- Create: `tests/mobile/guest-merge.test.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `useOnboarding()` draft state and completion actions.
- Produces: guest saved-place storage.
- Produces: `mergeGuestDataAfterAuth`.

- [ ] **Step 1: Write migration and no-data-loss tests**

```ts
it("migrates existing savedVenueIds into guest saved place IDs", async () => {
  AsyncStorage.setItem("geovibes.savedVenueIds", JSON.stringify(["1", "2"]));
  const state = await loadLocalState();
  expect(state.guestSavedPlaceIds).toEqual(["1", "2"]);
});

it("does not clear guest saves when server merge fails", async () => {
  saveGuestIds(["p1", "p2"]);
  mockMergeFailure();
  await expect(mergeGuestDataAfterAuth()).rejects.toThrow();
  expect(await loadGuestIds()).toEqual(["p1", "p2"]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/mobile/app-state.test.tsx tests/mobile/guest-merge.test.ts --runInBand`

Expected: FAIL because the migration/merge modules do not exist.

- [ ] **Step 3: Split responsibilities without losing existing state**

Keep `AppStateProvider` responsible for language and durable local compatibility. Move onboarding draft state to `OnboardingProvider`. Move save persistence behind `SavedPlacesStore`.

Use keys:

```ts
const STORAGE_KEYS = {
  onboardingVersion: "geovibes.onboardingVersion",
  language: "geovibes.language",
  guestSavedPlaces: "geovibes.guestSavedPlaceIds",
  guestInterests: "geovibes.guestInterestCategoryIds",
} as const;
```

Migrate the existing `geovibes.savedVenueIds` and `geovibes.hasSeenOnboarding` once; do not delete old keys until the new state has been written successfully.

- [ ] **Step 4: Implement authenticated merge**

```ts
export async function mergeGuestDataAfterAuth(input: {
  sessionToken: string;
  savedPlaceIds: string[];
  interestCategoryIds?: string[];
}): Promise<MergeResult>;
```

Call `/api/v1/profile/merge-guest`. On success, store returned server IDs and then clear the guest merge-pending marker. On failure, retain all local data and expose retry.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- tests/mobile/app-state.test.tsx tests/mobile/guest-merge.test.ts --runInBand
npm run typecheck
```

Expected: old-key migration, guest save toggle, interest persistence, successful merge, failed merge, and duplicate merge tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib app/_layout.tsx tests/mobile
git commit -m "refactor(mobile): separate guest onboarding and saved state"
```

### Task 6: Build the multi-step branded onboarding flow

**Files:**
- Delete: `app/onboarding.tsx`
- Create: `app/onboarding/_layout.tsx`
- Create: `app/onboarding/index.tsx`
- Create: `app/onboarding/language.tsx`
- Create: `app/onboarding/interests.tsx`
- Create: `app/onboarding/account.tsx`
- Create: `components/onboarding/onboarding-progress.tsx`
- Create: `components/onboarding/onboarding-actions.tsx`
- Create: `components/onboarding/selectable-interest.tsx`
- Modify: `app/_layout.tsx`
- Modify: `locales/en.json`
- Modify: `locales/kk.json`
- Modify: `locales/ru.json`
- Create: `tests/mobile/onboarding.test.tsx`

**Interfaces:**
- Consumes: catalog categories, local language state, onboarding context, and auth status.
- Produces: Welcome → Language → Interests → Account Choice flow.

- [ ] **Step 1: Write navigation and skip tests**

```tsx
it("allows interests and authentication to be skipped", async () => {
  const user = userEvent.setup();
  renderOnboardingAt("/onboarding/interests");
  await user.press(screen.getByRole("button", { name: /skip/i }));
  expect(mockRouter.replace).toHaveBeenCalledWith("/onboarding/account");
  await user.press(screen.getByRole("button", { name: /continue as guest/i }));
  expect(mockCompleteOnboarding).toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith("/(tabs)");
});

it("persists language before advancing", async () => {
  renderOnboardingAt("/onboarding/language");
  fireEvent.press(screen.getByText("Қазақша"));
  expect(mockSetLanguage).toHaveBeenCalledWith("kk");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/mobile/onboarding.test.tsx --runInBand`

Expected: FAIL because the multi-route onboarding flow does not exist.

- [ ] **Step 3: Build shared onboarding layout and progress**

Use four numbered progress states with accessible labels. Preserve the current GeoVibes heart, red/pink palette, Oswald display type, and “Кушай. Покупай. Танцуй.” attitude. Keep each screen within safe areas and support 320px width plus dynamic text.

- [ ] **Step 4: Implement welcome and language**

Welcome retains the strongest current visual assets and one primary CTA. Language shows all three languages using their native labels; changing language immediately updates UI strings and persists before navigation.

- [ ] **Step 5: Implement optional interests**

Load published categories from cache/API, allow zero or more selections, show selected state with more than color, and save category IDs. If catalog is unavailable and uncached, allow Skip; never block onboarding on network.

- [ ] **Step 6: Implement account choice and completion**

Offer three actions:

- Create account → `/auth/sign-up?from=onboarding`
- Sign in → `/auth/sign-in?from=onboarding`
- Continue as guest → persist onboarding version and enter `/(tabs)`

Back navigation preserves the onboarding draft. Reopening a completed app goes directly to tabs.

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- tests/mobile/onboarding.test.tsx --runInBand
npm run typecheck
npm run test:layout
```

Expected: step navigation, persistence, skip, offline interests, guest completion, and compact viewport tests pass.

- [ ] **Step 8: Commit**

```bash
git add app components/onboarding lib/onboarding locales tests/mobile
git commit -m "feat(mobile): add purposeful multi-step onboarding"
```

### Task 7: Build signup and sign-in screens

**Files:**
- Create: `app/auth/_layout.tsx`
- Create: `app/auth/sign-up.tsx`
- Create: `app/auth/sign-in.tsx`
- Create: `components/auth/auth-field.tsx`
- Create: `components/auth/password-field.tsx`
- Create: `components/auth/session-banner.tsx`
- Create: `lib/auth/validation.ts`
- Modify: `locales/en.json`
- Modify: `locales/kk.json`
- Modify: `locales/ru.json`
- Create: `tests/mobile/auth-screens.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, guest merge, onboarding completion.
- Produces: accessible username/password signup and sign-in.

- [ ] **Step 1: Write validation and flow tests**

```tsx
it("shows account-recovery limitation before signup submission", () => {
  render(<SignUpScreen />);
  expect(screen.getByText(/account recovery is not available/i)).toBeVisible();
});

it("merges guest data only after authentication succeeds", async () => {
  renderSignUpWithGuestState({ savedPlaceIds: ["p1"] });
  await submitCredentials("new.user", "correct horse battery");
  await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
  expect(mockMergeGuestData).toHaveBeenCalledWith(
    expect.objectContaining({ savedPlaceIds: ["p1"] }),
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/mobile/auth-screens.test.tsx --runInBand`

Expected: FAIL because auth screens do not exist.

- [ ] **Step 3: Implement shared fields and local validation**

Username: `3–30` lowercase/uppercase input characters, then normalize server-side; explain allowed letters `a-z`, digits, dots, underscores.

Password: minimum `10` characters, maximum `256` UTF-8 bytes, show/hide button with accessible state. Signup includes confirmation. Do not add arbitrary composition rules.

- [ ] **Step 4: Implement signup**

Display the no-recovery notice above the final CTA. Map `USERNAME_UNAVAILABLE` to the username field; map all credential/internal failures to localized safe copy. Disable duplicate submit while pending.

After signup:

1. Merge guest saves/interests.
2. If merge fails, show a non-blocking “Sync pending” message and preserve local data.
3. Complete onboarding when `from=onboarding`.
4. Replace route with `/(tabs)/profile`.

- [ ] **Step 5: Implement sign-in**

Use one generic invalid-credentials message. After success, follow the same merge/completion logic. Provide “Continue as guest” when opened from onboarding and a back action otherwise.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- tests/mobile/auth-screens.test.tsx --runInBand
npm run typecheck
npm run test:layout
```

Expected: validation, password visibility, generic errors, no-recovery copy, loading, successful merge, failed merge, guest escape, and compact keyboard layout cases pass.

- [ ] **Step 7: Commit**

```bash
git add app/auth components/auth lib/auth locales tests/mobile
git commit -m "feat(mobile): add username password account screens"
```

### Task 8: Integrate authenticated profile, saves, interests, and settings

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Modify: `components/ui/bookmark-button.tsx`
- Create: `lib/user/profile.ts`
- Modify: `lib/user/saved-places.ts`
- Create: `components/auth/guest-profile-card.tsx`
- Create: `components/auth/account-card.tsx`
- Create: `tests/mobile/profile-settings.test.tsx`
- Create: `tests/mobile/saved-places.test.tsx`

**Interfaces:**
- Consumes: auth state, profile API, saved-place API, guest store, and catalog cache.
- Produces: guest/authenticated profile variants and synchronized bookmark behavior.

- [ ] **Step 1: Write guest and authenticated profile tests**

```tsx
it("shows account invitation without blocking guest saved places", () => {
  renderProfile({ authStatus: "guest", guestSavedIds: ["p1"] });
  expect(screen.getByText(/create an account/i)).toBeVisible();
  expect(screen.getByText(placeFixture("p1").name)).toBeVisible();
});

it("uses an idempotent server save for authenticated users", async () => {
  renderBookmark({ authenticated: true, saved: false });
  fireEvent.press(screen.getByRole("button", { name: /save/i }));
  await waitFor(() =>
    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/v1/saved-places",
      expect.objectContaining({ method: "PUT" }),
    ),
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/mobile/profile-settings.test.tsx tests/mobile/saved-places.test.tsx --runInBand`

Expected: FAIL because profile still assumes only local saves and has no auth variants.

- [ ] **Step 3: Implement one saved-place facade**

```ts
type SavedPlacesController = {
  ids: string[];
  pendingIds: string[];
  isSaved(id: string): boolean;
  toggle(id: string): Promise<void>;
  retryPending(): Promise<void>;
};
```

Guests mutate AsyncStorage. Authenticated users use idempotent server endpoints and update local state optimistically; rollback a rejected mutation and queue network failures for retry.

- [ ] **Step 4: Implement profile variants**

Guest profile retains local saved-place display and adds a tasteful account invitation with Create account and Sign in actions.

Authenticated profile shows editable public username, preferred language, interests, synchronized saved count, and sign-out. Do not show role unless the user is staff, and never expose admin navigation in the mobile app.

- [ ] **Step 5: Update settings**

Keep language selection. Add authenticated Change password and Sign out actions. Add editable interests for both guests and authenticated users. Remove any UI implying catalog content can be edited.

On sign-out:

1. Revoke/clear the session.
2. Clear private cached profile data.
3. Preserve public catalog cache.
4. Return to guest profile.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- tests/mobile/profile-settings.test.tsx tests/mobile/saved-places.test.tsx --runInBand
npm run typecheck
npm run test:layout
```

Expected: guest/auth variants, optimistic save success/failure, retry, username conflict, interests, password change, sign-out, and public-cache preservation pass.

- [ ] **Step 7: Commit**

```bash
git add app components lib/user tests/mobile
git commit -m "feat(mobile): sync profiles interests and saved places"
```

### Task 9: Remove mock runtime dependencies and complete mobile regression coverage

**Files:**
- Delete: `lib/mock-data.ts`
- Modify: all remaining imports found by `rg "mock-data|ImageKey|getPlaces|getCategories|getSpaceDetail" app components lib`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `tests/mobile-layout.spec.ts`
- Create: `tests/mobile/authenticated-journey.test.tsx`
- Create: `tests/mobile/offline-journey.test.tsx`

**Interfaces:**
- Produces: no runtime mock catalog source of truth.
- Produces: documented local backend URL setup and guest/account test journeys.

- [ ] **Step 1: Prove no runtime mock dependency remains**

Run:

```bash
rg -n "mock-data|ImageKey|getPlaces|getCategories|getSpaceDetail" app components lib
```

Expected before deletion: output identifies every remaining migration site. Add a test that fails if production source imports `lib/mock-data`.

- [ ] **Step 2: Replace remaining mock imports and delete the file**

Use catalog repository fixtures only in tests. Keep committed static imagery used by onboarding/branding; removing mock catalog code does not require deleting brand assets.

- [ ] **Step 3: Add complete guest and account journey tests**

Guest journey:

1. Welcome
2. Choose language
3. Skip/select interests
4. Continue as guest
5. Browse cached/API catalog
6. Save a place locally
7. Reopen and confirm persistence

Account journey:

1. Start with guest save
2. Create account
3. Merge save
4. Change username/interests
5. Sign out
6. Confirm public browsing still works

Offline journey:

1. Prime catalog cache
2. Disable network
3. Reopen app
4. Browse cached places
5. Show stale state
6. Preserve queued personal changes

- [ ] **Step 4: Document local configuration**

Update the root README with:

- Starting `backend/`
- `EXPO_PUBLIC_API_URL` for Android emulator, iOS simulator, and physical device
- Running Expo separately from backend
- Guest vs authenticated behavior
- Lack of account recovery in version one
- No public catalog editing

- [ ] **Step 5: Run full mobile verification**

Run:

```bash
npm test -- tests/mobile --runInBand
npm run typecheck
npm run test:layout
npx expo export --platform web
```

Expected: all commands exit `0`; no production mock-data import remains; web export completes.

- [ ] **Step 6: Review the complete repository**

Run:

```bash
git diff --check
git status --short
rg -n "yandex|auto.?translat|catalog.*(edit|update|delete)" app components lib
```

Expected: no accidental Yandex integration, automatic translation, or public catalog mutation UI is present. Any matches are reviewed and limited to explanatory copy/tests.

- [ ] **Step 7: Commit**

```bash
git add app components lib locales tests README.md package.json package-lock.json app.json
git commit -m "test(mobile): complete guest and authenticated journeys"
```

## Mobile Plan Completion Gate

Run with the backend completion gate already passing:

```bash
npm test -- tests/mobile --runInBand
npm run typecheck
npm run test:layout
npx expo export --platform web
cd backend
npm test
npm run typecheck
npm run build
```

The mobile plan is complete only when first launch supports the approved four-step onboarding, guests can browse and save without authentication, username/password accounts use SecureStore sessions, guest data merges without loss, the catalog is API-backed with offline cache, fallback text remains human-authored and unchanged, and the public app contains no catalog editing capability.
