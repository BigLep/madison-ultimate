# Madison Ultimate Portal

The family-facing web portal for Madison Ultimate: season signup, player status, and availability. All player data is mastered in Google Sheets; families never have accounts or passwords.

## Language

### Player identity

**Player**:
A student participating in (or signing up for) a Madison Ultimate season. One player, one signup row, one PlayerID.

**PlayerID**:
A player's permanent identity in our system: a short random opaque slug minted when the signup row is created, and never changed afterward. Everything durable (URLs, coach sheet joins, photo mapping, device switcher) hangs off it.
_Avoid_: deriving it from name or birthdate; lookup key, Portal ID (the legacy equivalent it replaces)

**Player Lookup**:
Finding a player row from what a family types: normalized last name and full birthdate must match exactly, and normalized preferred name disambiguates only when several rows share both (twins), using as many leading letters as needed. Matching runs against current field values; there is no stored or derived key.
_Avoid_: lookup key, Portal Lookup Key (legacy derived-key scheme this replaces)

**Normalization**:
The rules that make typed names comparable: trim, lowercase, strip internal whitespace, strip apostrophes, fold accents to plain letters, keep hyphens. Applied identically to typed input and stored fields.

**Preferred Name**:
The first name a player actually goes by, chosen by the family at signup. Feeds the lookup key and all family-facing display.
_Avoid_: first name (ambiguous with Legal First Name), nickname

**Legal First Name**:
The player's first name as registered with the school, collected only when it differs from the preferred name. Used to disambiguate the Final Forms join, never for display.

**SPS Student ID**:
The district-wide student identifier from Final Forms (spsStudentId). Written onto the signup row at the first successful Final Forms match and authoritative for every Final Forms lookup after that.
_Avoid_: StudentID (ambiguous about whose ID scheme)

**Final Forms Join**:
The one-time match from a signup row to its Final Forms record, on birthdate + last name, disambiguated by legal first name (twins). Succeeds once, then hands off to SPS Student ID. That first success is also the only moment Seeded Fields are copied onto the row (ADR 0004). Attempted the same way regardless of what triggers it: a family visiting `/player`, a Final Forms Backfill run, or Seed Signups from Final Forms (where the row is created in the same run).

**Final Forms Backfill**:
An admin-triggered, on-demand pass over every signup row missing SPS Student ID, attempting the Final Forms Join for each one, for players who never returned to `/player` after finishing Final Forms. Never overwrites a row that already has SPS Student ID. Runs as the first pass of Seed Signups from Final Forms.
_Avoid_: backfill (bare, elsewhere in this glossary reserved as a contrast to Photo Carryover)

**Seed Signups from Final Forms**:
The admin action that creates a Seeded Signup for every Final Forms student with no signup, after first running Final Forms Backfill so an existing unjoined row is joined rather than duplicated. Creates nothing in a last-name-plus-birthdate group where a human still has to decide (Ambiguous Match, suspected duplicate signups, Match Discrepancy). Idempotent; safe to re-run after every export.
_Avoid_: import, sync, pre-populate

**Seeded Signup**:
A signup row created by Seed Signups from Final Forms rather than by a family at step 0: identity fields and SPS Student ID come from Final Forms, Preferred First Name starts equal to the legal first name, Legal First Name starts blank, and Seeded At records the moment. From then on the family owns the row exactly as if they had created it.
_Avoid_: placeholder row, ghost signup, pre-registration

**Profile Complete**:
A signup whose Player Info, Caretaker Info, and Photo Upload checklist items are all done, as the family sees them on their player page. Defined and written by the portal on every change to the row; the coach sheet passes it through and never computes its own. Volunteering answers and Final Forms Status never factor in.
_Avoid_: registered, signed up, Signup Complete

**Ambiguous Match**:
A Final Forms Backfill or seeding outcome: multiple twin candidates were found for a row but legal first name couldn't disambiguate them, so nothing was joined. Distinct from finding no candidate at all.

**Match Discrepancy**:
A Final Forms Backfill or seeding outcome: the row already has an SPS Student ID, but a fresh Final Forms Join would have produced a different one (or, when seeding, a Final Forms record matches a row already joined to a different ID). Surfaced for manual review; never auto-corrected, since SPS Student ID is authoritative once set.

**Possible Match**:
Surfaced alongside an unmatched Final Forms Backfill row: a Final Forms record sharing the row's last name but not its birthdate. The usual cause is a wrong Date of Birth on one side, not two unrelated people; never joined automatically, only shown so a human can compare and fix the signup row's birthdate (or grab the PlayerID to investigate).

**Caretaker**:
An adult responsible for a player (parent, guardian, or otherwise). The signup collects up to two per player; their emails are the newsletter audience and their phone is the emergency contact.
_Avoid_: parent, guardian (except when quoting Final Forms column names, which say Parent 1/2)

**Newsletter**:
The Madison Ultimate email newsletter (Buttondown), the main way we reach families. Family-facing copy always says Newsletter. Next to every eligible email (caretaker 1/2 and student personal, never SPS) the form shows `Newsletter: subscribed|not subscribed` plus a Join or Leave button.
_Avoid_: mailing list (code, the retired Google Group, and coach-sheet columns may still say this)

**WhatsApp Community**:
The family WhatsApp community for questions, photos, carpools, and similar. Join via `/whatsapp`, which the server redirects to the invite. Linked only from signed-up player pages (`/player/$id`) and the player portal — not the public homepage. The invite URL lives in `WHATSAPP_COMMUNITY_JOIN_URL` (env only, never client code or git).

### Final Forms data

**Final Forms Status**:
The registration-progress facts (parent signed, student signed, cleared, physical clearance and expiration). Always read live from the latest Final Forms export, never copied: Final Forms is the only place a family can change them.
_Avoid_: storing or caching these on the signup row

**Seeded Field**:
A profile or contact field (grade, student email/phone, parent names/emails/phones) copied from Final Forms into an empty signup-row cell on first join, without waiting for Save, then owned by the signup row. Never overwrites a value the family already saved; never copied again after the join is established, even if the family later clears the field. Identity fields on a Seeded Signup come from Final Forms at creation but are not Seeded Fields. See ADR 0004.
_Avoid_: prefill (ambiguous about ownership after the copy)

### Photos and media

**Player Photo**:
The identification photo a family uploads for a player, shown in the player's own portal page and used by coaches to learn names. Wanted for every player, regardless of media preference. Stored and identified by PlayerID, never by the family's name for the player; a human-readable name is only ever generated at display time. Replacing it overwrites in place; there is no history of earlier photos.
_Avoid_: headshot, media

**Photo Carryover**:
Copying a returning player's Player Photo from the prior season into the current season's signup row, the moment that row is matched to the prior season's roster by SPS Student ID, so returning families don't have to re-upload. Happens automatically, and never overwrites a Player Photo the family has already set for the current season.
_Avoid_: photo migration, backfill

**Media Opt-Out**:
A family's declaration that photos of their player must not appear in team communications or be shared within the team. Does not affect the Player Photo. The team never posts to social media for anyone, opted out or not.
_Avoid_: photo opt-out (conflates with Player Photo)
