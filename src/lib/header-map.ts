// Header-name column lookup for sheet rows (AGENTS.md: never hardcode column positions). Pure, so
// both sheet readers and pure parsers can share it.

/** Header name to 0-based column index; blank headers skipped, first occurrence wins. */
export function headerMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const name = (h ?? '').toString().trim();
    if (name && map[name] === undefined) map[name] = i;
  });
  return map;
}

/** Reads a row's trimmed cell by header name, '' when the column or cell is missing. */
export function cellGetter(map: Record<string, number>) {
  return (row: unknown[], name: string): string => {
    const index = map[name];
    return index === undefined ? '' : (row[index] ?? '').toString().trim();
  };
}
