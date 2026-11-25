/**
 * Flexible page sections. Every page is its pinned hero (title + intro, see PageView) followed by
 * an ordered list of sections that can be added, moved and deleted in the Content Studio. The
 * platform ships two section types, Text and Image (both repeat); a site adds its own designed
 * sections in site.config.ts `sections` (spec section 12 → extension points).
 *
 * Storage, per page row in site_content:
 *   sections:     string[]                       — section ids in page order
 *   section_data: { [id]: { type, ...fields } }  — each section's own content
 */

import type { PageKey } from "./pages";
import { fieldDefault, type FieldDef } from "./fields";
import { site } from "./site";
import { TEMPLATES, templateDef, templateOf, type TemplateKey } from "./templates";
export type { PageKey } from "./pages";
export { isPageKey } from "./pages";

/** A section type key: a platform section ("text", "image") or one of the site's. */
export type SectionType = string;

/** A section's field: one of the platform's field types (lib/fields.ts). */
export type SectionField = FieldDef;

export type SectionDef = {
  label: string;
  /** Repeatable sections can appear many times on a page; others once. */
  repeatable: boolean;
  fields: SectionField[];
  /** Starting values by field name; missing ones use the field type's default. */
  defaults: Record<string, unknown>;
  /** Templates whose pages may use it (default: every template that allows it). */
  templates?: string[];
};

const PLATFORM_SECTIONS: Record<SectionType, SectionDef> = {
  text: {
    label: "Text",
    repeatable: true,
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      { name: "body", label: "Text", type: "longText" },
    ],
    defaults: { heading: "A heading", body: "Write your text here." },
  },
  image: {
    label: "Image",
    repeatable: true,
    fields: [
      { name: "image_url", label: "Image", type: "image", alt: "alt" },
      { name: "alt", label: "Image description (alt text)", type: "text" },
      { name: "caption", label: "Caption", type: "text" },
      {
        name: "width",
        label: "Width",
        type: "choice",
        options: [
          { value: "contained", label: "Contained: within the text column" },
          { value: "full", label: "Full width: edge to edge" },
        ],
      },
    ],
    defaults: { image_url: "", alt: "", caption: "", width: "contained" },
  },
};

/** Every section type: the platform's, then the site's own (site.config.ts `sections`). */
export const SECTION_TYPES: Record<SectionType, SectionDef> = {
  ...PLATFORM_SECTIONS,
  ...site.sections,
};

export const SECTION_ORDER = Object.keys(SECTION_TYPES) as SectionType[];

/** A section type's definition (an unknown type, e.g. one a site no longer has, is an empty stub). */
export function sectionDef(type: SectionType): SectionDef {
  return SECTION_TYPES[type] ?? { label: type, repeatable: true, fields: [], defaults: {} };
}

/** A new section's values: each field's default, then the section's own defaults. */
export function sectionDefaults(type: SectionType): Record<string, unknown> {
  const def = sectionDef(type);
  return {
    ...Object.fromEntries(def.fields.map((f) => [f.name, fieldDefault(f)])),
    ...def.defaults,
  };
}

/** Whether a page on this template may hold this section type. */
export function allowedOn(template: TemplateKey, type: SectionType): boolean {
  const def = sectionDef(type);
  if (!def || !TEMPLATES[template]?.allowed(type)) return false;
  return !def.templates || def.templates.includes(template);
}

/** A page row's content: free-form JSON edited in the Studio (same shape the draft helpers use). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>;

/** Reads a "key:path.to.field" CMS address from site content keyed by page; "" when missing. */
export function readField(site: Doc | null | undefined, address: string): string {
  const [key, path = ""] = address.split(":");
  const v: unknown = path
    .split(".")
    .reduce<unknown>(
      (a, k) => (a != null && typeof a === "object" ? (a as Doc)[k] : undefined),
      site?.[key!],
    );
  return typeof v === "string" ? v : "";
}

/** Reads any value (text, rich text, lists, links…) at a "key:path" CMS address; undefined when missing. */
export function readValue(site: Doc | null | undefined, address: string): unknown {
  const [key, path = ""] = address.split(":");
  return path
    .split(".")
    .reduce<unknown>(
      (a, k) => (a != null && typeof a === "object" ? (a as Doc)[k] : undefined),
      site?.[key!],
    );
}

export type SectionInstance = {
  id: string;
  type: SectionType;
  /** CMS field address for each field, e.g. "home:intro.text" or "home:section_data.s1ab.text". */
  fields: Record<string, string>;
};

export function sectionOrder(_page: PageKey, doc: Doc | null | undefined): string[] {
  const s = doc?.["sections"];
  return Array.isArray(s) ? s.filter((x): x is string => typeof x === "string") : [];
}

/** Resolves one section id on a page, or null if it isn't a known section. */
export function resolveSection(
  page: PageKey,
  doc: Doc | null | undefined,
  id: string,
): SectionInstance | null {
  const own = doc?.["section_data"]?.[id];
  if (!own || !(own.type in SECTION_TYPES)) return null;
  const type = own.type as SectionType;
  const fields = Object.fromEntries(
    sectionDef(type).fields.map((f) => [f.name, `${page}:section_data.${id}.${f.name}`]),
  );
  return { id, type, fields };
}

/**
 * The page's sections in order. Sections whose type the page's template doesn't allow are
 * skipped (a guard against a page saved under another template).
 */
export function resolveSections(page: PageKey, doc: Doc | null | undefined): SectionInstance[] {
  const template = templateOf(page, doc);
  return sectionOrder(page, doc)
    .map((id) => resolveSection(page, doc, id))
    .filter((s): s is SectionInstance => s != null && allowedOn(template, s.type));
}

/**
 * Section types the + menu can offer on a page: the ones its template allows that are
 * repeatable, plus once-per-page ones not yet on it.
 */
export function availableTypes(page: PageKey, doc: Doc | null | undefined): SectionType[] {
  const template = templateOf(page, doc);
  const present = new Set(resolveSections(page, doc).map((s) => s.type));
  return SECTION_ORDER.filter(
    (t) => allowedOn(template, t) && (sectionDef(t).repeatable || !present.has(t)),
  );
}

/** True for the first section of each type the page's template requires: it can't be deleted. */
export function isRequired(page: PageKey, doc: Doc | null | undefined, id: string): boolean {
  const required = templateDef(templateOf(page, doc)).required;
  const sections = resolveSections(page, doc);
  return required.some((type) => sections.find((s) => s.type === type)?.id === id);
}

/**
 * Adds a section after `afterId` (null = straight after the hero), with its type's defaults.
 * Returns the new doc and the new section's id, or null if the type isn't allowed.
 */
export function insertSection(
  page: PageKey,
  doc: Doc,
  afterId: string | null,
  type: SectionType,
  newId: string,
): { doc: Doc; id: string } | null {
  if (!availableTypes(page, doc).includes(type)) return null;
  const order = sectionOrder(page, doc);
  const id = newId;
  const at = afterId == null ? 0 : order.indexOf(afterId) + 1 || order.length;
  const sections = [...order.slice(0, at), id, ...order.slice(at)];
  const section_data = {
    ...(doc["section_data"] ?? {}),
    [id]: { type, ...sectionDefaults(type) },
  };
  return { doc: { ...doc, sections, section_data }, id };
}

/**
 * Removes a section and its content from the page. A section the template requires is never
 * removed (the doc comes back unchanged).
 */
export function removeSection(page: PageKey, doc: Doc, id: string): Doc {
  if (isRequired(page, doc, id)) return doc;
  const sections = sectionOrder(page, doc).filter((x) => x !== id);
  const next: Doc = { ...doc, sections };
  if (doc["section_data"]?.[id]) {
    const { [id]: _gone, ...rest } = doc["section_data"];
    next["section_data"] = rest;
  }
  return next;
}

/** A short, unique id that is also valid inside a CMS field address. */
export function newSectionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
