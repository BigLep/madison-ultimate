// Which Coach this device is logged in as (CONTEXT.md: Coach Login, Coach Logout). Only the
// CoachID is kept; the shared Coach Tools password lives in the gate cookie (ADR 0008).
// Client-only: callers must guard with `typeof window !== 'undefined'`.

const STORAGE_KEY = 'mu_coach_id';

export function getRememberedCoachId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function rememberCoach(coachId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, coachId);
  } catch {
    // localStorage unavailable; nothing to do
  }
}

export function forgetCoach(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable; nothing to do
  }
}
