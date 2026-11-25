/**
 * Several choices stored in one text field, e.g. "Seed / Series A". Used for CMS tick-box fields
 * so they need no database change, and a field holding a single old value still reads correctly.
 */
export const MULTI_SEPARATOR = " / ";

export function parseMulti(value: string | null | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Joins choices in the options' order (unlisted values kept at the end), without duplicates. */
export function formatMulti(selected: string[], options: readonly string[]): string {
  const set = new Set(selected);
  const listed = options.filter((o) => set.has(o));
  const others = selected.filter((s, i) => !options.includes(s) && selected.indexOf(s) === i);
  return [...listed, ...others].join(MULTI_SEPARATOR);
}
