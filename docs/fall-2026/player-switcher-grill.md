# Player Switcher Grill: Round 1

Working document for the design grill of the multi-player switcher UX on `/signup` and `/player/[playerId]`. Each question ends with a recommended answer (➡️). Respond inline (comment on a question, or write your answer below it); agreement can be as short as "yes". Round 2 questions unlock as these get settled.

Confirmed facts below come from reading `src/components/PlayerSwitcher.tsx`, `src/lib/player-switcher.ts`, `src/app/player/[playerId]/page.tsx`, and `src/components/PlayerProfileForm.tsx`, plus a live browser session against localhost:3000 on 2026-08-29 (a real save-error was simulated to check the layout bug in Q4, not just read from code).

## Confirmed facts

1. `PlayerSwitcher.tsx` renders nothing but a plain "Not this player?" text link when the device has only one remembered player (`others.length === 0`). With two or more remembered players it renders a "Switch player" list (switch + remove buttons per player) plus the same link.
2. `PlayerSwitcher` is the very last element on `/player/[playerId]`, after the whole Player Profile card. `PlayerProfileForm` has a `fixed bottom-0 left-0 right-0 z-20` sticky Save bar; the page wrapper uses a static `pb-20`. Reproduced live: when a save fails, the bar grows to include an error alert and that height isn't accounted for by the static padding, so the switcher and "Not this player?" link end up completely covered and unreachable until the error clears.
3. Even without an error, the switcher sits at the bottom of a long, multi-section profile form, a weak position for navigation regardless of remembered-player count.
4. Storage (`src/lib/player-switcher.ts`) is a simple per-device localStorage list (`mu_signup_players`) of `{playerId, displayName}`, MRU-ordered, with `rememberPlayer` (called on every successful `/player/[playerId]` load) and `forgetPlayer`. No cap on list size. Removing only ever touches this localStorage list; there is no backend delete path and this grill does not add one.
5. `docs/fall-2026/signup-plan.md` section 4 says only: "localStorage keeps a per-device list of accessed players (PlayerID + display name only) with a quick switcher and per-player remove." It does not specify placement or one-vs-many-player behavior, and says nothing about `/signup` showing this list.
6. New requirement from Steve (2026-08-29, mid-grill): `/signup` itself should show remembered players (e.g. a dropdown), let a family switch directly to one, and remove one from local storage, without touching backend data.

## Q1. One shared switcher component across both pages? ✅ SETTLED

Steve's new requirement means `/signup` needs the same "pick from remembered players, switch, remove" behavior `PlayerSwitcher.tsx` already has for `/player/[playerId]`. Should both pages share one `PlayerSwitcher` component (rendered differently per context), or should `/signup` get its own dedicated component?

➡️ One shared component. Both are "act on the same `mu_signup_players` list" UIs; forking them risks remove/MRU-ordering behavior drifting the next time either changes.

✅ SETTLED (Steve, round 1, 👍): one shared component, rendered differently per page context (see Q9 for what "differently" means on `/signup`).

## Q2. What does picking a remembered player from the `/signup` dropdown do? ✅ SETTLED

Does it navigate straight to `/player/$playerId` (skipping the name/last-name/DOB lookup form, since we already have the PlayerID), or prefill the lookup form for the family to hit Continue?

➡️ Navigate straight through. The localStorage PlayerID isn't sensitive and was written by this same device on a prior successful lookup; re-running the name+DOB gate against the player who just cleared it is friction with no security benefit.

✅ SETTLED (Steve, round 1, 👍): navigate straight to `/player/$playerId`.

## Q3. Where does the dropdown sit relative to the existing identity form on `/signup`? ✅ SETTLED, refined by Q9

Options: (a) dropdown replaces the form, with a "sign up a different player" link to reveal it; (b) dropdown shown above the form, with the form always present below for a new player; (c) something else.

➡️ (b). `/signup` still has to work as the entry point for a new sibling or a first-time player on a shared device even when the dropdown is populated; always-visible is simpler than a reveal/hide toggle.

✅ SETTLED (Steve, round 1, 👍 on the general shape): dropdown above, form below. Steve's follow-up comment on Q4/Q5 (below, now Q9) makes this more specific: it's not just "both visible", it's two deliberately distinct paths under the intro heading, and picking one visually de-emphasizes the other. Q9 carries the exact mechanism.

## Q4. Placement on `/player/[playerId]`: header/nav vs. current bottom-of-form position? ✅ SETTLED for `/player/[playerId]` only

Fact 3 says the current bottom position is weak. Given Q1's shared-component answer, should the switcher move to a persistent header element (visible without scrolling, same spot on both pages) instead of living inline at the bottom of page content?

➡️ Yes. This also removes fact 2's sticky-Save-bar overlap bug for free: content that isn't near the bottom of the page doesn't care how tall the save bar gets.

✅ SETTLED (Steve, round 1, 👍 on `/player/[playerId]`): switcher moves to the top of `/player/[playerId]`, resolving the sticky-Save-bar overlap by construction. Steve pushed back on "same spot on both pages": `/signup` does **not** get a header switcher (see Q9). The shared component (Q1) now needs a mode that renders as a top-of-page control on `/player/[playerId]` and as an inline two-path chooser on `/signup`.

## Q5. Does moving to a header retire the "Not this player?" bottom link, or keep both? ✅ SETTLED

If the switcher moves to a persistent header, does the bottom "Not this player?" link (today the only affordance in the one-player case) get removed, or kept as a redundant path for someone who scrolled past the header?

➡️ Remove it. A persistent header switcher is strictly more discoverable; keeping both is two places for the same job to drift out of sync (already a smell in today's one-vs-many branching).

✅ SETTLED (Steve, round 1, 👍): removed on `/player/[playerId]`. Its old job on `/signup` (getting back to the lookup/signup form) is now handled by Q9's "sign up a new player / find existing" path, so nothing needs to replace it there either.

## Q6. Does the header switcher look different with one remembered player vs. two-plus? ✅ SETTLED

With a persistent header, should exactly one remembered player still get a plain text link, or should the header always show a real control (name + menu with switch/remove/"sign up another player"), even for one entry?

➡️ Always the same control shape, even for one player. A control that changes its whole visual form once a sibling signs up is worse than one that's consistently discoverable from day one; only the menu's *contents* should vary.

✅ SETTLED (Steve, round 1, 👍): same control shape regardless of remembered-player count, on `/player/[playerId]`. Q9 covers the equivalent question for `/signup`, where "one vs. many remembered players" changes something more structural (whether the "choose a player you already signed up" path exists at all).

## Q7 (parked for round 2 → now Q10). Other multi-player UX gaps ✅ carried forward

Once placement and the `/signup` dropdown are settled, round 2 covers: a cap on remembered-player list size, whether "remove" needs a confirmation step (it's destructive to the device's convenience list, if not to backend data), touch-target sizing for switch/remove on mobile (this is a mobile-first app per `CLAUDE.md`), and whether `docs/fall-2026/signup-plan.md` section 4 needs updating once placement is settled (it almost certainly does, since it's silent on where the switcher lives and doesn't mention `/signup` showing it at all).

➡️ Carried forward unchanged to Q10.

---

# Round 2

Triggered by Steve's comment on Q4/Q5 (round 1): the `/signup` page needs a more deliberate design than "header switcher," because `/signup` isn't just about switching between already-known players, it's a fork between "continue as a player I already signed up" and "sign up a new player / look one up." Steve's sketch:

> Under "Let's find (or start) your player's page," two options: (1) choose a player you already signed up — only appears if there's a previously signed-up player; choosing here greys out the "find / signup your player" option; (2) sign up a new player or find your existing signup.
>
> Steve's own open question: should the choice be a deliberate, explicit action (e.g. radio buttons), or can it be implicit based on which form element the family starts interacting with?

## Q8. Explicit choice (radio-button-style) vs. implicit choice (inferred from interaction)? ✅ SETTLED

Explicit: two visibly separate options/cards, family clicks one to commit, the other visually greys out. Implicit: both are just present and interactive; clicking a remembered player in the list "chooses" that path, and starting to type in the name/DOB fields "chooses" the other, with no separate selection step.

➡️ Explicit. An implicit design has an ambiguous middle state: a family that taps a name field, changes their mind, and clicks a remembered player has now half-filled a form that's still visible and still looks live, which is confusing on a phone screen where both blocks are close together. A deliberate choice (even a lightweight one, like clicking a player card vs. clicking "sign up a new player / find existing") has no ambiguous state, costs one tap, and matches the mental model Steve described ("deliberately choose which path"). Graying out the unchosen path is also the clearest way to signal "you're not filling this out right now" without hiding it outright (a family should still be able to see the other path exists and back out to it).

✅ SETTLED (Steve, round 2, 👍): explicit choice.

## Q9. Exact layout and reversibility of the two-path chooser ✅ SETTLED

Given Q8 (explicit choice), specifics: (a) what does the "choose a player" option look like when there's exactly one remembered player vs. several (a single card vs. a list, echoing Q6's "same shape" principle for `/player/[playerId]`)? (b) once a family picks a path (e.g. clicks a remembered player card), is the choice instantly final (navigates immediately, per Q2) or does picking a remembered player still require confirming before navigating? (c) can a family back out of a chosen path (e.g. they clicked into the "sign up new" form, but meant to pick their existing player) without reloading the page?

➡️ (a) Same shape regardless of count, consistent with Q6: a "Your players" block listing every remembered player as a tappable card (one card when there's one, more when there's more), never a dropdown-vs-single-link split — that inconsistency is exactly what's wrong with today's one-vs-many `PlayerSwitcher` branching. (b) Instant navigation on tap, no confirmation step: Q2 already established the PlayerID hop is trusted and low-stakes, and adding a confirm dialog here just to mirror the "greyed out" visual would be a second friction point for no safety benefit. (c) The "grey out" is purely visual emphasis, not a lock: clicking into the other block (e.g. starting to type a name) instantly re-highlights it and de-emphasizes the players list, since nothing has been submitted yet. Only an actual navigation (clicking a player card, or clicking Continue on the form) is the point of no return.

✅ SETTLED (Steve, round 2, 👍 on b and c; (a) confirmed explicitly: "yeah, lets give it similar treatment. it's a list of 1."): a "Your players" list rendered the same way regardless of count (a list of 1 uses the list treatment, not a special single-card/link variant); instant navigation on tap; graying out is visual only, reversible by interacting with the other block, with the tap/Continue click as the only real commit point.

## Q10. Other multi-player UX gaps (from Q7) ✅ SETTLED

- **List size cap**: `rememberPlayer` has no cap today; a multi-season family or a shared school device could accumulate a long list. Should `rememberPlayer` cap the list (e.g. keep the most recent N, evicting the oldest) or stay unbounded?
- **Remove confirmation**: `forgetPlayer` only affects this device's convenience list, not backend data (fact 4). Does "remove" still warrant a confirmation step (native `confirm()`, or an inline "tap again to confirm"), or is undo-by-re-lookup (the family can always find the player again via `/signup`'s form) sufficient given the low stakes?
- **Touch targets**: today's remove button in `PlayerSwitcher.tsx` is small text (`text-xs`) next to a switch button, both inside a tight `flex` row. On the mobile-first sizing this app targets (375×812 per `CLAUDE.md`'s testing guideline), is that enough separation/target size to avoid mis-taps between "switch to this player" and "remove this player"?
- **Docs**: does `docs/fall-2026/signup-plan.md` section 4 need updating once this grill settles?

➡️ Cap at a small number (e.g. 6) evicting oldest by MRU order; unbounded growth is a real scenario for a coach's own test device or a multi-year family and an unbounded list on `/signup` is exactly the crowded-UI problem Q9 is trying to avoid. No confirmation on remove: it's a device-local convenience list, the backend row is untouched (fact 4), and re-adding the player is one lookup away, so a confirm dialog is friction disproportionate to the stakes. Touch targets: give remove a real tap target (min ~44px) and put visual space (not just a flex gap) between it and the switch action, since this is exactly the kind of mis-tap mobile-first testing is supposed to catch. Docs: yes, section 4 should gain a sentence on placement (`/player/[playerId]` header; `/signup` two-path chooser) once this grill is marked settled, so the plan doc stops being silent on where the switcher actually lives.

✅ SETTLED (Steve, round 2): **no cap** on list size ("I am not worried about this. I think it's an edge case to have many players. Lets just keep it simple and let the list grow."), overriding the recommended cap-at-6; the list stays unbounded and MRU-ordered as it is today. No confirmation on remove: 👍. Touch targets: no objection raised, recommendation stands (real ~44px tap target, visual separation from the switch action, per the mobile-first testing guideline in `CLAUDE.md`). Docs: 👍, `signup-plan.md` section 4 gets updated (see below).
