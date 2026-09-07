# Seed Signups from Final Forms: design grill, round 1

Date: 2026-09-07. Answer inline; each question carries a recommended answer marked ➡️.

Facts from the code that shape the questions:

- The portal has no single "profile complete" today. It has per-section checklist checks: Player Info requires 9 fields (grade, elementary school, pronouns, gender, allergies, competing sports, jersey, playing experience, hopes), Caretaker Info requires Caretaker 1 name and email, Photo is required as of round 3, and the two volunteering sections count any answer. The spec's "Required" column is a different, looser set (grade, jersey, caretaker 1 name and email). The coach sheet's Profile Complete is a third set (grade, DOB, caretaker 1 email).
- Player Lookup matches normalized last name plus full birthdate. Preferred name only disambiguates twins, by longest shared prefix. A seeded twin whose preferred name shares no leading letters with the legal name (Bella for Isabella, next to Isaac) would not be found and the family would hit the near-match warning.
- A seeded row already has SPS Student ID, so a family's first visit to it runs no first-join side effects. Seeded Fields the family clears stay cleared, as ADR 0004 intends.
- Analyze Signups section 2 is "Final Forms student ID on no signup row". That set includes Backfill cases (a family-created row that simply has not joined yet), so it is a superset of what should be seeded.
- Gender Identification is listed in the spec as seeded from Final Forms Gender, but the code never reads gender from the export. Seeded rows will have it empty. Treated as out of scope unless you say otherwise.
- No middleware exists today; nothing gates `/admin` or `/api/admin`.

## Q1: Input source

Seeding reads the newest Final Forms export from Drive directly (the same snapshot Backfill uses), not the coach sheet's Analyze Signups tab. Records with no last name or no birthdate can never be reached by Player Lookup. Seed them anyway, or report them as unseedable?

➡️ Read the Drive export directly. Do not seed records missing last name or birthdate; list them in the report as "unseedable, fix in Final Forms".

## Q2: Duplicate guard rule

Group both sides by normalized last name plus birthdate, and decide per group:

- Final Forms student ID already on a signup row: skip (already joined).
- One Final Forms record, zero unjoined signups in the group: seed.
- One Final Forms record, exactly one unjoined signup: Backfill case, join it, never seed.
- One Final Forms record, two or more unjoined signups: suspected duplicate signups; seed nothing, report.
- Twins (two or more Final Forms records) and zero unjoined signups: seed all of them, each with its own legal first name.
- Twins and one or more unjoined signups: disambiguate each signup by legal first name (falling back to preferred, exactly as Backfill does). If every signup resolves to a distinct record, join them and seed the leftover records. If any is Ambiguous, seed nothing in that group and report it as Ambiguous Match.
- A Final Forms record whose last name and birthdate match a row that already has a different SPS Student ID: do not seed, report as a Match Discrepancy.

Anything you would change?

➡️ Adopt as written. The one design principle: seeding never creates a row in a group where a human still has to decide something.

## Q3: One action or two

Should seeding run the Backfill pass itself (join the 1:1 cases, then seed what remains, one report), or stay a separate button that only reports "matches an existing signup, run Backfill first"?

➡️ One action. The seed run reuses the Backfill logic first, then seeds. Ordering mistakes disappear, and the report shows joined, seeded, ambiguous, discrepancy, and unseedable in one place. The existing Backfill page can stay as the narrower tool or be folded into the new page; I would fold it.

## Q4: Fields written at seed time

Identity from Final Forms (Preferred First Name set equal to the legal first name, Last Name, Date of Birth), SPS Student ID, and every ADR 0004 Seeded Field (grade, student emails and phone, caretaker names, emails, phones). Should Legal First Name also be written, or left blank as "only if different"?

➡️ Write Legal First Name too. When the family later changes Preferred First Name, the row still records what Final Forms calls the student, and nothing downstream is worse for having it.

## Q5: Provenance marker

Add a "Seeded At" timestamp column to the Signups sheet so seeded rows are distinguishable from family-created rows (needed for the coach sheet's "seeded, not completed" section, for a family-facing banner, and for end-of-season decisions)?

➡️ Yes, a single "Seeded At" ISO timestamp, empty for family-created rows. No separate "source" enum.

## Q6: What counts as complete

The portal has two candidate definitions. Which one becomes the single definition?

- A: the round-3 checklist in full: Player Info (9 fields) plus Caretaker Info plus Photo. Volunteering excluded.
- B: Player Info plus Caretaker Info, no Photo.
- C: the spec's Required column: grade, jersey size, caretaker 1 name and email.

Whichever you pick also becomes the fallback for Include In Generated Rosters. Under A, a player whose family skipped only the photo stays off practice rosters until you override them in Extra Player Info.

➡️ B. A missing photo should not keep a kid off a practice roster, and volunteering answers say nothing about the player. Hopes and playing experience are in, since that is what the family sees as "done" on their own checklist.

## Q7: Name of the state

Keep "Profile Complete" (the coach sheet already uses it, redefined as portal-owned) or rename to "Signup Complete"?

➡️ Keep "Profile Complete". Fewer renames, and the family-facing dashboard already speaks of the profile. Add a companion "Profile Missing" text column listing the missing fields, since that is what a coach chasing a family actually needs.

## Q8: Where it is computed and written

The portal computes it and writes both columns on every row write (create, seed, join, save, photo upload). The coach sheet passes them through. A direct edit to the Signups sheet (a `gog sheets update` fix) leaves the columns stale until the next portal write; the seed run recomputes every row as a side effect. The alternative is an array formula in the Signups sheet, which duplicates the rule sheet-side and collides with appended rows.

➡️ Portal-written columns, recomputed for all rows on every seed run. Accept the stale window after manual sheet edits.

## Q9: Side effects at seed time

Photo Carryover fires because SPS Student ID is set in the same write. Should Buttondown auto-subscribe of caretaker emails also fire at seed, or wait for the family's first Save?

➡️ Both fire. Seeded families registered for this program in Final Forms; they are the outreach audience, and the Newsletter is how we reach them. The blocked-subscriber warning on the admin page already covers the datacenter-IP risk.

## Q10: Outreach link

How do families reach their seeded row?

- A: a generic link to `/signup` with instructions to enter last name and birthdate exactly as in Final Forms. Player Lookup finds the row.
- B: personalized `/player/$playerId` links, one email per family (38 Gmail drafts via gog, or Buttondown per-subscriber metadata).
- C: A, plus the seed report lists caretaker emails so you can BCC a Gmail draft as a fallback.

➡️ C. Personalized links are the surest way to land on the row, but 38 hand-sent drafts is a real cost. A generic link works because seeded identity fields are exactly Final Forms' values. Say "legal first name" in the copy for the twin edge case.

## Q11: Trigger and safety

Button on the admin page, safe to press after every nightly export, no schedule. Should there be a dry-run preview before rows are created and emails subscribed? And should seeding respect the family-facing close date (September 18), after which step 0 stops creating rows?

➡️ Preview first, then a Seed button that applies. Seeding ignores the close date: it is an admin action, and a late Final Forms registrant is someone you want to see.

## Q12: Family-facing banner

When a family lands on a seeded row, show a note ("We started this signup from your Final Forms registration; please check the details and finish the rest") while Seeded At is set and Profile Complete is false?

➡️ Yes, exactly that condition. It disappears on its own once the family finishes.

## Q13: End of season

Seeded rows whose families never engaged stay in the sheet with Profile Complete false, so Include In Generated Rosters is false unless you override. Leave them, or add a purge?

➡️ Leave them. No delete tooling; the sheet is per-season, and an untouched seeded row has no photo and no family data to worry about. The coach sheet section tells you who they are.

## Q14: ADR 0004 wording

Seeding is a first join where the row did not exist before, so the never-overwrite rule is satisfied trivially. Proposed amendment: "first Final Forms join, whether the row was created by a family at step 0 or by Seed Signups from Final Forms." Identity fields on a seeded row are initialized from Final Forms but are not Seeded Fields (they are not copied into an existing empty cell, and they remain family-editable identity).

➡️ Adopt. Seeded Field's glossary entry stays unchanged; the new ADR and a new Seeded Signup entry carry the identity-field rule.

## Q15: Coach sheet follow-up scope

Profile Complete? becomes a passthrough of the Signups column, plus a Profile Missing passthrough. Analyze Signups section 2 becomes "Final Forms students not yet seeded", section 5 reads the passthrough, and a new section 6 lists "Seeded Signups not Profile Complete" with the missing list. Include In Generated Rosters fallback is unchanged. That work lives in the admin repo; the portal plan carries it as a work package with a pointer.

➡️ Confirm this shape. Details settle in round 2 once Q6 to Q8 are answered.

## Q16: Admin gate

Neither a captcha nor a honeypot fits: those defend a public form against bots that are supposed to be there (the signup lookup already has both). An admin route has one legitimate caller, so this is authentication. Proposal: a single `ADMIN_SECRET` env var checked by Next.js middleware on `/admin/:path*` and `/api/admin/:path*`, via HTTP Basic Auth (least code; the browser remembers it for the session). This reverses the "no auth gate" choice in ADR 0005, whose reasoning ("one rare start-of-season action") no longer holds once seeding creates rows and subscribes emails. Residual risk: a leaked secret in a bookmark or screenshot. Include `/api/diagnostics` under the gate or leave it open?

➡️ Basic Auth on `/admin` and `/api/admin`. Leave diagnostics open; it reads only and is useful when the secret itself is misconfigured.

## Round 1 decisions (2026-09-07, via Plannotator)

- Q1 read the Drive export directly; unseedable records reported, not seeded.
- Q2 duplicate guard adopted as written.
- Q3 one action: the seed run performs the Backfill pass first, then seeds; the Backfill page folds into the new page.
- Q4 Legal First Name stays blank on a seeded row; Preferred First Name is set to the Final Forms first name.
- Q5 a single "Seeded At" timestamp column.
- Q6 whatever the portal says is required is what marks a signup complete. Include In Generated Rosters is not coupled to this now.
- Q7 keep "Profile Complete", plus a "Profile Missing" list column (revisited in round 2 because of the Q6 decoupling).
- Q8 portal-written columns, recomputed for every row on each seed run.
- Q9 Photo Carryover and Buttondown auto-subscribe both fire at seed.
- Q10 personalized per-family emails with `/player/$playerId` links, not a BCC blast.
- Q11 preview then apply; seeding ignores the family-facing close date.
- Q12 family-facing banner while Seeded At is set and the signup is not complete.
- Q13 never-engaged seeded rows are left in place; no purge.
- Q14 ADR 0004 amendment adopted; identity fields on a seeded row are not Seeded Fields.
- Q15 coach sheet follow-up shape confirmed.
- Q16 Basic Auth on `/admin` and `/api/admin`; diagnostics stays open.

# Round 2

Facts gathered since round 1:

- The dashboard checklist has six items: SPS Final Forms Status, Player Info, Photo Upload, Caretaker Info, Coach Volunteering, Other Volunteering. Each is one function in `src/lib/signup-checklist.ts`.
- Every portal write, including system writes like the join, bumps Updated At.
- This Next.js version (16) names the request gate `src/proxy.ts`; "middleware" is the old name for the same thing.
- `gog gmail drafts create` takes `--to`, `--subject`, and `--body-html-file`, so per-family drafts can be generated by a script and sent by hand.
- The coach sheet's Include In Generated Rosters formula references the `Profile Complete?` column by name, so whatever that column holds is the fallback.

## R2-Q1: The exact completeness rule

"Whatever the portal says is required" means the checklist. Proposal: complete means every checklist item except SPS Final Forms Status is done (Player Info, Photo Upload, Caretaker Info, Coach Volunteering, Other Volunteering). Final Forms is external status, not a signup field. One function in `signup-checklist.ts` computes it and both the dashboard and the sheet column call it, so they can never disagree.

➡️ Adopt. Note the consequence: no seeded row is complete until the family answers the volunteering questions and uploads a photo, which is the point.

## R2-Q2: Naming, given the decoupling

Round 1 chose to keep "Profile Complete" and then chose not to couple Include In Generated Rosters to the new rule. Those conflict: the coach sheet's Include formula reads the column named `Profile Complete?`, which today holds the lenient three-field rule. Two ways out:

- A: the portal's state is called "Signup Complete" (matching the dashboard's "Signup Status" heading). The coach sheet keeps its `Profile Complete?` column and lenient rule untouched, and gains `Signup Complete` and `Signup Missing` passthrough columns.
- B: the portal's state is called "Profile Complete". The coach sheet renames its lenient derived column to something like "Roster Ready", points Include at that, and `Profile Complete?` becomes the passthrough.

➡️ A. Zero risk to the Include fallback you said not to touch, and the name matches what the family sees. The glossary entries become Signup Complete and Signup Missing.

## R2-Q3: Missing-list format

The Missing column is for a coach chasing a family. Format options: checklist labels only ("Photo Upload, Other Volunteering"), or labels with the missing fields for the two multi-field sections ("Player Info (Grade, Hopes); Photo Upload").

➡️ Labels with fields in parentheses, using the labels the family sees on the form, semicolon-separated.

## R2-Q4: Updated At on system writes

Recomputing the two completion columns across every row on each seed run would bump Updated At on all 80 rows, so it would stop meaning "last family-driven change". Proposal: the recompute writes only the two columns and leaves Updated At alone; a seeded row is created with Created At, Updated At, and Seeded At all equal.

➡️ Adopt. Requires a small change so a system write can skip the Updated At bump.

## R2-Q5: Outreach draft mechanics

One Gmail draft per seeded player, To: Caretaker 1 and Caretaker 2 emails, personalized with the player's first name and their `/player/$playerId` link. The admin page exposes the outreach list (seeded and not complete) as JSON, and a script under `scripts/` turns it into drafts with `gog gmail drafts create`. You send each draft after review. Siblings get one draft per player.

➡️ Adopt. Sending stays manual per the profile's send policy.

## R2-Q6: Outreach repeat and tracking

A second wave later drafts again for everyone still seeded and not complete. No "Outreach Sent At" column; the filter shrinks on its own as families finish.

➡️ No tracking column.

## R2-Q7: Email ask and timing

The signup deadline was September 8 and step 0 closes September 18. The email needs one clear ask. Options: "finish before the first practice", "finish within a week", or no date.

➡️ "Please finish before the first practice" with the date, since tryouts are the reason you want every potential player visible now. Copy is drafted in the plan for your review.

## R2-Q8: Banner and preferred-name nudge

The seeded-row banner should say the signup was started from Final Forms, and that the first name shown is the legal one from Final Forms, so change it to the name the player goes by.

➡️ Yes, one sentence for each, shown until the signup is complete.

## R2-Q9: Admin page shape

Fold Backfill into one page at `/admin/final-forms` with two buttons: Preview (no writes) and Apply. The report sections: seeded, joined (Backfill cases), ambiguous, discrepancies, suspected duplicate signups, unseedable, plus the outreach list and a count of rows whose completion columns were recomputed. The old `/admin/finalforms-backfill` URL redirects.

➡️ Adopt.

## R2-Q10: Basic Auth details

A single `ADMIN_SECRET` env var; username ignored; checked in `src/proxy.ts` for `/admin/:path*` and `/api/admin/:path*`. If the secret is unset, the gate fails closed (admin routes return an error naming the missing variable) rather than open.

➡️ Adopt, fail closed. Local dev sets the secret in `.env.local`.

## R2-Q11: Coach sheet columns

The Roster gains only the two passthrough columns (Signup Complete, Signup Missing). Analyze Signups reads Seeded At straight from the Signups mirror for the new "Seeded Signups not complete" section; no Seeded At column in the Roster.

➡️ Adopt.

## R2-Q12: Gender stays out of scope

Gender Identification is not seeded (the export's gender column is never read by the portal). The coach sheet already falls back to Final Forms gender for printing. Leave it.

➡️ Leave it.

## Round 2 decisions (2026-09-07, via Plannotator)

- R2-Q1 adopted: complete means every checklist item except SPS Final Forms Status.
- R2-Q2 not settled: the two-name proposal (Profile Complete plus Signup Complete) was too complicated. Reviewed in round 3.
- R2-Q3 dropped: no Missing column. Keep it simple.
- R2-Q4 adopted, with the rule stated more precisely: Updated At changes only when a family makes a change or seeding does meaningful work on the row. A recompute of the completion column never bumps it.
- R2-Q5 simplified: for now, an easy way to get the caretaker emails for a generic BCC message. Templated per-family drafts (select signups, give a template, generate drafts, "send all drafts" one every few seconds) is a possible later tool, maybe in madison-ultimate-admin.
- R2-Q6 adopted: no tracking column.
- R2-Q7, R2-Q8 not annotated; treated as accepted, confirmed below.
- R2-Q9 adopted except the redirect: the old Backfill URL just goes away.
- R2-Q10 adopted: Basic Auth, fail closed.
- R2-Q11 not settled: same confusion as R2-Q2. Reviewed in round 3.
- R2-Q12 adopted: gender stays out of scope.

# Round 3

## R3-Q1: Review of the "complete" states, and one state instead of two

Today there are three different notions, none of them written anywhere as a value:

| Where | What it checks | Who uses it |
|---|---|---|
| Coach sheet `Profile Complete?` column | A formula: Grade, Date of Birth, and Caretaker 1 Email are non-empty | Include In Generated Rosters falls back to it; Analyze Signups section 5 lists rows failing it; Show Statistics counts it |
| Portal dashboard checklist | Six done/not-done rows (Final Forms, Player Info, Photo, Caretaker Info, Coach Volunteering, Other Volunteering), each its own function | Families, on their own player page |
| Form "required" markings | Grade, jersey size, caretaker 1 name and email are marked required but never block Save | Families, visually only |

Seeding breaks the coach sheet's formula: every seeded row has Grade, Date of Birth, and Caretaker 1 Email from Final Forms, so every seeded row would count as complete the moment it is created. That is why you asked for the portal's definition to be the single one.

The round-2 confusion was mine: I proposed a second name ("Signup Complete") only to keep the coach sheet's Include fallback unchanged. Simpler proposal, one state only:

- **Profile Complete** is defined by the portal as "every checklist item except SPS Final Forms Status is done" (round 2, R2-Q1), computed by one function, and written as a TRUE/FALSE column on the Signups row on every portal write and on every seed run.
- The coach sheet's `Profile Complete?` column stops being a formula and becomes a passthrough of that column. Analyze Signups section 5 and Show Statistics read the passthrough. Its glossary entry changes to "defined and written by the portal".
- Nothing is called Signup Complete. No Missing column.

➡️ Confirm this one-state model.

## R3-Q2: What Include In Generated Rosters falls back to

With Profile Complete now strict, Include's fallback is the one remaining choice, and it is the only place "not coupling" has to be made concrete:

- A: Include keeps reading `Profile Complete?`. Behavior changes: a player whose family has not uploaded a photo or answered the volunteering questions is off practice rosters until you override them in Extra Player Info.
- B: Include's fallback inlines today's basic-info check (Grade, Date of Birth, Caretaker 1 Email present) directly in its own formula, so it no longer references Profile Complete at all. Behavior is exactly today's; seeded rows with those three fields would show on generated rosters unless you set Include to FALSE. The check has no name of its own; it is just Include's default.
- C: Include's fallback is TRUE for family-created rows and FALSE for seeded rows (Seeded At empty or not), ignoring completeness entirely. Seeded rows stay off rosters until the family engages or you override.

➡️ C. It keeps the portal's Profile Complete out of the roster decision, as you asked, and it gives seeding the one roster-side behavior that matters: a seeded row for a family that never engaged does not print on a practice roster. Family-created rows behave as they did before the Profile Complete formula existed. You can revisit later without touching the portal.

## R3-Q3: Outreach, the simple version

The admin page's report includes, for rows where Seeded At is set and Profile Complete is FALSE, one deduplicated comma-separated list of Caretaker 1 and Caretaker 2 emails, in a copyable box, ready to paste into BCC. The generic email links to `/signup` and tells families to enter the player's last name and birthdate exactly as in Final Forms. Copy drafted in the plan for your review. Templated per-family drafts are listed in the plan as a later option, not built now.

➡️ Adopt.

## R3-Q4: Round-2 items you did not annotate, treated as accepted

- R2-Q7: the email asks families to finish before the first practice, with the date.
- R2-Q8: the seeded-row banner says the signup was started from Final Forms and that the first name shown is the legal one, so change it to the name the player goes by. Shown until Profile Complete.
- R2-Q9: one page at `/admin/final-forms` with Preview and Apply; the old Backfill page and route are deleted, no redirect.

➡️ Confirm, or mark any you want changed.

## Round 3 decisions (2026-09-07, via Plannotator)

- R3-Q1 confirmed with two changes: Profile Complete is TRUE when Player Info, Caretaker Info, and Photo Upload are done. Coach Volunteering and Other Volunteering do not factor in (nor does Final Forms). One state, portal-defined, portal-written, passed through to the coach sheet. Analyze Signups section 5 and Show Statistics keep reading it.
- R3-Q2 decided differently from every option offered: every signup row, regardless of status, is included in generated rosters unless Extra Player Info marks it FALSE. Include In Generated Rosters no longer references Profile Complete at all.
- R3-Q3 adopted: copyable BCC list of caretaker emails for seeded rows not yet complete; generic email links to `/signup`. Steve drafts the email verbiage himself.
- R3-Q4 confirmed: banner as described; one admin page at `/admin/final-forms` with Preview and Apply; old Backfill page and route deleted, no redirect.

Frontier empty. Outputs: `docs/adr/0006-seed-signups-from-final-forms.md`, glossary entries in `CONTEXT.md`, and `docs/fall-2026/seed-signups-plan.md`.
