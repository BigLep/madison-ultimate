# Fall 2026 Signup: Form Spec and Copy Pack

Review artifact from the 2026-08-26 design grill (round 3). This is the one-pass guarantee: every question the form asks, in order, with its options, seed source, and sheet column, plus every piece of family-facing copy. Read top to bottom once and ask "is anything missing?". Comment inline; approval here means build starts against exactly this.

Conventions: sheet columns live in the `Signups` tab of the "2026 Fall Signups" spreadsheet. "Seed" means shown from Final Forms as "this is what we have; use it or enter something different", copied once on accept, ours thereafter. All fields remain editable on return visits unless noted.

## Step 0: identity (the lookup)

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 0.1 | Player's preferred first name | text | yes | no | Preferred First Name |
| 0.2 | Player's last name | text | yes | no | Last Name |
| 0.3 | Player's date of birth | date picker | yes | no | Date of Birth |
| 0.4 | Player's legal first name, only if different from preferred (as registered with the school) | text | no | no | Legal First Name |

Behavior: Player Lookup on normalized last name + full birthdate; preferred name disambiguates twins with as many leading letters as needed. On no match: content-free near-match check (same last name + birthdate, or same birthdate + similar last name) shows copy block C1 before creating; otherwise the row is created (PlayerID minted) and the family lands on `/player/$playerId`. Honeypot field and minimum-time-to-submit check ride on this form.

## Step 1: player profile

Ordered as presented. Grouped headings appear in the UI.

### Player

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.1 | Grade this fall | select: 6, 7, 8 | yes | Final Forms `Grade` | Grade |
| 1.2 | Elementary school attended | text | no | no | Elementary School |
| 1.3 | Pronouns | text | no | no | Pronouns |
| 1.4 | Gender identification | text | no | Final Forms `Gender` | Gender Identification |
| 1.5 | Allergies or medical info coaches should know | textarea | no | no | Allergies |
| 1.6 | Other sports and activities this fall (helps us plan around conflicts) | textarea | no | no | Competing Sports and Activities |
| 1.7 | Jersey / t-shirt size | select: YM, YL, AS, AM, AL, AXL | yes | no | Jersey Size |
| 1.8 | Ultimate playing experience | textarea | no | no | Playing Experience |
| 1.9 | What does the player hope to get out of the season? | textarea | no | no | Hopes |
| 1.10 | Anything else we should know? | textarea | no | no | Other Info |

### Player contact (all optional)

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.11 | Player's personal email | email | no | Final Forms `Email` if not an @seattleschools.org address | Student Personal Email |
| 1.12 | Player's SPS email | email | no | Final Forms `Email` if @seattleschools.org | Student SPS Email |
| 1.13 | Player's cell phone | tel | no | Final Forms `Cell Phone` | Student Cell Phone |

### Caretakers

Caretaker 2 group is identical to Caretaker 1 and collapsible ("add a second caretaker").

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.14 | Caretaker 1 name | text | yes | Final Forms `Parent 1 First/Last Name` | Caretaker 1 Name |
| 1.15 | Caretaker 1 email | email | yes | Final Forms `Parent 1 Email` | Caretaker 1 Email |
| 1.16 | Caretaker 1 phone (the number to contact in an emergency) | tel | no | Final Forms `Parent 1 Cell Phone`, then Home, then Work | Caretaker 1 Phone |
| 1.17-1.19 | Caretaker 2 name / email / phone | as above | no | Final Forms Parent 2 equivalents | Caretaker 2 Name / Email / Phone |

### Media and photo

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.20 | Media opt-out: check if you do NOT want photos of your player used in team communications or shared within the team. (We never post players to social media either way.) | checkbox, unchecked default | no | no | Media Opt-Out |
| 1.21 | Player photo (helps coaches learn names; used in the portal and by coaches only) | drag-and-drop / file upload, shown for everyone | no | no | Photo Drive File ID |

### Volunteering

| # | Question label | Type | Required | Seed | Sheet column |
|---|---|---|---|---|---|
| 1.22 | Ways you might help this season (check any) | multi-select: helping coach at practices; game-day help / field manager; team photographer; team admin / communications; snacks / logistics; not sure yet, tell me more; other | no | no | Volunteer Roles |
| 1.23 | Anything more about how you'd like to help? | text | no | no | Volunteer Notes |

### Save

Above the save button, copy block C2 (mailing-list consent notice). Saving: writes the row, subscribes Caretaker 1/2 emails (Buttondown `type: "regular"`, collision header), records Subscribed At, then shows the status dashboard.

## Status dashboard (on /player/$playerId)

Rows, in order: Profile (complete, edit link); Final Forms (see states below); Photo (shown, or upload); Mailing list (live status next to each caretaker email and the optional player personal email, with one-click join / opt-out; SPS email never offered). Plus the device switcher ("not this player?").

Final Forms row states:

- Found: parent signed / student signed / physical cleared, each as a distinct check; physical clearance/expiration date; "data as of [time]"; refresh button (copy C3/C4).
- Not found: copy block C5.

## Copy pack (drafts for review)

**C1, near-match warning (step 0):** "We may already have a signup for this player. Double-check the spelling of the name and birthdate. If this is a sibling or you are sure this is a new signup, continue."

**C2, mailing-list consent (at save):** "Saving subscribes the caretaker email(s) above to the Madison Ultimate newsletter, our main way of reaching families. You can opt out at any point, right from this page."

**C3, refresh button label:** "I believe I've completed Final Forms; check again."

**C4, refresh responses:** started: "Great, we're syncing with Final Forms now. Check back and refresh in about 5 minutes." Already running: "A sync is already underway; refresh in a few minutes."

**C5, Final Forms not found:** "We couldn't find [preferred name] in the school's Final Forms registration yet. Two common reasons: (1) You haven't registered in Final Forms; start at seattleschools-wa.finalforms.com (a sports physical within the last 2 years is also required). (2) The name we have doesn't match school records; enter the last name and legal first name exactly as they appear in Final Forms above. Preferred name is what we'll actually use with your player. Having trouble inside Final Forms itself (login, forms, clearance)? Contact Madison's Athletic Director, Valerie McDonald, at vamcdonald@seattleschools.org. Anything else: madisonultimate@gmail.com."

**C6, deadline banner (until Sept 9):** "Complete signup and Final Forms by end of day Wednesday, September 9, and sooner is better: the school needs time to process clearance. SPS rules: players who aren't fully cleared in Final Forms can't set foot on the field at tryouts (Sept 10-11)."

**C7, post-deadline banner (Sept 10-18):** "Tryout registration has closed. Late signups are not guaranteed. Go ahead and submit and contact the coaches at madisonultimate@gmail.com."

**C8, closed state (after ~Sept 18):** "Signups for the fall season are closed. Contact the coaches at madisonultimate@gmail.com." (Lookup for existing players keeps working.)

**C9, announcement email:** drafted separately in the coach Gmail as part of Milestone A, using C6's deadline framing, the /signup link (dub.sh short link), and the one-link promise: "one page that shows exactly what you've done and what's left."

## Out of scope, confirmed

No rate limiting or captcha at launch (honeypot + min-time only; Turnstile wired but off). No WhatsApp lookup (phone is emergency contact only). No tags in Buttondown. No masking anywhere. No student auto-subscribe. No home address, race, ImPACT, or payment data imported, ever.
