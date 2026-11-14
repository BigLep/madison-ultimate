// Bookmarkable /jerseys URLs, like the Player Portal's: the tab and any open player live in the
// hash (#checkin, #players, #stock, or e.g. #players/<playerId>), so each change is a history entry the
// back button undoes; filters and search live in the query string (?team=Blue&gender=Gx&
// status=outstanding&q=sm), so a filtered view can be bookmarked or shared. Pure, so it is tested
// without a browser.

export type JerseyScreen = 'checkin' | 'players' | 'stock';

const SCREENS: JerseyScreen[] = ['checkin', 'players', 'stock'];

export interface JerseyLocation {
  screen: JerseyScreen;
  /** The player whose panel is open, if any. */
  playerId: string;
}

export interface JerseyFilterParams {
  search: string;
  teams: string[];
  genders: string[];
  statuses: string[];
}

export function parseJerseyHash(hash: string): JerseyLocation {
  const [screenPart, playerPart] = hash.replace(/^#/, '').split('/');
  const screen = SCREENS.includes(screenPart as JerseyScreen) ? (screenPart as JerseyScreen) : 'checkin';
  return { screen, playerId: decodeURIComponent(playerPart || '') };
}

export function jerseyHash({ screen, playerId }: JerseyLocation): string {
  return playerId ? `#${screen}/${encodeURIComponent(playerId)}` : `#${screen}`;
}

const PARAMS = { teams: 'team', genders: 'gender', statuses: 'status', search: 'q' } as const;

/** Filters named in a query string, or null when it names none (so saved defaults can apply). */
export function parseFilterQuery(search: string): JerseyFilterParams | null {
  const params = new URLSearchParams(search);
  const named = Object.values(PARAMS).some(name => params.has(name));
  if (!named) return null;
  return {
    search: params.get(PARAMS.search) || '',
    teams: params.getAll(PARAMS.teams),
    genders: params.getAll(PARAMS.genders),
    statuses: params.getAll(PARAMS.statuses),
  };
}

/** "?team=Blue&status=outstanding", or "" when nothing is filtered. */
export function filterQuery(filters: JerseyFilterParams): string {
  const params = new URLSearchParams();
  for (const t of filters.teams) params.append(PARAMS.teams, t);
  for (const g of filters.genders) params.append(PARAMS.genders, g);
  for (const s of filters.statuses) params.append(PARAMS.statuses, s);
  if (filters.search.trim()) params.set(PARAMS.search, filters.search.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
}
