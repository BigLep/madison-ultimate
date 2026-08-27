# Fall 2026 Signup Plan: Grill Round 2

Working document for the second design grill of the signup form, run 2026-08-27 during Milestone A/B implementation feedback. Round 1 (`signup-grill.md`) settled the identity model and lookup mechanics before build; this round settles a batch of UX/copy/scope feedback Steve gave while testing the app locally, collected as `signup-feedback-backlog.md` with an explicit "don't implement yet" instruction, then grilled here before any code changed. Decisions are folded into `docs/fall-2026/signup-spec.md` directly; this document is the record of how each was reached.

## Q1. Pronouns and Gender Identification: formalize the spec, or just implement the deviation?

`signup-spec.md` rows 1.3/1.4 listed both as free text. The old Google Form (`gog forms get 16Cy2nfzBcvX4vCNoGS3KyjnIvnuJfL24BhZ_Sn53nMA --json`, queried live rather than guessed) used select controls: Pronouns is a checkbox multi-select (he, him, she, her, they, them, "select all that apply", required in the old form); Gender Identification is a two-option radio (Girl-Matching/Gx/Non-binary; Boy-Matching/Bx/Non-binary, confirmed complete, no hidden third option).

➡️ Update the spec.

✅ SETTLED (Steve): update `signup-spec.md` rows 1.3/1.4 to select controls. Applied directly to the spec.

## Q2. "Legal first name" label + info bubble: which surface(s)?

This field currently exists as two separately-worded copies — the step-0 lookup form and the step-1 profile form (identity fields stay editable in place per ADR 0001).

➡️ Both surfaces, so the two copies of the field don't look inconsistent to a family editing it in place.

✅ SETTLED (Steve): both. Label becomes "Legal first name (only if different)" everywhere it appears; both copies carry the same info bubble (C10) explaining it's needed to match the Final Forms record.

## Q3. New "Coach Volunteering Interest" sheet column: name and placement?

Splitting coach volunteering into its own question (see Q6/Q9 below) needs a new Signups sheet column, separate from the existing Volunteer Roles column. The live spreadsheet already has its 32 spec columns set; adding one is a manual edit to the real Google Sheet, since the webapp discovers columns by name dynamically but never creates them.

➡️ `Coach Volunteering Interest`, placed right after `Volunteer Roles`.

✅ SETTLED (Steve): that name and position. Steve to add the header cell to the live sheet by hand before this ships (tracked as a TODO in `signup-plan.md` section 10, alongside the also-new `Additional Feedback` column from Q9).

## Q4. Mailing-list opt-out link (C2): our own dashboard opt-out, or an external Buttondown URL?

The only Buttondown URL in the repo (`https://buttondown.com/madisonultimate`, used for `/subscribe`) is the public subscribe/archive page, not obviously an unsubscribe page; Buttondown's standard unsubscribe flow is normally a per-subscriber tokenized link inside each sent email, not a static public URL.

➡️ Link to the dashboard's own one-click opt-out (already built, no external dependency).

✅ SETTLED (Steve), overriding the recommendation: `https://buttondown.com/madisonultimate/` is good enough — it has a "Manage Subscription" button. C2 now reads "...right from this page or here," with "here" linking there.

## Q5. Jersey Size helper text: the old form's copy doesn't fit the current option set

Old form: "What adult size jersey does the player normally wear? These are unisex choices." Old form's options were adult-only unisex (XS, S, M, L, XL); the current spec's options (YM, YL, AS, AM, AL, AXL) mix youth and adult.

➡️ Reworded draft: "What size jersey does the player normally wear? Y = youth, A = adult; these are unisex sizes."

✅ SETTLED (Steve): use the draft as written.

## Q6. The old form's general-feedback field has no home in the one-pass spec

Old form had a standalone "Anything else you want to share?" question (general feedback/suggestions for the coaches, not about the player), under its own "Other Comments" section at the very end, distinct from the "Other Info" field that survived into the new spec. The new one-pass spec dropped it entirely when it was written.

➡️ Drop it; email is already the fallback surfaced everywhere else in the flow (Final Forms not-found copy, privacy page).

✅ SETTLED (Steve), overriding the recommendation: add it back, as its own closing section near Save. New sheet column `Additional Feedback`; new spec section "💬 Anything else" (1.25), supporting copy C14 (old form's "Feel free to pass along any other ideas..." text, reused as-is).

## Q7. Item #8 (decouple save-from-completeness): still the plan?

Already decided in the main conversation before this grill round: profile save stops requiring completeness (grade/jersey size/caretaker fields stay visually required but don't block Save); the page stops switching between a form view and a dashboard view; Final Forms status always shows at the top of `/player/$playerId` regardless of profile completeness. This exists to fix a real UX dead end: a family who only wants to correct a typo'd birthdate had no way to save that fix without finishing the rest of the profile first.

➡️ Confirm, no changes.

✅ SETTLED (Steve): proceed as written. Folded into `signup-spec.md`'s Status Dashboard section.

## Q8. Section heading emoji

➡️ Proposed: Player 🧑, Player contact 📱, Caretakers 👪, Media 📸, Coaching 🥏, Other Volunteering 🙋.

✅ SETTLED (Steve), with substitutions: Player 🏃, Player contact 📞, Caretakers 👪ª, Media 📸, Coaching 👊, Other Volunteering 🙋. (ª Steve's first answer was 🧑‍🧑‍🧒; corrected to 👪 in a follow-up message.) The new "Anything else" section gets 💬, picked by the agent since Steve didn't specify one for a section that didn't exist yet; open to override.

## Q9. Split "Ways you might help" into Coach Volunteering and Other Volunteering

Steve's original ask (outside the numbered backlog, given directly): break out a dedicated coaching-interest question, matching the old form's "Are you interested in helping coach?" (radio: Yes / Maybe (I'd like to talk more about the possibility) / No, old supporting copy reused), with a learn-more link to https://madisonultimate.notion.site/Volunteering-60ec4da46f7583df9a2d015cf5cb03b2, a plug for more female coaching leadership, and a note that anyone already in touch with Coach Steve about coaching doesn't need to fill it out again. "Helping coach at practices" comes out of the remaining multi-select, renamed "Other Volunteering."

The female-leadership plug is sensitive, community-facing copy; the agent declined to freehand it and asked for Steve's wording directly rather than guessing.

➡️ Draft plug: "We're especially hoping to hear from moms and other women interested in coaching — the team benefits from more female leadership on the sideline."

✅ SETTLED (Steve): liked the draft, with one correction — no em dashes or long dashes anywhere, ever (standing rule, not specific to this line). Final copy (C12): "We're especially hoping to hear from moms and other women interested in coaching; the team benefits from more female leadership on the sideline."

## Session notes

- The old Google Form (`docs.google.com/forms/d/16Cy2nfzBcvX4vCNoGS3KyjnIvnuJfL24BhZ_Sn53nMA`) is queryable read-only via `gog forms get <formId> --json` under the `madisonultimate@gmail.com` coach identity. Used this round to fetch exact question wording, options, and helper text rather than working from paraphrases — caught one wrong assumption (Other Info's helper text is real, not a label replacement) and one gap (the general-feedback field, Q6) that pasted excerpts alone hadn't surfaced.
- Items #2 (help-bubble/learn-more component) and #4 (elementary school dropdown, options confirmed by Steve directly) from the backlog were already fully decided going into this round and weren't re-litigated.
- Item #9 (the `.env.local` `SPS_FINAL_FORMS_FOLDER_ID` pointing at a stale folder) is Steve's own ops TODO, not a decision — not re-litigated here either.
- This round produced no code changes, per the instruction that started it; `docs/fall-2026/signup-spec.md` and `docs/fall-2026/signup-plan.md` were updated directly, and `signup-feedback-backlog.md` (scratch, not committed) was marked with each item's resolved status for the future implementation pass.
