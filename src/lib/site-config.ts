/**
 * The site configuration contract (spec section 9): everything that varies per site is declared
 * in `src/site/site.config.ts` with `defineSite()`, and the platform reads it only through
 * `src/lib/site.ts`. This file is platform code: it defines the shape and checks it at build time,
 * so a site that declares something the platform can't use fails its build with a clear message.
 *
 * Extension points (spec section 12): `sections` (designed sections for this site's pages),
 * `templates` (page templates beside Standard), routes (files in `src/site/routes/`, mounted
 * beside the platform's by vite.config.ts), theme (`src/site/theme.css`). Record types arrive with
 * the records feature (Phase 6).
 */
import type { Menus } from "./menus";
import { checkFieldDefs, type FieldDef } from "./fields";

/** Settings keys the platform uses in the settings row (lib/global-settings.ts); a site can't declare these. */
export const RESERVED_SETTINGS_KEYS = [
  "general",
  "footer",
  "contact_email",
  "footer_heading",
  "footer_tagline",
  "brand",
  "banner",
  "seo",
  "forms",
] as const;

/** A field a section declares: one of the platform's field types (lib/fields.ts). */
export type SiteSectionField = FieldDef;

/** What a site section's component receives. */
export type SiteSectionProps = {
  /**
   * Each field's current value (live on the site, the draft in the Studio canvas), shaped by its
   * field type: text is a string, rich text a RichDoc (render it with <RichText>), a link a
   * LinkTarget (resolve it with <FieldLink>), and so on (lib/fields.ts).
   */
  values: Record<string, unknown>;
  /** Each field's CMS address, for `data-cms` / `data-cms-image` so it's editable in place. */
  cms: Record<string, string>;
};

/**
 * A designed section only this site has. Its React component is registered in
 * src/site/sections/index.ts under the same key (kept out of this config so the config stays
 * plain data that platform modules can read while components import platform helpers).
 */
export type SiteSection = {
  label: string;
  /** Can appear more than once on a page. */
  repeatable: boolean;
  fields: SiteSectionField[];
  /** Starting values for a new section, by field name (missing = the field type's default). */
  defaults: Record<string, unknown>;
  /** Templates whose pages may use it (default: every template). */
  templates?: string[];
};

/** A record type a site declares (lib/records.ts). */
export type SiteRecordType = {
  /** Singular and plural names: "Team member" / "Team". */
  label: string;
  plural: string;
  fields: FieldDef[];
  /** The text field that names a record in lists, pickers and references. */
  titleField: string;
  /** "manual" (the client sets the order) or by one of its fields. */
  ordering: "manual" | { field: string; direction?: "asc" | "desc" };
};

/** A page template only this site has (spec section 6 → Page templates). */
export type SiteTemplate = {
  label: string;
  description: string;
  /** Whether the page hero shows. */
  hero: boolean;
  /** Section types a page on this template starts with and can't delete (can move). */
  required: string[];
  /** Section types the + menu offers on this template. */
  sections: string[];
};

export type SiteConfig = {
  /** The site's name: titles, structured data, the Studio. */
  name: string;
  /** Its public address, https, no trailing slash: canonical links and the sitemap. */
  url: string;
  brand?: {
    /** Text wordmark in the header and Studio until the site has a logo file. Default: name. */
    wordmark?: string;
  };
  media?: {
    /** Longest side of uploaded images after the browser resizes them. Default 2400. */
    maxDimension?: number;
    /** JPEG / WebP quality, 0–1. Default 0.82. */
    quality?: number;
  };
  menus?: {
    /** Menus used until the Studio edits them (contact email comes from Settings). */
    defaults?: (settings: { contact_email?: string } | null | undefined) => Menus;
    /** Footer menu column limit. Default 3. */
    footerColumns?: number;
    /** Main-menu links before the editor warns it may not fit on small screens. Default 5. */
    mainMax?: number;
  };
  sections?: Record<string, SiteSection>;
  templates?: Record<string, SiteTemplate>;
  /**
   * The site's own Global settings groups (contact details, social links…): each is a tab on
   * Settings → Global settings, stored as settings.<key>.<field>. Read them with `siteSettings()`.
   */
  settings?: Record<string, { label: string; note?: string; fields: FieldDef[] }>;
  /**
   * Record types (spec: Core scope → Records): reusable structured data without its own page
   * (team members, services, logos…). Each has a list in the Studio's Records group.
   */
  recordTypes?: Record<string, SiteRecordType>;
  /** IANA time zone for scheduled things such as the announcement (default "Europe/London"). */
  timeZone?: string;
  /**
   * Top-level addresses of the site's own routes (files in src/site/routes), e.g. ["styleguide"].
   * Pages created in the Studio can't use them. A test checks every route file is listed.
   */
  routes?: string[];
};

/** Section types and template keys the platform defines; a site can't redefine them. */
export const PLATFORM_SECTION_TYPES = ["text", "image"] as const;
export const PLATFORM_TEMPLATES = ["standard"] as const;

/** Checks a site's config; throws a message naming the problem (so the build fails). */
export function validateSite(config: SiteConfig): SiteConfig {
  const fail = (msg: string): never => {
    throw new Error(`site.config.ts: ${msg}`);
  };
  if (!config.name?.trim()) fail("`name` is required.");
  if (!/^https:\/\/[^/\s]+$/.test(config.url ?? ""))
    fail("`url` must be the site's https address with no path or trailing slash.");
  const keyOk = /^[a-z][a-z0-9_]*$/;
  const sections = config.sections ?? {};
  const templates = config.templates ?? {};
  const sectionTypes = new Set<string>([...PLATFORM_SECTION_TYPES, ...Object.keys(sections)]);
  const templateKeys = new Set<string>([...PLATFORM_TEMPLATES, ...Object.keys(templates)]);
  for (const [key, s] of Object.entries(sections)) {
    if (!keyOk.test(key)) fail(`section "${key}": keys are lowercase letters, digits and _.`);
    if ((PLATFORM_SECTION_TYPES as readonly string[]).includes(key))
      fail(`section "${key}" is a platform section; pick another key.`);
    const problems = checkFieldDefs(s.fields, `section "${key}"`);
    if (problems[0]) fail(problems[0]);
    const names = new Set(s.fields.map((f) => f.name));
    for (const d of Object.keys(s.defaults))
      if (!names.has(d)) fail(`section "${key}": default "${d}" isn't one of its fields.`);
    for (const t of s.templates ?? [])
      if (!templateKeys.has(t)) fail(`section "${key}": unknown template "${t}".`);
  }
  for (const [key, t] of Object.entries(templates)) {
    if (!keyOk.test(key)) fail(`template "${key}": keys are lowercase letters, digits and _.`);
    if ((PLATFORM_TEMPLATES as readonly string[]).includes(key))
      fail(`template "${key}" is a platform template; pick another key.`);
    for (const s of [...t.required, ...t.sections])
      if (!sectionTypes.has(s)) fail(`template "${key}": unknown section type "${s}".`);
    for (const s of t.required)
      if (!t.sections.includes(s))
        fail(`template "${key}": required "${s}" must also be in sections.`);
    if (!t.sections.some((s) => sectionTypes.has(s))) fail(`template "${key}" offers no sections.`);
  }
  for (const [key, g] of Object.entries(config.settings ?? {})) {
    if (!keyOk.test(key))
      fail(`settings group "${key}": keys are lowercase letters, digits and _.`);
    if ((RESERVED_SETTINGS_KEYS as readonly string[]).includes(key))
      fail(`settings group "${key}" is used by the platform; pick another key.`);
    const problems = checkFieldDefs(g.fields, `settings group "${key}"`);
    if (problems[0]) fail(problems[0]);
  }
  for (const [key, t] of Object.entries(config.recordTypes ?? {})) {
    if (!keyOk.test(key)) fail(`record type "${key}": keys are lowercase letters, digits and _.`);
    const problems = checkFieldDefs(t.fields, `record type "${key}"`);
    if (problems[0]) fail(problems[0]);
    const title = t.fields.find((f) => f.name === t.titleField);
    if (!title || title.type !== "text")
      fail(`record type "${key}": titleField "${t.titleField}" must be one of its text fields.`);
    const order = t.ordering;
    if (order !== "manual" && !t.fields.some((f) => f.name === order.field))
      fail(`record type "${key}": ordering field "${order.field}" isn't one of its fields.`);
  }
  for (const s of Object.values(sections))
    for (const f of s.fields)
      if (f.type === "reference" && !(f.to in (config.recordTypes ?? {})))
        fail(`field "${f.name}": reference to unknown record type "${f.to}".`);
  if (config.timeZone) {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: config.timeZone });
    } catch {
      fail(`timeZone "${config.timeZone}" isn't a known time zone (e.g. "Europe/London").`);
    }
  }
  for (const r of config.routes ?? [])
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r)) fail(`route "${r}": use the address without slashes.`);
  const q = config.media?.quality;
  if (q !== undefined && !(q > 0 && q <= 1)) fail("`media.quality` must be between 0 and 1.");
  return config;
}

/** Declares the site's configuration (checked when the code loads, so at build time too). */
export function defineSite(config: SiteConfig): SiteConfig {
  return validateSite(config);
}
