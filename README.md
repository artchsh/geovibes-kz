# GeoVibes — Project Notes & Findings

*Summarised from a long brainstorm session, May 2026*

-----

## The Core Idea

A curated, native mobile app for discovering quality places in Almaty (and eventually other cities). Not a directory like 2GIS, not a cluttered feed like Instagram — a **taste-maker** with a strong point of view. Filtered by category, designed with care, with context that actually helps you decide (vibe, safety, district, price range).

**Tagline:** Кушай. Покупай. Танцуй.
**Name:** GeoVibes
**Logo:** 3D red heart with a carabiner through a hole in the top right corner (designed with designer colleague)

-----

## What Makes It Different from Competitors

- **2GIS** — utility tool, proximity-based, no curation, no quality signal
- **Instagram** — discovery is chaotic, no structured info, no safety context
- **Yandex Maps** — same problem as 2GIS, removes negative reviews (confirmed pay-to-win issues)
- **GeoVibes** — curated, opinionated, context-rich, designed beautifully

-----

## Target Audience

Young people in Almaty looking for:

- Nice places to eat
- Places to hang out
- Event venues
- Nightclubs / bars / cocktail spots
- Artistic and cultural spaces

Usage pattern: **not daily** — more like once a week or monthly when planning something. Design should reflect this — fast to open, fast to find what you need, no gamification or streaks needed.

-----

## Design

- Already partially designed in Figma
- Strong visual identity — feels premium, not generic
- Category chip/pill row for fast filtering
- Featured card with large photo
- “Кушай. Покупай. Танцуй.” tagline with real attitude
- Bottom nav — clean, not overcrowded
- “Suggest a place” flow included

### Screens Still Needed

- Dedicated category page (main page filtering not enough at scale)
- Search results page
- Business-side flow (separate mini-app within Figma)

### Design Philosophy

“Want to taste it” — interfaces that feel crafted, tactile, considered. Not AI slop. Every animation intentional, every transition smooth.

### Timeline

Estimated 1–2 months to finish design depending on availability.

-----

## Features

### Free Users

- Browse all curated places
- Category filtering
- Place detail pages (photos, description, safety context, district info)
- Deep link to Yandex Maps for navigation

### Premium Users

- Full in-app map (OpenStreetMap tiles via Mapbox or Maptiler)
- Yandex Maps deep link for routing
- **Evening Planner** — build a multi-stop night out, set rough times, share via link (no app required for viewers to see the plan)

### Planned / Future

- “Popular this week” tag — manually curated by you at first, automated later
- Average busy hours per venue — hard at v1, design placeholder now, implement later
- “#1 pick” per category — GeoVibes editorial choice, powerful curation signal
- User-generated local lists (private by default, shareable via export code) — for later, addresses sensitive use cases without liability

### Deliberately Not Building

- In-app messenger (too many messengers already)
- Algorithmic feed
- Gamification / streaks
- Sponsored rankings (corrupts curation)

-----

## The Queer-Friendly Layer

Originally planned as a secret weekly rotating code that unlocks a filtered view of queer-friendly venues. After discussion, key risks identified:

- Screenshots bypass code security
- Second phone bypasses screenshot blocking
- Database itself is liability even if UI shows nothing
- No active central queer organisation in Almaty to partner with for data hosting

**Current decision:** Shelved for v1. May return in a different form — possibly as user-generated private local lists (shared via encrypted export code, never stored on your servers). Legal consultation required before revisiting.

-----

## Monetisation

### User Subscriptions

- Monthly: ~2,990–3,000₸
- Annual: ~19,990₸ (show monthly equivalent to make it feel obvious)
- Lifetime: ~44,990₸ (must be significantly more than annual or nobody subscribes annually)

### B2B (Main Revenue)

Businesses pay for enhanced profiles. Tiers roughly:

- **Free** — basic listing, claimable by owner
- **Paid** — extended photo gallery, digital menu (PDF → structured digital menu, strong differentiator for Almaty), analytics on profile views, reservation link (probably just a WhatsApp deep link for now)

No sponsored rankings. Ever. Businesses pay for better profiles, not higher placement.

### Notes

- App Store takes 30% (check Small Business Program for 15% — applies under $1M annual revenue, verify Kazakhstan eligibility)
- Google Play takes 30% similarly
- Price in tenge, not dollars — psychological difference matters locally

-----

## Go-To-Market

### Phase 1 — Before Launch

- Build Figma prototype to a shareable state
- Show to 5–10 real people, watch them use it
- Talk to 1–2 venue owners you already know (artistic/cultural spaces most receptive)
- “Are you a venue? Get listed early” — capture leads passively

### Phase 2 — First Venues

- Start with places where you know the owner or manager personally
- Offer free listing with limitations to early partners
- Let social proof do the work — if one visible cool place is in, others want in
- Use extrovert friends (boyfriend, work friends) for outreach you find draining

### Phase 3 — Launch

- Wishlist / waitlist page live
- App Store + Google Play
- Social accounts active

-----

## Localisation

Three languages from day one:

- **Russian** — you handle this
- **Kazakh** — get a native speaker to review all UI strings, do NOT use AI translation, do NOT launch without it (Aleem got publicly criticised for this)
- **English** — you handle this

-----

## Tech Stack

- **React Native** (decided)
- **OpenStreetMap** tiles via Mapbox or Maptiler for map view
- **Yandex Maps** deep link for routing (right call for Almaty — nobody uses Google Maps for navigation here)
- Image/file hosting — cheap short term, budget for long term costs

-----

## Accounts & Infrastructure Checklist

|Item                               |Status                  |Notes                                                                  |
|-----------------------------------|------------------------|-----------------------------------------------------------------------|
|Proton email (geovibeskz@protonmail.com)|Done               |Use for all registrations                                              |
|Instagram handle                   |Done                    |Claim now even if no posts yet                                         |
|Telegram channel                   |To do                   |Claim now                                                              |
|geovibes.kz domain                 |To do when budget allows|~10,000₸/year via ps.kz — priority domain                              |
|geo-vibes.com                      |Skip                    |Hyphen awkward to say out loud                                         |
|geovibes.com.kz                    |Skip                    |Looks outdated                                                         |
|Apple Developer Account            |To do at launch         |$99/year, separate Apple Account recommended, individual not org for v1|
|Google Play Console                |To do at launch         |$25 one-time, regular Google account fine                              |
|Landing / wishlist page            |To do soon              |Can use 1410555.xyz temporarily                                        |

-----

## Competitive Research Notes

### Aleem (language learning app)

- Topped App Store in Kazakhstan, Kyrgyzstan, Tajikistan days after launch
- 250k users in 2 weeks, no outside investment
- Retention twice market average without any gamification
- **Criticism:** No Kazakh language at launch (later added), dark patterns on subscription screen (fake 50% off, delayed close button), laggy animations, broken chat interactions, A1 level onboarding ignored in actual lesson difficulty
- Lesson: commercial success ≠ technical/design quality. Also: always launch with Kazakh.

### 2GIS

- Good for traffic and bus routes
- New flash card feature for nearby places — proximity based, no quality signal
- “Here are 47 places near you” is not curation

-----

## Lessons From Previous Projects

**Pet shelter app** — killed by underestimating operational load as solo founder. Required constant social media content (Instagram posting, unusual facts, etc.) which led to burnout within a week. Good idea, wrong execution model.

**Budget calculator app** — fun learning project, not meant to be a business. Still in development. Taught React Native basics.

**Key insight:** This project has similar burnout risk if you’re the single point of failure for content. Mitigation: let businesses update their own profiles, let users suggest edits, keep your editorial role to curation not data entry.

-----

## The Informal Team

- **You** — product, design, tech, business pitching
- **Boyfriend** — research, soft outreach, network mapping, finding venue contacts
- **Designer colleague** — UI/UX support, place discovery help

Don’t formalise equity or titles yet. Build together, see who stays engaged when it gets hard, figure out compensation later.

-----

## Open Questions / Still To Decide

- Average busy hours data source (Google Places API costs money, self-reported is biased, check-ins need critical mass)
- Exact Kazakh language reviewer — find before launch
- Legal consultation on platform liability under Kazakhstani law before adding any user-generated content features
- Whether to do TestFlight beta before public launch (recommended — yes)
- SEO / AEO strategy for landing page post-launch

-----

## Mindset Notes

- Usage is weekly/monthly not daily — design for fast retrieval not habit formation
- You have real taste. “Want to taste it” is a legitimate design philosophy, protect it from scope creep and time pressure
- The shareable evening plan link is your organic marketing engine — it spreads the app without Instagram posting
- Don’t let the logo, the name, or pricing block you from finishing the design
- Perfectionism is your known risk. Set a finish line for design (checklist of screens) and commit to it.

-----

*Last updated: May 2026*