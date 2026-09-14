// Deadline/lifecycle state for the signup banners (spec C6-C8), per
// docs/fall-2026/signup-plan.md section 9. Dates are Pacific-naive (school-year local dates).

export type DeadlineState = 'open' | 'late' | 'closed';

const DEADLINE_DATE = '2026-09-08'; // EOD Tuesday, September 8
const CLOSE_DATE = '2026-09-18'; // ~a week after tryouts; new-player creation closes

export function getDeadlineState(now: Date = new Date()): DeadlineState {
  const today = now.toISOString().slice(0, 10);
  if (today <= DEADLINE_DATE) return 'open';
  if (today <= CLOSE_DATE) return 'late';
  return 'closed';
}

export const DEADLINE_COPY: Record<DeadlineState, string> = {
  open:
    'Complete signup and Final Forms by end of day Tuesday, September 8, and sooner is better: the school needs time to process clearance. SPS rules: players who aren’t fully cleared in Final Forms can’t set foot on the field at tryouts (Sept 9 and 11).',
  late:
    'Tryout registration has closed. Late signups are not guaranteed. Go ahead and submit and contact the coaches at madisonultimate@gmail.com.',
  closed:
    'Signups for the fall season are closed. Contact the coaches at madisonultimate@gmail.com.',
};

/** New-player creation (step 0's create path) is closed once the deadline state reaches 'closed'; lookup for existing players always keeps working. */
export function isNewSignupClosed(state: DeadlineState): boolean {
  return state === 'closed';
}

export type SeasonPhase = 'signup' | 'portal';

/**
 * Season phase (docs/fall-2026/player-portal-grill.md Q20): while new signups can still be
 * created (`open` or `late`) the site drives families to /signup; once `closed`, to the Portal
 * Login at /player. Derived from the deadline dates so there is no second switch to drift.
 */
export function getSeasonPhase(now: Date = new Date()): SeasonPhase {
  return getDeadlineState(now) === 'closed' ? 'portal' : 'signup';
}

/** Where "another player" links go in this phase, and what they say. */
export function anotherPlayerLink(phase: SeasonPhase): { href: string; label: string } {
  return phase === 'portal'
    ? { href: '/player', label: 'Add another player' }
    : { href: '/signup', label: 'Sign up another player' };
}
