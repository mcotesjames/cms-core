/**
 * Flexible page sections. Every page is its pinned hero (title + intro, see PageView) followed by
 * an ordered list of sections that can be added, moved and deleted in the Content Studio. The
 * platform ships two section types, Text and Image; both can repeat.
 *
 * Storage, per page row in site_content:
 *   sections:     string[]                       — section ids in page order
 *   section_data: { [id]: { type, ...fields } }  — each section's own content
 */

import type { PageKey } from "./pages";
import { TEMPLATES, templateOf } from "./templates";
export type { PageKey } from "./pages";
export { isPageKey } from "./pages";

export type SectionType = "text" | "image";

export type SectionField = {
  name: string;
  label: string;
  multi?: boolean;
  image?: boolean;
  /** A choice from fixed options, shown as a select. */
  options?: Array<{ value: string; label: string }>;
};

export type SectionDef = {
  label: string;
  /** Repeatable sections can appear many times on a page; others once. */
  repeatable: boolean;
  fields: SectionField[];
  defaults: Record<string, string>;
};

export const SECTION_TYPES: Record<SectionType, SectionDef> = {
  text: {
    label: "Text",
    repeatable: true,
    fields: [
      { name: "heading", label: "Heading" },
      { name: "body", label: "Text", multi: true },
    ],
    defaults: { heading: "A heading", body: "Write your text here." },
  },
  image: {
    label: "Image",
    repeatable: true,
    fields: [
      { name: "image_url", label: "Image", image: true },
      { name: "alt", label: "Image description (alt text)" },
      { name: "caption", label: "Caption" },
      {
        name: "width",
        label: "Width",
        options: [
          { value: "contained", label: "Contained: within the text column" },
          { value: "full", label: "Full width: edge to edge" },
        ],
      },
    ],
    defaults: { image_url: "", alt: "", caption: "", width: "contained" },
  },
};

export const SECTION_ORDER = Object.keys(SECTION_TYPES) as SectionType[];

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
    SECTION_TYPES[type].fields.map((f) => [f.name, `${page}:section_data.${id}.${f.name}`]),
  );
  return { id, type, fields };
}

/**
 * The page's sections in order. Sections whose type the page's template doesn't allow are
 * skipped (a guard against a page saved under another template).
 */
export function resolveSections(page: PageKey, doc: Doc | null | undefined): SectionInstance[] {
  const allowed = TEMPLATES[templateOf(page, doc)].allowed;
  return sectionOrder(page, doc)
    .map((id) => resolveSection(page, doc, id))
    .filter((s): s is SectionInstance => s != null && allowed(s.type));
}

/**
 * Section types the + menu can offer on a page: the ones its template allows that are
 * repeatable, plus once-per-page ones not yet on it.
 */
export function availableTypes(page: PageKey, doc: Doc | null | undefined): SectionType[] {
  const allowed = TEMPLATES[templateOf(page, doc)].allowed;
  const present = new Set(resolveSections(page, doc).map((s) => s.type));
  return SECTION_ORDER.filter(
    (t) => allowed(t) && (SECTION_TYPES[t].repeatable || !present.has(t)),
  );
}

/** True for the first section of each type the page's template requires: it can't be deleted. */
export function isRequired(page: PageKey, doc: Doc | null | undefined, id: string): boolean {
  const required = TEMPLATES[templateOf(page, doc)].required;
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
    [id]: { type, ...SECTION_TYPES[type].defaults },
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
