// Per-device list of accessed players (PlayerID + display name only), per docs/fall-2026/signup-plan.md section 4.
// Client-only: callers must guard with `typeof window !== 'undefined'`.

const STORAGE_KEY = 'mu_signup_players';

export interface RememberedPlayer {
  playerId: string;
  displayName: string;
}

export function getRememberedPlayers(): RememberedPlayer[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberPlayer(player: RememberedPlayer): void {
  try {
    const players = getRememberedPlayers().filter(p => p.playerId !== player.playerId);
    players.unshift(player);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  } catch {
    // localStorage unavailable; nothing to do
  }
}

export function forgetPlayer(playerId: string): void {
  try {
    const players = getRememberedPlayers().filter(p => p.playerId !== playerId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  } catch {
    // localStorage unavailable; nothing to do
  }
}
