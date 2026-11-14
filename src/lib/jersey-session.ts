// Which Jersey Manager is using this device (CONTEXT.md: Jersey Manager). The name is typed once
// at /jerseys/login and stamped on every check-out, check-in, and note. The shared password lives
// in the gate cookie (ADR 0008). Client-only.

const STORAGE_KEY = 'mu_jersey_manager_name';

export function getJerseyManagerName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function rememberJerseyManagerName(name: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, name.trim());
  } catch {
    // localStorage unavailable: the page asks for the name again next time.
  }
}
