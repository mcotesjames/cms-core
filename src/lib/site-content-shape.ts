/** Empty fields preserve CMS ownership while allowing missing page rows to render safely. */
const EMPTY_ROWS = {
  home: { intro: { title: "", summary: "" } },
  settings: { contact_email: "", footer_heading: "", footer_tagline: "" },
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fillMissing(defaults: Record<string, unknown>, value: unknown): Record<string, unknown> {
  const saved = object(value);
  const result = { ...defaults, ...saved };
  for (const [key, fallback] of Object.entries(defaults)) {
    result[key] =
      typeof fallback === "object"
        ? fillMissing(object(fallback), saved[key])
        : typeof saved[key] === "string"
          ? saved[key]
          : fallback;
  }
  return result;
}

export function normalizeSiteContent(site: Record<string, unknown>): Record<string, unknown> {
  const result = { ...site };
  for (const [key, fields] of Object.entries(EMPTY_ROWS))
    result[key] = fillMissing(fields, site[key]);
  return result;
}
