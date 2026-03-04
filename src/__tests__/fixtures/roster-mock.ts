/**
 * Mock roster sheet data for unit tests (array-of-arrays, same shape as Google Sheets API).
 * No PII: use self-descriptive labels only (AfirstName, BlastName, YLast ZName, etc.).
 *
 * Row 0 = header. Data rows start at index 1 (ROSTER_FIRST_DATA_ROW = 2).
 * Covers: simple name, last name with space, last name with dash, and an extra row for no-match tests.
 */
export const ROSTER_MOCK_HEADER = [
  'First Name',
  'Last Name',
  'Full Name',
  'Grade',
  'Gender Identification',
  'Portal Lookup Key',
  'Portal ID',
] as const;

export const ROSTER_MOCK_DATA: readonly (readonly string[])[] = [
  // Row 1: simple name -> lookup key ablastname0512, portal p001
  ['AfirstName', 'BlastName', 'AfirstName BlastName', '7', 'M', 'ablastname0512', 'p001'],
  // Row 2: last name with space "YLast ZName" -> key has no space (xylastzname0314), portal p002
  ['XfirstName', 'YLast ZName', 'XfirstName YLast ZName', '8', 'F', 'xylastzname0314', 'p002'],
  // Row 3: last name with dash "Q-RlastName" -> key keeps dash (pq-rlastname0515), portal p003
  ['PfirstName', 'Q-RlastName', 'PfirstName Q-RlastName', '7', 'M', 'pq-rlastname0515', 'p003'],
  // Row 4: another valid row; key jklastname0610, portal p004
  ['JfirstName', 'KlastName', 'JfirstName KlastName', '9', 'F', 'jklastname0610', 'p004'],
];

/** Full roster as returned by getCachedSheetData('ROSTER'): header + data rows. */
export const ROSTER_MOCK: readonly (readonly string[])[] = [
  [...ROSTER_MOCK_HEADER],
  ...ROSTER_MOCK_DATA.map((row) => [...row]),
];
