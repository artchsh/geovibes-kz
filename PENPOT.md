# PENPOT.md — GeoVibes Design Tracking

Tracks the state of the GeoVibes app design in **Penpot** (migrated from Figma). Project context lives in [README.md](./README.md); this file tracks **what is designed, what is missing, and how the file is organised**.

> App in one line: a curated, opinionated mobile app for discovering quality places in Almaty. React Native. RU / KK / EN. Tagline **«Кушай. Покупай. Танцуй.»**

_Last updated: 2026-07-27_

---

## App build status (Expo RN app in repo root)

Screens are implemented in the Expo app by Codex from these Penpot designs. See [MEMORY](../.claude) notes for stack.

| Canonical screen | App route | Status |
|---|---|---|
| Main View (Home) | `app/(tabs)/index.tsx` | ✅ Built — real images, category pills = in-place filter |
| Category View | `app/category/[id].tsx` | ✅ Built — reusable `PlaceCardTall`, rating/bookmark/back |
| Space view | `app/space/[id].tsx` | ✅ Built — gallery, quick actions, «Что внутри» |
| Onboarding view | `app/onboarding.tsx` | ✅ Built — wordmark, tagline, ИСКАТЬ CTA → tabs, phone mockup |
| Categories List View | `app/(tabs)/list.tsx` | ✅ Built — heading + 5 category rows (`CategoryRow`) → Category View |

**All 5 canonical screens implemented.** Fully navigable: Onboarding → Home (filter) → Category View → Space view; List tab → Categories List → Category View → Space view.

> Build note: have Codex run **only `tsc`** for verification — an in-repo `expo export` temp dir once crashed the running dev server's file watcher (ENOENT). Do bundle verification separately into an **out-of-repo** temp dir.

Images: all 11 exported to `assets/images/` and optimized (9.9 MB → 727 KB). Registry: `lib/images.ts`.
Profile/Settings tabs are out of scope (placeholders).

---

## How to work with this design (Penpot MCP)

- Design is edited live via the **Penpot MCP Plugin** → the file must be open in Penpot with the plugin running and **connected** (exactly **one** instance connected — two instances error out).
- Tools: `execute_code` (Plugin API JS), `export_shape` (render PNG/SVG to see it), `import_image`, `penpot_api_info`.
- Full-screen PNG exports of tall boards (>~850px) sometimes time out (30s) — export smaller sub-shapes or retry sequentially, not in parallel.

## File structure

Two pages: **Mobile concept** (all app screens + scaffolding) and **Components**.

On **Mobile concept**, real screens sit at top level; the rest are working boards:

| Board | Role |
|---|---|
| `Main View`, `Onboarding view`, `Categories List View`, `Category View`, `Space view` | **Canonical app screens** (393px wide) — the only shipping design |
| `New components` | New-era reusable components (AppBar, place cards, tags, filters, Frame 30, Group 12) |
| `Old components` | **IGNORE** — reference/inspiration only, never edit |
| `old work` | **IGNORE** — old 390px drafts (Profile, Settings, Operacionnaya, "Add new restaurant"), reference/inspiration only |
| `References`, `Assets` | Mood/reference imagery and raw assets — not screens |

> **Scope directive (user, 2026-07-27):** Only the **5 canonical 393px screens** are in scope. `old work` and `Old components` are **reference/inspiration only** — do not edit or count them as deliverables. Anything previously done there (e.g. the AppBar nav fix touched old-work instances) is not the shipping design.

---

## Screens — implemented

### Current era (393px, top-level, shippable direction)

| Screen | Purpose | Status | Notes |
|---|---|---|---|
| **Onboarding view** | Splash / intro. Logo, «Наша Разница В Вайбе», tagline «Кушай. Покупай. Танцуй.», ИСКАТЬ CTA | ✅ Verified | Single onboarding board (no multi-step carousel yet) |
| **Main View** | Home / discovery. Search bar, `vibe filters` category pills, featured «ПОПУЛЯРНОЕ» card, «Все vibe места» list | ✅ Verified | The primary screen |
| **Categories List View** | Browse all categories with tagline blurbs (Коктейли, Бургеры, DJ/Disco, Одежда, Украшения) | ✅ Verified | |
| **Category View** | Places within a category — place cards, rating pills, bookmark buttons, featured tag, back button | ✅ Verified | = README's "Dedicated category page" |
| **Space view** | Place/venue **detail** — Header, gallery w/ carousel, «Что внутри», Маршрут/Позвонить/Поделиться, Save | ✅ Verified | "Space" = a venue |

> `old work` screens (Profile, Settings, Operacionnaya, "Add new restaurant" flow) are **out of scope** — reference only, not deliverables.

---

## Screens — still needed

From README "Screens Still Needed" + feature list, cross-checked against the file:

All out-of-scope drafts in `old work` count as **reference only**, not progress. Each item below is a fresh 393px screen to design.

| Needed | Priority | Notes |
|---|---|---|
| **Search results page** | 🔥 High | Main View has a search bar but no results screen — top core gap |
| **Profile (393px)** | Med | `old work` Profile is reference only |
| **Settings (393px)** | Med | `old work` Settings is reference only |
| **Business-side "add a place" flow (393px)** | Med | `old work` "Add new restaurant" (5 steps) is reference only |
| **Subscription / paywall** | Med | Monthly / Annual / Lifetime tiers (README monetisation) |
| **Map view (Premium)** | Low | OSM tiles via Mapbox/Maptiler |
| **Evening Planner (Premium)** | Low | Multi-stop night-out builder + shareable link — key growth feature |

Deliberately **not** building (README): in-app messenger, algorithmic feed, gamification, sponsored rankings.

---

## Audit log

**2026-07-27 — post-migration structural + visual QA of the 5 canonical screens:**
- No collapsed layouts remain (the AppBar nav was the only structural casualty; fixed earlier).
- "Overflow" flags are **intentional**: horizontally-scrolling filter pill rows on Main View, and the phone mockup bleeding off-canvas on Onboarding.
- All 5 screens render correctly (exported & eyeballed). Nav bar correct on each.
- **Content placeholders** (not bugs, need real assets later): Category View place cards use a green-smiley placeholder image; venue names/photos are dummy («Кооператив "Любовь"», «Операционная»).
- Minor to confirm: bookmark uses a crossed-pin glyph in the category list (intended "not saved" state?).

---

## Component / design-system inventory

**Components page:** `filter`, `place`, `tag`, `AppBar`.
**New components board:** `AppBar`, `place cards`, `tags`, `filters`, `Frame 30`, `Group 12`.
**Local library components:** Group 12, AppBar (variants), Logo, filter, tags, place, tag, Frame 30, place cards.

Recurring UI atoms seen on screens: category/vibe pills, place cards, rating pill, bookmark/save button, featured/category tags, back button, AppBar (bottom nav).

---

## Known issues & notes

- ✅ **Bottom nav (AppBar) fixed** (2026-07-27). Figma→Penpot import had converted the inner nav row (`Frame 13`) into a grid with 1px tracks, collapsing every bar to ~36×9. Fixed: `Frame 13` → flex row (`row-reverse`, space-between, centered); all **8 screen instances** restored to a floating pill bar **~358–361×54**, inset 16px, at the bottom; **4 variant mains** (Home/List/Profile/Settings active) normalised to 361×54.
- ⚠️ **`Operacionnaya` is duplicated** — two identical boards stacked at the same position in `old work`. Candidate for deletion (not yet removed — awaiting confirmation).
- ⚠️ **Two width standards** — current 393px vs old 390px. Standardise when porting old screens.
- 🎨 AppBar style: dark `#1a1a1a`, 24px corner radius, floating (inset), active tab shows a white label pill (e.g. «Главная», «Профиль», «Настройки»).

## Next actions (suggested)

1. Decide fate of duplicate `Operacionnaya` board.
2. Design **Search results** screen (highest-value missing core screen).
3. Port **Profile / Settings** to current 393px style.
4. Redesign **business-side "add a place"** flow in current style.
5. Scope **paywall**, **map**, and **Evening Planner** (premium) screens.
