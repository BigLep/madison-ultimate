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
The one-time match from a signup row to its Final Forms record, on birthdate + last name, disambiguated by legal first name (twins). Succeeds once, then hands off to SPS Student ID.

**Caretaker**:
An adult responsible for a player (parent, guardian, or otherwise). The signup collects up to two per player; their emails are the newsletter audience and their phone is the emergency contact.
_Avoid_: parent, guardian (except when quoting Final Forms column names, which say Parent 1/2)

### Final Forms data

**Final Forms Status**:
The registration-progress facts (parent signed, student signed, cleared, physical clearance and expiration). Always read live from the latest Final Forms export, never copied: Final Forms is the only place a family can change them.
_Avoid_: storing or caching these on the signup row

**Seeded Field**:
A profile or contact field (grade, student email/phone, parent names/emails/phones) copied from Final Forms into the signup row once, when the family accepts it, and owned by the signup row from then on. Never re-synced from Final Forms.
_Avoid_: prefill (ambiguous about ownership after the copy)

### Photos and media

**Player Photo**:
The identification photo a family uploads for a player, shown in the player's own portal page and used by coaches to learn names. Wanted for every player, regardless of media preference.
_Avoid_: headshot, media

**Media Opt-Out**:
A family's declaration that photos of their player must not appear in team communications or be shared within the team. Does not affect the Player Photo. The team never posts to social media for anyone, opted out or not.
_Avoid_: photo opt-out (conflates with Player Photo)
