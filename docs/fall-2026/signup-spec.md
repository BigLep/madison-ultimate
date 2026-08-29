# Fall 2026 Signup: Form Spec and Copy Pack

Review artifact from the 2026-08-26 design grill (round 3), amended by round 2 of implementation feedback (2026-08-27, see `docs/fall-2026/signup-grill-round-2.md`). This is the one-pass guarantee: every question the form asks, in order, with its options, seed source, and sheet column, plus every piece of family-facing copy. Read top to bottom once and ask "is anything missing?". Comment inline; approval here means build starts against exactly this.

Conventions: sheet columns live in the `Signups` tab of the "2026 Fall Signups" spreadsheet. "Seed" means copied from Final Forms into an empty signup-row cell on first join, then owned by our row. All fields remain editable on return visits unless noted.

## Step 0: identity (the lookup)

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 0.1 | Player's preferred first name | text | yes | no | Preferred First Name |
| 0.2 | Player's last name | text | yes | no | Last Name |
| 0.3 | Player's date of birth | date picker | yes | no | Date of Birth |
| 0.4 | Player's legal first name (only if different from preferred, as registered with the school) | text | no | no | Legal First Name |

This same field (label: "Legal first name (only if different)") also appears editable in place in Step 1's Player section, since identity fields stay editable per ADR 0001; both copies carry an info bubble (not a link) explaining it's needed to match the Final Forms record — copy C10.

Behavior: Player Lookup on normalized last name + full birthdate; preferred name disambiguates twins with as many leading letters as needed. On no match: content-free near-match check (same last name + birthdate, or same birthdate + similar last name) shows copy block C1 before creating; otherwise the row is created (PlayerID minted) and the family lands on `/player/$playerId`. Honeypot field and minimum-time-to-submit check ride on this form.

## Step 1: player profile

Ordered as presented. Grouped headings appear in the UI.

### 🏃 Player

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.1 | Grade this fall | select: 6, 7, 8 | yes | Final Forms `Grade` | Grade |
| 1.2 | Elementary school attended | select (see options below) with an "Other" free-text fallback | no | no | Elementary School |
| 1.3 | Pronouns (select all that apply) | multi-select: he, him, she, her, they, them | no | no | Pronouns |
| 1.4 | Gender identification | select: Girl-Matching/Gx/Non-binary; Boy-Matching/Bx/Non-binary | no | Final Forms `Gender` | Gender Identification |
| 1.5 | Allergies or medical info coaches should know | textarea | no | no | Allergies |
| 1.6 | Other sports and activities this fall (helps us plan around conflicts) | textarea | no | no | Competing Sports and Activities |
| 1.7 | Jersey / t-shirt size | select: YM, YL, AS, AM, AL, AXL | yes | no | Jersey Size |
| 1.8 | Ultimate playing experience | textarea | no | no | Playing Experience |
| 1.9 | What does the player hope to get out of the season? | textarea | no | no | Hopes |
| 1.10 | Anything else we should know? | textarea | no | no | Other Info |

Pronouns/gender control types and the elementary school dropdown were decided in round 2 (2026-08-27); see `signup-grill-round-2.md`. Gender identification carries a "learn more" link (copy C11) alongside the field, not just an info bubble. Helper text (subtext shown under the field, not a separate copy block — see round 2 for sourcing): 1.5 Allergies: "If NONE, please list NONE." 1.6 Competing Sports: "It's totally fine if your athlete has competing priorities. We just want to get a sense of where ultimate is in the scheduling mix for this season." 1.7 Jersey Size: "What size jersey does the player normally wear? Y = youth, A = adult; these are unisex sizes." 1.8 Playing Experience: "For example, how many past seasons has your player played? Have they attended ultimate frisbee summer camps? Are there other sports the player has played competitively previously?" 1.9 Hopes: "Is there a goal the player has for themself this season? Do they have a hope for the team this year?" 1.10 Other Info: "List anything else we should know about your player (e.g., if they are new, what other sports they have played, any barriers to participation, behaviors to be aware of)."

Elementary school options: Alki Elementary School; Arbor Heights Elementary School; Concord International School; Fairmount Park Elementary School; Gatewood Elementary School; Genesee Hill Elementary School; Highland Park Elementary School; Holy Rosary School; Hope Lutheran School; Lafayette Elementary School; Louisa Boren STEM K-8; Our Lady of Guadalupe School; Pathfinder K-8 School; Roxhill Elementary School; Sanislo Elementary School; Tilden School; West Seattle Elementary School; West Seattle Montessori School & Academy; Westside School; Other (free text).

### 📞 Player contact (all optional)

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.11 | Player's personal email | email | no | Final Forms `Email` if not an @seattleschools.org address | Student Personal Email |
| 1.12 | Player's SPS email | email | no | Final Forms `Email` if @seattleschools.org | Student SPS Email |
| 1.13 | Player's cell phone | tel | no | Final Forms `Cell Phone` | Student Cell Phone |

### 👪 Caretakers

Caretaker 2 group is identical to Caretaker 1, always visible, and optional.

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.14 | Caretaker 1 name | text | yes | Final Forms `Parent 1 First/Last Name` | Caretaker 1 Name |
| 1.15 | Caretaker 1 email | email | yes | Final Forms `Parent 1 Email` | Caretaker 1 Email |
| 1.16 | Caretaker 1 phone (the number to contact in an emergency) | tel | no | Final Forms `Parent 1 Cell Phone`, then Home, then Work | Caretaker 1 Phone |
| 1.17-1.19 | Caretaker 2 name / email / phone | as above | no | Final Forms Parent 2 equivalents | Caretaker 2 Name / Email / Phone |

### 📸 Media and photo

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.20 | Media opt-out: check if you do NOT want photos of your player used in team communications or shared within the team. (We never post players to social media either way.) | checkbox, unchecked default | no | no | Media Opt-Out |
| 1.21 | Player photo (helps coaches learn names; used in the portal and by coaches only) | drag-and-drop / file upload, shown for everyone | no | no | Photo Drive File ID |

### 👊 Coach volunteering

Split out from the general volunteering question in round 2 (2026-08-27) so coaching interest gets dedicated attention rather than being buried in a checkbox list.

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.22 | Are you interested in helping coach? | select: Yes; Maybe (I'd like to talk more about the possibility); No | no | no | Coach Volunteering Interest |

Supporting copy: C12 (coaching description + learn-more link + female-leadership plug + "already talked to Coach Steve" note).

### 🙋 Other volunteering

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.23 | Ways you might help this season (check any) | multi-select: game-day help / field manager; team photographer; team admin / communications; snacks / logistics; not sure yet, tell me more; other | no | no | Volunteer Roles |
| 1.24 | Anything more about how you'd like to help? | text | no | no | Volunteer Notes |

"Helping coach at practices" moved out of this list into its own Coach Volunteering question above (round 2). Supporting copy: C13.

### 💬 Communication

Closing section (`id="communication"`). Holds the general-feedback question (added back in round 2 from the old Google Form; not about the player specifically) plus the family communication invites.

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.25 | Anything else you want to share? | textarea | no | no | Additional Feedback |

Supporting copy in order: C14 (under the textarea), then C2b (WhatsApp), then C2 (newsletter consent).

### Save

Saving: writes the row, auto-subscribes caretaker and student personal emails unless they have already opted out of Buttondown (`type: "regular"`), never the SPS email, then shows the status dashboard. C2 / C2b live in the Communication section above, not as a separate block on the Save button.

## Status dashboard (on /player/$playerId)

Revised round 2 (2026-08-27): the profile form's Save no longer requires completeness (grade, jersey size, and Caretaker 1 name/email stay visually marked required but don't block saving), and the page no longer switches between a "form" view and a "dashboard" view. Once a signup row exists, `/player/$playerId` always shows Final Forms status at the top and the full editable profile form below it, regardless of how much of the profile has been filled in. This exists specifically so a family can fix a typo'd identity field (e.g. birthdate) and immediately see an updated Final Forms status, without being forced to finish the rest of the profile first.

Rows, in order: Final Forms (see states below, now shown unconditionally); Profile (Complete, or "Missing: Grade, Jersey Size, Caretaker info" — informational only, doesn't block anything); Photo (shown, or upload); Newsletter (live `Newsletter: subscribed|not subscribed` plus join/leave next to each caretaker email and the optional player personal email; SPS email never offered). Plus the device switcher ("not this player?").

**Newsletter row (revised 2026-08-29):** the "Newsletter" label itself links out to `APP_CONFIG.MAILING_LIST_JOIN_URL` (the Buttondown subscription-management page), so a family can inspect or manage their subscription beyond a simple toggle. The Join/Leave button carries a 📬/📭 icon (mailbox-up for Join, mailbox-down for Leave) so the two states are visually distinct at a glance, not just by label text. Both are deliberate polish on top of the plain `Newsletter: subscribed|not subscribed` + join/leave wording above, not a change to the underlying subscribe/unsubscribe behavior.

Final Forms row states:

- Found and not found both open with copy C15 (SPS-required, external, link to Final Forms) and close with the AD / coach contact lines from C5.
- Found: parent signed / student signed / physical cleared, each as a distinct check; physical clearance/expiration date; last-synced timestamp plus inline refresh (copy C3/C4).
- Not found: copy block C5 (couldn't-find + two reasons; physical requirement and contacts now live in C15 / shared help).

## Copy pack (drafts for review)

**C1, near-match warning (step 0):** "We may already have a signup for this player. Double-check the spelling of the name and birthdate. If this is a sibling or you are sure this is a new signup, continue."

**C2, mailing-list consent (Communication section, after C2b):** "Saving subscribes the caretaker and player personal emails above to the Madison Ultimate newsletter, our main way of reaching families. Anyone who has already left stays unsubscribed. You can leave at any point, right from this page." ("Madison Ultimate newsletter" links to https://buttondown.com/madisonultimate/, which has a Manage Subscription button.)

**C2b, WhatsApp community (Communication section, before C2):** WhatsApp logo plus "Join our WhatsApp community to ask questions ❓, share photos 📸, arrange carpools 🚗, etc. (Learn more)." "WhatsApp community" links to `/whatsapp` (server redirect to the env invite; never the invite URL in client code). Shown only on signed-up player pages, not the public homepage. Learn more uses `WHATSAPP_LEARN_MORE_URL`.

**C3, refresh prompt:** "Data last synchronized with Final Forms on [time] ([relative]). If you have updated Final Forms since then, click here and we'll try again." ("click here" is the action. Omit the first sentence if there is no timestamp.) `[relative]` is a parenthetical relative-time hint (e.g. "2 days ago"), added 2026-08-29 via `formatRelativeHighestUnit`: proximity to now is exactly what a family needs to judge whether "since then" plausibly covers their own recent Final Forms edit, so it's worth showing alongside the absolute local timestamp rather than instead of it. Omit the parenthetical (not just the whole sentence) when `dataAsOf` is missing or unparseable, since `formatRelativeHighestUnit` returns `''` in that case; a future/skewed timestamp still renders "just now" rather than being hidden.

**C4, refresh responses:** started: "Great, we're syncing with Final Forms now. Check back and refresh in about 5 minutes." Already running: "A sync is already underway; refresh in a few minutes."

**C5, Final Forms not found:** Shown after C15. "We couldn't find [preferred name] in the school's Final Forms registration yet. Two common reasons: (1) You haven't registered in SPS Final Forms yet. (2) The name we have doesn't match school records; enter the last name and legal first name exactly as they appear in Final Forms above. Preferred name is what we'll actually use with your player." AD and coach contacts follow as shared help (same as the found state).

**C6, deadline banner (until Sept 9):** "Complete signup and Final Forms by end of day Wednesday, September 9, and sooner is better: the school needs time to process clearance. SPS rules: players who aren't fully cleared in Final Forms can't set foot on the field at tryouts (Sept 10-11)."

**C7, post-deadline banner (Sept 10-18):** "Tryout registration has closed. Late signups are not guaranteed. Go ahead and submit and contact the coaches at madisonultimate@gmail.com."

**C8, closed state (after ~Sept 18):** "Signups for the fall season are closed. Contact the coaches at madisonultimate@gmail.com." (Lookup for existing players keeps working.)

**C9, announcement email:** drafted separately in the coach Gmail as part of Milestone A, using C6's deadline framing, the /signup link (dub.sh short link), and the one-link promise: "one page that shows exactly what you've done and what's left."

**C10, legal first name info bubble (step 0 and step 1, added round 2):** explains that legal first name is used to match the player's Final Forms record when last name and birthdate alone aren't enough to disambiguate (e.g. twins); not published elsewhere.

**C11, gender identification learn-more link (added round 2):** links to https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#4d6c4da46f7583d9a13a8176d948132c.

**C12, coach volunteering supporting copy (added round 2):** "All coaches work together to plan and execute practice and game strategies. New coaches will be supported by experienced staff/coaches and utilized in a way to help you and the program succeed. You aren't obligated if you do say yes. You don't have to be there all the time. Prior Ultimate Frisbee coaching experience is not required." Plus a learn-more link to https://madisonultimate.notion.site/Volunteering-60ec4da46f7583df9a2d015cf5cb03b2. Plus a plug: "We're especially hoping to hear from moms and other women interested in coaching; the team benefits from more female leadership on the sideline." Plus a note: "Already talked to Coach Steve about coaching? No need to fill this out again."

**C13, other volunteering supporting copy (added round 2):** "Team admin - helps organize attendance and other admin duties. Snack organizing - helps organize family volunteers for after game snacks. T-shirt ordering - helps collect info on who needs a jersey, and what sizes we need. And other opportunities."

**C14, Communication feedback supporting copy (added round 2 as "Anything else"):** "Feel free to pass along any other ideas, feedback, or suggestions. Alternatively feel free to email madisonultimate@gmail.com anytime."

**C15, Final Forms explainer (under "SPS Final Forms Status", every state):** "Seattle Public Schools requires every player to complete SPS Final Forms. That's the school's athletics registration, separate from this signup. A sports physical within the last 2 years is also required." ("SPS Final Forms" links to https://seattleschools-wa.finalforms.com.) Followed by shared help: "If you are having trouble inside Final Forms itself (e.g., login, forms, clearance), contact Madison's Athletic Director, Valerie McDonald 📧. Other questions? Email madisonultimate@gmail.com."

## Out of scope, confirmed

No rate limiting or captcha at launch (honeypot + min-time only; Turnstile wired but off). No WhatsApp lookup (phone is emergency contact only). No tags in Buttondown. No masking anywhere. SPS addresses are never offered subscription. No home address, race, ImPACT, or payment data imported, ever.
