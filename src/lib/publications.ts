/**
 * Publication types offered in the CMS dropdown (Records → Publications), each with the plural
 * label used by the public Type filter. One list, so the dropdown and the filter never drift apart.
 * Values are stored as plain text, so adding a type needs no database change.
 */
const TYPES: Array<[type: string, plural: string]> = [
  ["Article", "Articles"],
  ["Commentary", "Commentary"],
  ["Essay", "Essays"],
  ["Interview", "Interviews"],
  ["Journal", "Journals"],
  ["Newspaper", "Newspapers"],
  ["Paper", "Papers"],
  ["Podcast", "Podcasts"],
  ["Policy", "Policy"],
  ["Policy Paper", "Policy Papers"],
  ["Roundtable", "Roundtables"],
  ["Thinktank Note", "Thinktank Notes"],
  ["Working Paper", "Working Papers"],
];

export const PUBLICATION_TYPES = TYPES.map(([type]) => type);

export const PLURAL_LABELS: Record<string, string> = Object.fromEntries(TYPES);

export function filterPublications<T extends { kind: string; year: string }>(
  rows: T[],
  type: string,
  year: string,
): T[] {
  return rows.filter(
    (row) => (type === "All" || row.kind === type) && (year === "All" || row.year === year),
  );
}

export function publicationTypes<T extends { kind: string }>(rows: T[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) if (row.kind) seen.add(row.kind);
  return [...seen];
}

export function publicationYears<T extends { year: string }>(rows: T[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) if (row.year) seen.add(row.year);
  return [...seen].sort((a, b) => b.localeCompare(a));
}
