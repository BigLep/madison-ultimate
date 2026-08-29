# Signups sheet as season intake and system of record for player info

Status: accepted (2026-08-26)

Player and family info used to arrive through a Google Form (retired: file upload forced Google sign-in, no prefill, duplicate-submission mess) and Final Forms (school-owned, painful for families to edit, and absent entirely in spring, when registration is DiscNW instead). We decided the webapp-owned **"2026 Fall Signups" spreadsheet** is the single intake and system of record for player profile and contact info, feeding both the coach sheet (joined by PlayerID/spsStudentId, replacing the fragile exact-Full-Name join) and, in Phase D, the portal's Player Info screen: what the family entered is what the player sees.

The boundary with Final Forms follows one rule with two halves: **Final Forms Status** (signatures, clearance, physical) is always read live from the newest export and never copied, because Final Forms is the only place a family can change it; **Seeded Fields** (grade, student email/phone, caretaker names/emails/phones) are copied into empty signup-row cells on first join only (ADR 0004), then owned by our row forever after and never re-synced. A family can edit or clear any copied value; later visits do not refill empty cells.

## Considered options

- **A tab in the coach workbook instead of a separate spreadsheet.** Rejected: the separate sheet limits the webapp's write blast radius, matches the role the Form Responses sheet played in 2025, and the coach workbook is rebuilt every season while signup data must outlive that rebuild.
- **Continuous re-sync of contact fields from Final Forms.** Rejected: two writers for one field guarantees conflicts, families would have to edit contact info inside Final Forms (annoying, and impossible in spring), and stale overwrites would silently undo family corrections. Copy-into-empty on first join makes our row authoritative; later visits never refill.
- **Show Final Forms values as "use it" hints until the family accepts.** Rejected in ADR 0004: if we have the data we persist it on first join without waiting for Save.

## Consequences

The signup row is season-portable: spring reuses the same shape with no Final Forms at all, the seeded fields just start empty. Fixing wrong contact info means editing at /signup, never in Final Forms. Roster rows are populated by an append-only "Sync players from Signups" menu function (never rewriting existing rows). The coach sheet's Additional Info Full-Name join, the Full Name Diff chore, and the Google Groups mailing-list join all retire. Glossary: `CONTEXT.md` (Seeded Field, Final Forms Status); when Seeded Fields are copied: `docs/adr/0004-seeded-fields-copy-on-first-join.md`; decision record: `docs/fall-2026/signup-grill.md` (Q6-Q7, Q20) and `docs/fall-2026/signup-plan.md` sections 4-5.
