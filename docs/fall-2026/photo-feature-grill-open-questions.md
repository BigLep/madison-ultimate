# Player Photo Feature: Open Questions (Round 3)

Follow-up to the existing photo upload pipeline (`PhotoUpload.tsx` -> `POST /api/signup/player/[playerId]/photo` -> `uploadPlayerPhoto` in `google-oauth-drive.ts`), grilled 2026-08-28/29. Facts and decisions already settled are listed first for context; only the items under "Open questions" still need a call.

## Settled so far

- **Filename identity**: keep `${playerId}.${ext}` as the real Drive filename (never changes, never collides). A human-readable label like "John Doe.jpg" is generated on demand at display/export time, never used as the actual stored filename. Confirmed.
- **Removed-photo archive location**: a `Removed/` subfolder inside the existing `PHOTOS_FOLDER_ID` folder, not a separate top-level folder. Confirmed.
- **Photo is optional, shown for everyone**: independent of media opt-out (already spec'd; not new scope).
- **Parents can already revisit and edit**: `/player/$playerId` is a persistent, editable page, not a one-shot form. Not new scope.
- **Last year's source confirmed to exist**: Fall 2025 photos live in a Drive folder (https://drive.google.com/drive/folders/1ojyCLPVl_kzpZW8MOkY3wmDG2XQdLcUOAumoNNtjo19KaYkGRdbU_PGLAzufBiAHz_ATafR6), referenced from the Fall 2025 roster sheet (`1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8`), column AQ. Still need to inspect that column's actual contents (file ID? Drive URL? filename?) and confirm the join key (spsStudentId or similar) before this can be implemented.
- **Delete UX direction**: "keep it simple, allow replace" (feedback on Q7). Self-service confirmed in spirit, but the shape narrows to the existing replace-in-place upload rather than a dedicated "remove my photo" button. Open question below on what this means for the archive idea.

## Decisions (round 3, via Plannotator)

### Archiving: dropped for now

No `Removed`/archive step on replace or delete. Keep it simple: a new upload just overwrites in place, same as today's behavior. If archiving is revisited later, the folder should be named `Archived`, not `Removed`.

### Fall 2025 carryover source and join key: confirmed

- Column AQ in the Fall 2025 roster sheet (`1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8`) holds a Drive direct-view URL of the form `https://drive.google.com/uc?id=<fileId>`; the file id is extractable with a simple regex.
- Column B in that same sheet is `StudentID`, the join key, matches this year's `spsStudentId`.
- Still to verify (not yet done): confirm via `gog` that this pattern holds across all populated rows, not just the one example given.

### Carryover trigger: automatic

Confirmed: pull last year's photo automatically the moment a new signup row is created/matched to a returning player (via the StudentID/spsStudentId join), skipping it whenever the player already has a current-year photo.

### HEIC/preview: no conversion, keep it simple

Skip HEIC-to-JPEG conversion entirely (client- or server-side). Instead: render inline when the browser can handle it natively (e.g. Safari), and otherwise fall back to a plain link that opens/downloads the original file in a new tab. No new dependency, no upload-time processing step.
