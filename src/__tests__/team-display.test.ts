import { describe, it, expect } from 'vitest';
import { formatTeam, isTeamAssigned, isGameRowVisibleToPlayer } from '@/lib/team-display';

describe('team display (player-portal-grill.md Q24)', () => {
  it('hides Team while unassigned', () => {
    expect(isTeamAssigned('')).toBe(false);
    expect(isTeamAssigned('TBD')).toBe(false);
    expect(isTeamAssigned(' tbd ')).toBe(false);
    expect(formatTeam('TBD')).toBe('');
    expect(formatTeam(undefined)).toBe('');
  });

  it('maps the four Fall 2026 squads to their emoji labels, case-insensitively', () => {
    expect(formatTeam('Blue')).toBe('🟦 Blue');
    expect(formatTeam('gold')).toBe('🟨 Gold');
    expect(formatTeam('Silver')).toBe('🪙 Silver');
    expect(formatTeam('Practice Squad')).toBe('🏋️ Practice Squad');
  });

  it('shows an unknown team value as typed', () => {
    expect(formatTeam('Varsity')).toBe('Varsity');
  });
});

describe('isGameRowVisibleToPlayer (player-portal-grill.md Q25)', () => {
  it('shows a blank-Team row to everyone, including unassigned and practice squad players', () => {
    expect(isGameRowVisibleToPlayer('', 'Blue')).toBe(true);
    expect(isGameRowVisibleToPlayer('', 'TBD')).toBe(true);
    expect(isGameRowVisibleToPlayer(undefined, 'Practice Squad')).toBe(true);
  });

  it('shows a team row only to that team', () => {
    expect(isGameRowVisibleToPlayer('Blue', 'blue')).toBe(true);
    expect(isGameRowVisibleToPlayer('Blue', 'Gold')).toBe(false);
  });

  it('never shows a team row to an unassigned or practice squad player', () => {
    expect(isGameRowVisibleToPlayer('Blue', 'TBD')).toBe(false);
    expect(isGameRowVisibleToPlayer('Blue', '')).toBe(false);
    expect(isGameRowVisibleToPlayer('Practice Squad', 'Practice Squad')).toBe(false);
  });
});
