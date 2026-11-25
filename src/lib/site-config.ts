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
import type { ComponentType } from "react";
import type { Menus } from "./menus";

/** A field the Studio's side panel edits for a section (same shape as platform sections). */
export type SiteSectionField = {
  name: string;
  label: string;
  multi?: boolean;
  image?: boolean;
  options?: Array<{ value: string; label: string }>;
};

/** What a site section's component receives. */
export type SiteSectionProps = {
  /** Each field's current value (live on the site, the draft in the Studio canvas). */
  values: Record<string, string>;
  /** Each field's CMS address, for `data-cms` / `data-cms-image` so it's editable in place. */
  cms: Record<string, string>;
};

/** A designed section only this site has. */
export type SiteSection = {
  label: string;
  /** Can appear more than once on a page. */
  repeatable: boolean;
  fields: SiteSectionField[];
  defaults: Record<string, string>;
  /** Templates whose pages may use it (default: every template). */
  templates?: string[];
  /** Renders it, on the live site and in the Studio canvas. Must hide empty fields (useShow). */
  component: ComponentType<SiteSectionProps>;
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
    const names = new Set(s.fields.map((f) => f.name));
    if (names.has("type")) fail(`section "${key}": a field can't be called "type".`);
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
