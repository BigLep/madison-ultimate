# Fall 2026 Signup Plan: Grill Round 1

Working document for the design grill of `docs/fall-2026/signup-plan.md`. Each question ends with a recommended answer (➡️). Respond inline; agreement can be as short as "yes". Round 2 questions unlock as these get settled.

Code facts referenced below come from a sweep of both repos (portal lookup, Buttondown client, coach sheet Apps Script, finalforms-export) done 2026-08-26.

## Q1. When does a signup row get created?

Section 4 says step 0 creates a row when no existing key matches. That means a typo in birthdate or last name silently creates a phantom duplicate player, and last year's Full Name Diff chore taught us how families mangle their own data.

Options:

- (a) Create the row at step 0 as written.
- (b) Create the row only when the profile form is actually submitted in step 1.
- (c) Option b plus a near-match check (exact last name + DOB, or exact DOB + fuzzy name) that warns "we may already have a signup for this player, check your spelling" without revealing the existing row's contents.

➡️ (c). Step 0 becomes purely a lookup; nothing persists until a family commits a profile. The near-match warning has to be content-free (no echoing the other row) to keep the privacy gate intact, but it catches the sibling-retypes-the-birthdate case before it forks the data.

✅ SETTLED (Steve, round 1): create the row at step 0 and route immediately to `/signup/$playerId`. Creation timing does not change the duplicate risk (bad info persists at commit either way); what matters is the fix path and the guardrails. So: (1) identity fields (name, DOB) stay editable inside the profile, so a typo is fixed in place on the existing row rather than by re-signup; (2) the content-free near-match check still runs at step 0 before creating a row, since it is orthogonal to creation timing; (3) a coach-side duplicate report is the backstop. Rows with identity but no profile are a feature, not litter: they show who started but did not finish. `/signup/$playerId` makes PlayerID a capability URL, same pattern as the portal's Portal ID slug.

## Q2. What does a returning family do at /signup?

Do they retype preferred name + last name + birthdate every visit, or do we persist identity on the device (cookie holding PlayerID) so return visits land straight on the status dashboard? A cookie also has to handle the shared-device case (two siblings, one parent phone).

➡️ Retype as the universal path, plus a cookie for convenience with a visible "not this player? switch player" escape hatch. The cookie stores the PlayerID slug only, never the lookup fields. This also rehearses the exact login families will use for the portal all season, which is a feature, not a cost.

✅ SETTLED (Steve, round 1): after signup the family lands on the player's own URL, so bookmarks and history pull up that player directly. Always show a "not this player?" affordance that returns to `/signup` for a fresh lookup. Additionally, local/cookie storage keeps a list of players accessed on that device, with a quick-switcher UI between them and a way to remove a player from the list (multi-kid families, shared parent phone). The stored list holds PlayerID plus display name only, never the lookup fields. Path settled: **`/player/$playerId` is the one canonical player page**; `/signup` is just the lookup/create flow that redirects into it, and the same page grows availability and Player Info sections in Phase D so bookmarks never break.

## Q3. Settle the identity key (the section 3 TODO)

The plan proposes `normalize(first 2 letters of preferred name + last name + birthdate MMDDYY)`. Since families type fields into a form and the key is derived, the real decisions are:

- (a) Is full birthdate MMDDYY required (versus the portal's current MMYY)?
- (b) Two letters of preferred name (versus the portal's current one letter)?
- (c) Do we accept that editing a preferred name changes the login key a family may have memorized mid-season?

Code facts: the current portal key is 1 letter + last name + MM + YY (`src/app/api/player/lookup/route.ts:33`), normalized by trim, lowercase, strip whitespace, keep hyphens (`src/lib/portal-cache.ts:135`). Two gaps the plan's spec shares with current code: apostrophes are preserved as typed (O'Brien must match character-for-character) and there is no accent folding (Jose with and without accent do not match). Also, no code in either repo ever parses the Final Forms DOB string; it flows through as whatever string SPS emits, so an MMDDYY-derived key pins that format for the first time. The signup form's own DOB field can be a proper date input, which sidesteps the format question on the family side. And the current portal silently `.find()`s the first key match, so the real twin pair in the current export would route one twin into the other's portal with no error today; the plan's collision handling is a genuine fix, not gold-plating.

➡️ Yes to all three. Full DOB is collected anyway for the Final Forms join, so it costs nothing at signup; two letters is the minimum that clears the real twin collision; and (c) is mitigated because PlayerID is stable and the form asks for fields rather than the key, so a family that renamed "Katie" to "Kate" still types what they believe their name is. The only true breakage is a preferred-name change that alters the first two letters, which is rare enough to handle by hand. Add apostrophe stripping and accent folding to the new normalization spec while we are here, and write the spec down once as the shared source of truth for webapp and sheet formula (today the sheet formula is hand-maintained with no spec anywhere).

✅ SETTLED (Steve, round 1): collect full DOB (strengthens the Final Forms join; the join itself can be tolerant about which parts it matches on); two letters of preferred name for the twin case; store `spsStudentId` on the signup row once a Final Forms match is found, and use it for all subsequent Final Forms lookups. PlayerID is a short random opaque slug, distinct from the derived lookup key (the lookup key finds the row; PlayerID is the row's permanent identity for URLs, joins, and photos). Normalization is complete: trim, lowercase, strip whitespace, strip apostrophes, fold accents, keep hyphens. These terms are now documented in `CONTEXT.md`.

## Q4. Anyone who knows name + birthdate can edit, not just view

The gate protects viewing, but the same gate authorizes editing the profile, changing parent emails, and later uploading a photo. A classmate who knows a player's birthday could vandalize their profile or redirect the mailing-list subscription.

Options: accept this risk (consistent with last year's no-accounts principle), or add mitigations: rate limiting on lookups, an audit trail (Updated At plus maybe an append-only change log tab), or an email notification to the parent on file when a profile changes.

Code fact: the plan's section 8 already asserts "lookups are rate-limited" but nothing implements it. There is no middleware, no rate-limit library, and the current lookup endpoint returns distinguishable found/not-found over a small enumerable key space (birth years hardcoded 2011-2015). So "add rate limiting" is new build work, not an existing property.

➡️ Accept, with rate limiting on the lookup endpoint (now understood as new work) and Updated At. Middle schoolers guessing classmates' birthdates to submit a fake jersey size is a threat model we can absorb; the sheet's revision history is the recovery path. Email-on-change is real work and creates a new failure mode (parents confused by notification emails) for marginal protection. But this is a risk to own explicitly.

✅ SETTLED (Steve, round 1): risk accepted in full, including no rate limiting. Two seasons with zero abuse; players have enough maturity; build something better later only if abuse actually appears. Consequences recorded: the plan's section 8 claim that "lookups are rate-limited" is removed (it was aspirational anyway), and the bot-protection posture from the Q2 thread is now honeypot + minimum-time-to-submit at launch with Turnstile behind a flag, no rate limiter underneath. Updated At stays (free, already in the data model) and sheet revision history is the recovery path. Accepted residual: the lookup endpoint is scriptable over the name+birthdate space, so existence and status of a player are enumerable in principle; owning that explicitly.

## Q5. When the Final Forms join fails, who fixes it?

The join is birthdate + last name against school records. A family that enters a differently spelled last name, a hyphenation difference, or the wrong birthdate gets "not found", and the plan's messaging says "you may not have started Final Forms", which is wrong in that case and erodes trust in the dashboard. The legal-name prompt covers first names only.

Question: should the Joins column (Final Forms StudentID) be explicitly coach-writable, so Steve can manually pin a match the algorithm missed, with the webapp treating a present StudentID as authoritative and never overwriting it?

➡️ Yes. Make manual StudentID entry the designed escape hatch: the webapp writes it when the join succeeds, Steve writes it when it does not, and once present it wins. Pair it with a coach-sheet view of unmatched-signups versus unmatched-Final-Forms rows so mismatches surface to the coach instead of festering as family confusion. The not-found message should honestly offer both branches: "haven't started" and "our records may not match; check the legal name field or contact us".

✅ SETTLED (Steve, round 1): coach-writable `spsStudentId` is the escape hatch, authoritative once present. Family-facing guidance: the not-found state reminds families to enter last name and legal first name exactly as they appear in Final Forms (linking to seattleschools-wa.finalforms.com), while making clear their preferred name is what we use in all communication. Exact copy lands in round 2 with the rest of the not-found messaging.

## Q6. Which Final Forms fields does the dashboard show back? (plan open question 1)

The three booleans are decided. Candidates beyond that: physical clearance expiration date (physicals last 2 years, so "cleared until June 2027" versus "expired, new physical needed" is actionable), athletics-office approval status if the export has it, and grade as the school has it.

➡️ The three booleans plus the physical expiration/clearance date, nothing else for v1. It is the only extra field that changes what a family does next. Everything else is disclosure without action, and section 8's posture says disclose only what earns its place.

✅ SETTLED (Steve, round 1): full Final Forms column list provided (includes Physical Expiration, confirming it is available to show). Display-back: three booleans plus physical clearance/expiration. The bigger outcome of this thread is the **seed model** for contact/profile fields:

- Two field classes with opposite sync rules. **Final Forms Status** (signatures, clearance, physical): always read live from the newest export, never copied, because Final Forms is where a family fixes them. **Seeded fields** (grade, student email/phone, parent names/emails/phones): copied into the signup row once, at family-accept time, and ours thereafter; never re-synced from Final Forms. This answers both "editing in Final Forms is annoying" and "spring has no Final Forms": after seeding, our row is the system of record for contact info.
- The UI is "here is what we have from Final Forms; use it, or enter something different", per field group. Everything displays **unmasked**, including emails and phones: Steve's call, so a parent can verify that copied-in Final Forms data is correct. This reverses the plan's masked-email posture; the accepted consequence is that anyone who knows a player's name and birthdate can see the seeded parent contact info (consistent with the Q4 accepted-risk posture). Section 8 of the plan updated accordingly.
- Student email becomes two optional fields (personal and SPS); the Final Forms Email seeds whichever it matches (@seattleschools.org pattern goes to SPS). Student cell phone optional, seeded.
- Parents get one phone field each (not three); seed priority cell, then home, then work. This also resolves Q10: phones yes, seeded rather than retyped.
- Home address, race, ImPACT, payment fields: never imported, never shown.

## Q7. Masked parent email prefill (plan open question 2, the section 4 TODO)

When the join finds a Final Forms record before a profile exists, parent emails prefill masked (s•••@gmail.com) with a "use the email on file" button. Alternatives: no email prefill at all (family types emails fresh), or full display.

➡️ Keep masked-with-button as planned. Full display turns a name+birthdate gate into an email-harvesting endpoint for anyone who knows a kid's birthday; no prefill costs every legitimate family typing and risks typos that break the mailing-list subscribe. Masked is the only option that is both safe and friction-reducing. One sharpening: the button should copy the on-file email into the row server-side without ever sending it to the browser unmasked.

✅ SETTLED (Steve, round 1, decided against the recommendation): no masking anywhere. All seeded contact info (emails and phones, parent and student) displays in full so a parent can spot wrong Final Forms data at a glance. Risk explicitly accepted, consistent with Q4: the name+birthdate gate is the only protection on parent contact info. Decision recorded in plan section 8.

## Q8. What does "media opt-out" actually govern?

The plan conflates two concepts. The uploaded photo's original purpose is coach-side player identification (the photo-mapper). Media opt-out reads like "don't publish my kid in newsletters/website photos". Section 4 hides photo upload entirely for opt-out families, which means opt-out families become unidentifiable to coaches too.

Options:

- (a) One switch as written: opt-out means no photo at all.
- (b) Two concepts: the ID photo is always requested ("used only by coaches to learn names") and media opt-out separately governs publication.

➡️ (b). They are genuinely different consents, and (a) costs the ID photo for exactly nobody's benefit: a family worried about publication still wants coaches to know their kid. Label the upload "coach identification only" and keep a separate "OK to appear in team photos/newsletter" checkbox. This becomes a glossary entry: Photo (internal ID) versus Media Consent (publication).

✅ SETTLED (Steve, round 1): option (b). The player photo is always wanted, for the portal and for coaches, regardless of media preference; photo upload shows for everyone. Media Opt-Out means the family does not want photos of their player used in team communications or shared within the team. Signup copy states plainly that we never post to social media, opt-out or not. Terms added to CONTEXT.md.

## Q9. The published signup deadline (plan open question 3)

SPS/DiscNW registration closes Friday Sept 18; first game Sept 26; practices start Sept 8-10. The family-facing deadline needs slack for the Final Forms signature chase, which the data says takes days to weeks (40 parent-signed but only 13 student-signed).

➡️ Publish "complete signup and Final Forms by Friday, September 11" (end of the first practice week). That leaves the Sept 14-18 week for nagging stragglers with the nightly diff instead of discovering them at the wire. Publish one date for everything; two deadlines (signup versus Final Forms) is exactly the multi-step confusion this project exists to kill.

✅ SETTLED (Steve, round 1): the real constraint is tryouts, not the registration close. Tryouts are Thursday Sept 10 and Friday Sept 11; regular practices start the week of Sept 14. Published deadline: **complete signup and Final Forms by end of day Wednesday, September 9**, with the announcement and dashboard recommending finishing earlier because school administration needs processing time and players must be fully cleared to try out. One date for everything. Still queued for round 2: the exact consequence messaging for a player not cleared by tryout day.

## Q10. Parent phone numbers (plan open question 4)

Emails only, or phone too?

➡️ Collect one optional phone per parent, labeled "for game-day/urgent coordination only". Fall has real game-day logistics (field changes, carpools) where email fails. Optional keeps friction near zero. But if parents were never actually texted last fall, drop it; every field costs completion rate.

✅ SETTLED (via the Q6 thread): one optional phone per parent, seeded from Final Forms with cell-then-home-then-work priority, parent can overwrite. Student cell phone also optional and seeded.

## Q11. Volunteer roles list (plan open question 5)

Proposed: coach at practices, game-day help/field manager, photographer, admin/communications, snacks/logistics, other + free text.

➡️ Keep the set, with two tweaks: split "game-day help" from "field manager" only if those are genuinely different jobs in fall ops (field setup/teardown versus sideline management); and add "not sure yet, tell me more", because the debrief's insight was that parents underestimate how approachable the jobs are, and a low-commitment curiosity option catches fence-sitters that a concrete-roles-only list filters out.

✅ SETTLED (Steve, round 1): as recommended. Final list: coach at practices, game-day help/field manager, photographer, admin/communications, snacks/logistics, "not sure yet, tell me more", other + free text. Anyone selecting coaching also gets pointed at the coach interest form.

## Q12. Buttondown free tier versus subscribe-by-default

The appendix notes the list is nearing the free-tier subscriber limit, and this plan auto-subscribes up to two parent emails for each of what is now 68+ registrants. Those two facts collide.

Options: pay for Buttondown, prune pre-season/stale subscribers first, or subscribe only Parent 1 by default.

Code fact: the existing Buttondown integration is read-only (subscriber list lookup, no tags modeled); subscribe-and-tag is entirely greenfield, as the plan assumed.

➡️ Decide now to pay if needed (it is the communication backbone of the season), and do a pre-season prune of bounced/stale addresses regardless. Do not degrade the design (Parent-1-only) to dodge a small subscription fee. The actual current count and tier boundary get confirmed before Milestone A; the double-opt-in question is pending a facts check and returns in round 2.

✅ SETTLED (Steve, round 1): pay for the Buttondown tier that covers the subscriber count; paying to keep it easy is worth it. Both parent emails subscribe by default as designed. Remaining on this branch for round 2: double-opt-in behavior for API-created subscribers (facts check), and the tagging scheme.

## Q13. Export cadence (plan open question 6)

Nightly is live. More frequent during the signup window (Aug 26 to Sept 18)?

➡️ Keep nightly plus manual dispatch. The dashboard's Final Forms status is at most a day stale either way, and a family who just signed can be told "status updates overnight" in the UI (worth a small "last updated" timestamp on the dashboard). If the mid-September signature chase makes twice-daily attractive, it is a one-line cron change then; do not decide it now.

✅ SETTLED (Steve, round 1): nightly is not enough during the signup window; on-demand refresh via the fire-and-forget button. No time-based cooldown: the guard is single-flight, meaning the button always triggers a run unless one is already running (GitHub Actions concurrency group, or an in-progress check before dispatch), in which case the UI says a sync is already underway. Original proposal below for reference:

- **Fire-and-forget button**, not live-reload: "I believe I've completed Final Forms; check again" responds with "Great, we're syncing; check back in about 5 minutes". The auto-reloading variant means job-status plumbing and cache busting for marginal gain; skip it.
- Implementation: the button triggers the existing GitHub Actions export via workflow_dispatch (a repo token in Vercel env). The export takes roughly 2 to 5 minutes end to end.
- **Global cooldown instead of rate limiting**: only trigger if the newest CSV in the Drive folder is older than about 15 minutes; otherwise reply "your status is already up to date as of [time]". This is stateless (the file timestamp is the state), protects Final Forms from login hammering, and caps Actions usage no matter how often anyone clicks.
- Also bump the cron to every 2 to 3 hours during the signup window (Aug 26 to Sept 9), back to nightly after.
- Show a "Final Forms data as of [time]" stamp on the dashboard either way.

## Q14. WhatsApp group membership (new scope, Steve, round 1)

Families will be encouraged to join the team WhatsApp group, and the phone numbers provided at signup should be matched against group membership so the dashboard can show joined / not joined with a join link.

Open sub-questions:

- (a) Source of truth: WhatsApp has no practical API for reading group membership, so the likely mechanism is a periodic manual export of group participants from the group admin's phone into the Drive folder, ingested the same "newest CSV in a folder" way as the mailing list. Is that cadence acceptable, knowing the dashboard's "not joined" can be days stale?
- (b) Phone matching requires normalization to a canonical form (country code, strip formatting) on both sides, and the signup form's phone label should say "use the number you have WhatsApp on" or the match will quietly fail for families whose WhatsApp number differs from their contact number.
- (c) Does WhatsApp join status become a fourth dashboard row (Profile, Final Forms, Photo, Mailing List, WhatsApp)?

➡️ Treat it exactly like the mailing list pattern: dashboard row with joined/not-joined and a join link as fallback, membership source is a manually exported list in Drive, matching on normalized phone numbers. Ship the join link row in Milestone A (zero dependency) and the joined/not-joined detection later, since the link is the part that drives adoption.

✅ SETTLED (Steve, round 1): deferred. No WhatsApp membership lookup in scope now; the priority is the minimum usable /signup. WhatsApp status is a future bonus. The parent phone field is simply "the number to contact in an emergency", no WhatsApp labeling. Joining the group gets encouraged through the announcement and info pages, not tracked by the dashboard.

---

# Round 2

Round 1 is complete (Q1-Q14 all settled). These questions were unlocked by those answers. Same format: comment inline, agreement can be one word.

Note: bot/abuse protection was settled in the Q2 thread as honeypot + minimum-time-to-submit at launch, Turnstile wired behind an env flag but off (no rate limiter, per Q4).

## Q15. Lookup collision handling (replaces the plan's "third letter" idea)

The plan says a twin pair whose preferred names share their first two letters gets asked for a third letter at submit time. But since families type their full fields (not the key), there is a simpler option: when a typed lookup matches more than one row's derived key, tie-break by comparing the full normalized preferred name against the matching rows, and only if that is still ambiguous show "add your full preferred name as the school knows it". No per-player key-length rules, nothing to remember, and the derived key stays uniform for everyone.

➡️ Full-name tie-break, dropping the third-letter mechanism entirely. The 2-letter key stays as the fast path and its truncation still gives nickname-drift tolerance ("Kat" vs "Katie" both start "ka"); ambiguity is resolved with data we already store rather than a bespoke key extension only twins ever see.

✅ SETTLED (Steve, round 2): simpler still, and it dissolves the derived key entirely. Lookup is **field matching**: normalized last name + full birthdate must match exactly (the minimum), and normalized preferred name disambiguates only when several rows share both (twins), using as many leading letters as needed. Consequences: no `Portal Lookup Key` formula column in the new sheet at all (the webapp matches against the identity columns directly, so normalization lives in exactly one place and the hand-maintained sheet formula, which had no spec, disappears); preferred-name drift ("Kat" vs "Katie") costs nothing because preferred name is not load-bearing except for twins; CONTEXT.md updated to replace the Lookup Key term with Player Lookup.

## Q16. Buttondown double opt-in (facts now in)

Facts (from Buttondown's docs, checked 2026-08-26): API-created subscribers default to `unactivated` and get a confirmation email (double opt-in). This cannot be disabled globally without a support ticket, but it can be bypassed per subscriber by creating with `type: "regular"`, which the docs explicitly sanction "when you have already verified consent, e.g. your own signup flow". One ambiguity: the docs do not say whether the welcome email fires for `type: regular` creates; needs a test or the welcome email disabled. Also useful: duplicate-email creates return 400 unless the `X-Buttondown-Collision-Behavior` header is sent, which matters because families will re-save profiles.

➡️ Create subscribers with `type: "regular"` (no double opt-in, no confirmation email, no support ticket needed), test the welcome-email behavior once before launch, and send the collision header so a re-saved profile never errors on an already-subscribed parent. This makes Q16 essentially settled unless you object.

✅ SETTLED (Steve, round 2), including the consent UX: at save time the form clearly tells parents that saving subscribes the provided email(s) to the team newsletter and that they can opt out at any point; saving is the confirmation. After save, the UI shows subscription status next to each parent email with an always-available join / opt-out action right there. API mechanics as recommended: `type: "regular"`, welcome-email behavior tested once before launch, collision header on creates.

## Q16b. Tagging costs money (new fact affecting Q19)

Buttondown's pricing now has a free-first-100-subscribers base, usage-based pricing above that (secondhand sources suggest roughly $9/month to 1,000 subscribers), and, notably, **tagging is a +$9/month a la carte add-on**. So the Q19 tag scheme is not free with the paid base; it is a second line item.

➡️ Given Q12's "pay to make it easy" posture, take the tagging add-on: season/grad-year/role segmentation is exactly what the fall debrief wished for, and $9/month for the season is trivial next to the time it saves. But it is a real recurring cost, so it is your call, and the fallback (no tags; segment by exporting the signups sheet and pasting recipient lists) is workable if you would rather not.

✅ SETTLED (Steve, round 2): no tagging add-on for now. The signups sheet holds enough metadata (grade, season, parent emails per player) to recreate any tag set later if segmentation becomes necessary. This also settles Q19: subscribers are created plain, no tags.

## Q17. Unsubscribe semantics on later edits

A family returns to /signup in October and unchecks the mailing-list box. Does the webapp actively unsubscribe them from Buttondown?

➡️ No. Subscription is a one-time action at first profile save; after that, the dashboard shows live subscription state and points at the unsubscribe link every newsletter already carries. Webapp-initiated unsubscribes are a destructive action driven by a checkbox that families will toggle accidentally while editing other fields. The checkbox disappears after first save, replaced by the status row.

✅ SETTLED (Steve, round 2, against the recommendation and better than it): the webapp does support both directions, but as explicit per-email join / opt-out actions sitting next to the live status, not as a checkbox side effect of saving the profile. That answers the accidental-toggle concern (an explicit button is an intentional act) while giving families full self-service. Unsubscribes go through the Buttondown API as a deliberate action on that one email. Explicitly: any parent email showing "not subscribed" gets a one-click subscribe button right there.

## Q18. Do student emails get subscribed too?

We now collect optional student personal and SPS emails. The plan only auto-subscribes parent emails.

➡️ Parents only for auto-subscribe. Middle schoolers do not read newsletters, SPS addresses may filter external mail, and list cost is now per-subscriber. The dashboard's subscribe link covers any student who genuinely wants on.

✅ SETTLED (Steve, round 2): no auto-subscribe for students. The student personal email gets the same in-app one-click subscribe button as parent emails, opt-in only. SPS student addresses are never offered subscription at all (external mail bounces off SPS filtering), so no subscribe UI appears next to the SPS email field.

## Q19. Buttondown tag scheme

Proposed tags on subscribe: season (`2026-fall`), graduation year (derived from grade), and role (`parent`). Applied at creation; future seasons append their season tag to returning emails.

➡️ Ship exactly those three. Grad year ages correctly across seasons (grade does not), and season tags let the spring list target or exclude fall families. Anything finer (per-team tags) waits until teams exist in Phase D.

✅ SETTLED (via Q16b): no tags at all for now; the tagging add-on is skipped and the signups sheet's metadata is the future source for recreating tags if ever needed.

## Q20. Does fall 2026 retire the Google Groups mailing list?

Today there are two systems of record: the portal checks Buttondown live, while the coach sheet's three mailing-list columns join a manually exported Google Groups CSV. Fall adds Buttondown-driven auto-subscribe, which makes the Groups columns actively misleading (a family subscribed via signup shows "not a member" there).

➡️ Retire the Groups join for fall: Buttondown becomes the single mailing-list truth. The coach sheet's mailing-list columns switch to a Buttondown-derived source (export dropped in the Drive folder, same newest-file pattern) or are simply dropped if the signup sheet's Subscribed At column covers the coach's need. What happens to the Google Group itself (kept for posting? archived?) is Steve's call and out of webapp scope.

✅ SETTLED (Steve, round 2): confirmed; the move already happened in spring 2026. Google Groups is dead. Buttondown is the single mailing-list system of record, and the fall coach sheet's mailing-list columns must not resurrect the Groups CSV join (a Buttondown-derived source or the Signups sheet's subscription columns replace them during the coach sheet season deploy).

## Q21. Milestone restructure for the compressed timeline

Round 1 moved the effective deadline from Sept 18 to Sept 9 with tryouts Sept 10-11. The plan's milestones were built for the old timeline: B (status dashboard) ~Sept 5 and C (photo upload) ~Sept 12. Two consequences: the signature-chase dashboard arriving Sept 5 leaves only four days of chase, and photos arriving Sept 12 misses tryouts, where coaches facing 60+ unfamiliar kids need ID photos most.

➡️ Restructure: Milestone A (announce-ready, ~Aug 30) absorbs the Final Forms status display (the join + three booleans + physical status + refresh button), since round 1 settled all its design questions and the ingestion is already live. Photo upload becomes the new B, targeted before tryouts (~Sept 8), explicitly framed as "help coaches learn names at tryouts". Prefill/seeding of contact fields can trail into early September if time is tight, since it optimizes convenience rather than the chase. Confirm and the plan's section 9 gets rewritten.

✅ SETTLED (Steve, round 2), more aggressive than the recommendation: **/signup ships end of week (Friday Aug 28) including player photo upload**, governed by a one-pass principle: a family works through /signup exactly once and it captures everything we want up front (jersey/t-shirt size explicitly included; it was already in the profile field list). The implementation plan must enumerate every question the form asks, field by field; that spec is a round 3 deliverable. Status dashboard (Final Forms join + status display + refresh button) follows immediately after, by early September, so the whole chase window Sept 2-9 has it. Feasibility note for the Aug 28 target: photo upload cannot use the service account (no Drive storage quota); it reuses the finalforms-export OAuth refresh-token identity, which is a known pattern but real work. Plan section 9 rewritten to match.

## Q22. What happens to /signup after the deadline?

Sept 9 passes, rosters form. A new family moves to Madison on Oct 1. Does /signup close, stay open silently, or stay open with changed messaging?

➡️ Stays open all season with a banner after Sept 9: "Tryout registration has closed; late signups are welcome, contact the coaches". The row still gets created (it becomes the roster/portal spine anyway), and the coach decides case by case. Closing it would just reroute late families to email with less information attached.

✅ SETTLED (Steve, round 2): two phases. After the Sept 9 deadline, /signup stays open with the banner "Tryout registration has closed. Late signups are not guaranteed. Go ahead and submit and contact the coaches at madisonultimate@gmail.com." About a week after tryouts (~Sept 18), new-player signup closes fully. Precision recorded: "fully close" disables new-row creation only; the /signup lookup must keep working all season so existing families on a new device can still reach their player page. Post-close arrivals are handled manually by the coaches.

## Q23. The not-cleared-by-tryouts policy

What is true for a player who has not completed Final Forms (including school clearance) by Sept 10: cannot set foot on the field at tryouts? Can attend but not participate? Case-by-case? The announcement and the dashboard's red states should state the real consequence, because it is the strongest motivator available; but it has to be the actual policy, not invented copy.

➡️ Recommend confirming with SPS athletics what is legally true (uncleared players usually cannot participate at all in SPS sports), then publishing exactly that: "Players must be fully cleared in Final Forms to try out on Sept 10-11. Not cleared means not on the field." Round 3 drafts all family-facing copy (announcement, not-found message, deadline banners) once this is answered.

✅ SETTLED (Steve, round 2): confirmed as SPS rules, no investigation needed. Final Forms not fully complete means the player cannot set foot on the field. All family-facing copy states this plainly.

---

# Round 3: deliverables for review

Round 2 is complete; every design question (Q1-Q23) is settled. No open decisions remain, so round 3 is review of the two artifacts the decisions produced:

1. **The plan doc** (`docs/fall-2026/signup-plan.md`) has been consolidated: sections 2-9 and 11 now state the settled design with no TODOs.
2. **The form spec and copy pack** (`docs/fall-2026/signup-spec.md`, new file): every question the form asks, field by field (label, type, required/optional, seed source, sheet column), plus drafts of all family-facing copy (deadline, not-found, banners, subscribe notice). This is the one-pass guarantee: read it top to bottom once and ask "is anything missing?".

Comment inline on either file; when both are approved, the shared understanding is confirmed and build starts.
