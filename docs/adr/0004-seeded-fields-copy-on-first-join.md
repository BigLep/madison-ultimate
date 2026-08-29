# Seeded fields copy into the signup row on first Final Forms join, without Save

Status: accepted (2026-08-29)

The Signups sheet is the system of record for profile and contact info (ADR 0002). Final Forms still has useful values for those fields at the moment we first match a player, and a family should not have to click “Use it” or Save to keep them. We decided: **on first Final Forms join only**, copy every empty Seeded Field (grade, student personal/SPS email, student cell phone, caretaker 1 and 2 name/email/phone) into the signup row immediately, in the same write as `spsStudentId` (and Photo Carryover, ADR 0003). The family can edit or clear any copied value afterward. After the join is established we never copy those fields again, even if a cell is later empty. We never overwrite a cell that already has a value.

A real join is established by writing `spsStudentId` onto the row. Magic-name test fixtures never write `spsStudentId`, so “every seed column is still empty” stands in for first join.

## Considered options

- **Show Final Forms values as “use it” hints until the family accepts** (the original ADR 0002 UI). Rejected: if we have the data we should persist it. A family that never clicks Save would otherwise leave the row without contact info we already knew.
- **Copy into empty cells on every Final Forms GET.** Rejected: it refills a field the family deliberately cleared. After join, empty means empty.
- **Wait for profile Save to persist the copy.** Rejected: Save is not a gate on whether we keep contact info we already have from Final Forms. (Eligible emails are also auto-subscribed on that first join; see mailing-list rules in `DESIGN.md`.)
- **Continuous re-sync from Final Forms.** Already rejected in ADR 0002: two writers for one field, and families would have to edit contact info inside Final Forms (impossible in spring).

## Consequences

The first-join write is the one moment contact data flows from Final Forms onto our row; later visits only read Final Forms Status live. That same first real join auto-subscribes eligible emails now on the row (caretakers and student personal, never SPS) unless they have already opted out of Buttondown. Magic-name fixtures never touch the real list. Caretaker 2 is always on the form (optional) so a copied Parent 2 has somewhere to live. Clearing a seeded field after join is permanent unless the family types something else.

Implementation: `GET /api/signup/player/[playerId]/finalforms`. Glossary: `CONTEXT.md` (Seeded Field, Final Forms Join, Final Forms Status). Boundary with live status: ADR 0002. Photo analogue: ADR 0003.
