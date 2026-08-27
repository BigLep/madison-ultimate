// Deadline/lifecycle state for the signup banners (spec C6-C8), per
// docs/fall-2026/signup-plan.md section 9. Dates are Pacific-naive (school-year local dates).

export type DeadlineState = 'open' | 'late' | 'closed';

const DEADLINE_DATE = '2026-09-09'; // EOD Wednesday, September 9
const CLOSE_DATE = '2026-09-18'; // ~a week after tryouts; new-player creation closes

export function getDeadlineState(now: Date = new Date()): DeadlineState {
  const today = now.toISOString().slice(0, 10);
  if (today <= DEADLINE_DATE) return 'open';
  if (today <= CLOSE_DATE) return 'late';
  return 'closed';
}

export const DEADLINE_COPY: Record<DeadlineState, string> = {
  open:
    'Complete signup and Final Forms by end of day Wednesday, September 9, and sooner is better: the school needs time to process clearance. SPS rules: players who aren’t fully cleared in Final Forms can’t set foot on the field at tryouts (Sept 10-11).',
  late:
    'Tryout registration has closed. Late signups are not guaranteed. Go ahead and submit and contact the coaches at madisonultimate@gmail.com.',
  closed:
    'Signups for the fall season are closed. Contact the coaches at madisonultimate@gmail.com.',
};

/** New-player creation (step 0's create path) is closed once the deadline state reaches 'closed'; lookup for existing players always keeps working. */
export function isNewSignupClosed(state: DeadlineState): boolean {
  return state === 'closed';
}
