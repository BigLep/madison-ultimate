# Player photo carryover and HEIC handling stay copy-once and conversion-free

Status: accepted (2026-08-29)

The existing photo upload pipeline (`PhotoUpload.tsx` -> `photo/route.ts` -> `uploadPlayerPhoto`) had no preview anywhere in the UI and no way to bring forward a returning player's photo from last season. We decided two things. First, **Photo Carryover** fires automatically the moment a signup row is matched to a returning player by SPS Student ID, copying that player's Fall 2025 photo into this season's Drive file, and never overwrites a Player Photo the family has already set for the current season. Second, HEIC files (the default format for iPhone photos) get no conversion step anywhere in the pipeline: they display inline where the browser supports it and fall back to a plain download link otherwise.

## Considered options

- **Rely on the Google Drive API to convert or preview HEIC.** Rejected: `thumbnailLink` is undocumented for HEIC and, even where it happens to work, is short-lived (hours) and requires the viewer to already have Drive access to the file, unsuitable for a link opened by parents who were never signed into the club's Drive. `files.export` only converts native Google Docs/Sheets/Slides, never an uploaded binary. `webContentLink` returns the original HEIC bytes unconverted. No Drive API path produces a stable, browser-renderable JPEG from an uploaded HEIC file.
- **Convert HEIC to JPEG ourselves, client- or server-side, at upload time.** Rejected for now: it adds a new dependency (a client-side decoder, or `libheif`/`sharp` on the server) and a real processing step, for what is otherwise a cosmetic preview. Simplicity won over completeness; can be revisited if the link-fallback proves annoying in practice.
- **On-demand carryover**, a "Use last year's photo" button the family has to click, instead of automatic. Rejected: it adds a UI decision point to a feature whose whole point is removing friction for returning families, and the never-overwrite rule already protects anyone who'd rather upload something new.
- **Archive prior photos on replace, in a `Removed`/`Archived` Drive folder.** Rejected: no delete endpoint exists yet, and the round-3 grill session chose to keep replace-in-place exactly as it works today rather than build an archive step now.

## Consequences

Photo Carryover is the only place Drive content flows from one season into the next; every other part of the signup row starts empty by design for season-portability (see ADR 0002). It depends on the Fall 2025 roster sheet (`1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8`) keeping an SPS Student ID in column B and a `drive.google.com/uc?id=...` URL in column AQ; if either is missing or malformed for a given row, that player just gets no carried-forward photo, nothing fails loudly. HEIC photos a browser can't render inline (most non-Safari browsers today) show as a download link rather than a preview; that's an accepted rough edge, not a bug to chase. Revisiting either rejected option later (adding conversion, adding an archive folder) is a forward-compatible addition: neither changes what the `Photo Drive File ID` column means.

Glossary: `CONTEXT.md` (Player Photo, Photo Carryover); decision record: `docs/fall-2026/photo-feature-grill-open-questions.md`.
