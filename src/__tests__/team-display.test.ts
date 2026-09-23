import { describe, it, expect } from 'vitest';
import { formatTeam, formatTeamOrTbd, compareTeams, isTeamAssigned, isGameRowVisibleToPlayer } from '@/lib/team-display';

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

describe('formatTeamOrTbd', () => {
  it('shows an explicit TBD label instead of hiding an unassigned team', () => {
    expect(formatTeamOrTbd('')).toBe('🕒 TBD');
    expect(formatTeamOrTbd('TBD')).toBe('🕒 TBD');
    expect(formatTeamOrTbd(undefined)).toBe('🕒 TBD');
  });

  it('matches formatTeam for an assigned team', () => {
    expect(formatTeamOrTbd('Blue')).toBe('🟦 Blue');
  });
});

describe('compareTeams', () => {
  it('sorts the four Fall 2026 squads Blue, Gold, Silver, then Practice Squad', () => {
    const teams = ['Practice Squad', 'Silver', 'Blue', 'Gold'];
    expect([...teams].sort(compareTeams)).toEqual(['Blue', 'Gold', 'Silver', 'Practice Squad']);
  });

  it('sorts unrecognized teams, including TBD, after all known squads', () => {
    const teams = ['TBD', 'Gold', 'Varsity', 'Blue'];
    expect([...teams].sort(compareTeams)).toEqual(['Blue', 'Gold', 'TBD', 'Varsity']);
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
