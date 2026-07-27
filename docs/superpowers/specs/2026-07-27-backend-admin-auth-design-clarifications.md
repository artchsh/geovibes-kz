# Backend Design Clarifications

This file is a normative companion to
`2026-07-27-backend-admin-auth-design.md`.

## Draft and published revisions

Places and categories have separate draft and published revisions. The public
API reads only the published revision while staff edit the draft revision.
Publishing validates and atomically promotes the draft. Existing published
content remains live until promotion succeeds. Archiving removes the entity
from public results without deleting its revisions or audit history.

Translations, category assignments, media ordering, location data, and other
editable catalog fields belong to revisions. Each revision with translations
selects a primary content locale.

## Translation fallback

Translation selection is deterministic:

1. Return the requested human-authored locale when present.
2. Otherwise return the revision's primary human-authored locale unchanged.
3. For legacy data without a valid primary locale, return the first available
   locale in the fixed order Russian, Kazakh, English.
4. Include the returned language code as `contentLanguage`.

No fallback step generates or automatically translates text.
