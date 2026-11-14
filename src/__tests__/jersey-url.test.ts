import { describe, it, expect } from 'vitest';
import { parseJerseyHash, jerseyHash, parseFilterQuery, filterQuery, filtersForUrl } from '@/lib/jersey-url';

describe('jersey hash', () => {
  it('round-trips a tab and an open player', () => {
    expect(parseJerseyHash('#players/p001')).toEqual({ screen: 'players', playerId: 'p001' });
    expect(jerseyHash({ screen: 'players', playerId: 'p001' })).toBe('#players/p001');
    expect(jerseyHash({ screen: 'checkin', playerId: '' })).toBe('#checkin');
  });

  it('defaults to Check-in for a blank or unknown hash', () => {
    expect(parseJerseyHash('')).toEqual({ screen: 'checkin', playerId: '' });
    expect(parseJerseyHash('#nope')).toEqual({ screen: 'checkin', playerId: '' });
    expect(parseJerseyHash('#stock/p001')).toEqual({ screen: 'stock', playerId: 'p001' });
  });
});

describe('filter query', () => {
  it('round-trips repeated teams, genders, statuses, and the search', () => {
    const filters = { search: 'test', teams: ['Blue', 'Gold'], genders: ['Gx'], statuses: ['outstanding'] };
    const query = filterQuery(filters);
    expect(query).toBe('?team=Blue&team=Gold&gender=Gx&status=outstanding&q=test');
    expect(parseFilterQuery(query)).toEqual(filters);
  });

  it('is empty with no filters, and parses to null when the URL names none', () => {
    expect(filterQuery({ search: ' ', teams: [], genders: [], statuses: [] })).toBe('');
    expect(parseFilterQuery('')).toBeNull();
    expect(parseFilterQuery('?other=1')).toBeNull();
  });
});

describe('damaged and restored URLs', () => {
  it('treats a malformed player escape as no player instead of throwing', () => {
    expect(parseJerseyHash('#players/%')).toEqual({ screen: 'players', playerId: '' });
    expect(parseJerseyHash('#players/%E0%A4%A')).toEqual({ screen: 'players', playerId: '' });
  });

  it('uses saved filters only on first load; a restored entry with no filters means none', () => {
    const saved = { search: '', teams: ['Blue'], genders: [], statuses: [] };
    expect(filtersForUrl('', { initial: true, saved }).teams).toEqual(['Blue']);
    expect(filtersForUrl('', { initial: false, saved }).teams).toEqual([]);
    expect(filtersForUrl('?team=Gold', { initial: true, saved }).teams).toEqual(['Gold']);
  });
});
