/**
 * Flexible page sections. Every page is its pinned hero followed by an ordered list of
 * sections that can be added, moved and deleted in the Content Studio. Any section type can
 * go on any page. Text sections can repeat; sections fed by a shared list (pillars, cards,
 * hotspots, insights, investments, publications) appear at most once per page.
 *
 * Storage, per page row in site_content:
 *   sections:     string[]                       — section ids in page order
 *   section_data: { [id]: { type, ...fields } }  — own text for sections added in the Studio
 * Sections that existed before this model ("legacy" ids such as home "intro") keep reading
 * their original fields, so no content had to be migrated. A page with no `sections` yet
 * uses its default order, which reproduces the layout it had before.
 */

import type { PageKey } from "./pages";
import { TEMPLATES, templateOf } from "./templates";
export type { PageKey } from "./pages";
export { isPageKey } from "./pages";

export type SectionType =
  | "statement"
  | "pillars"
  | "cards"
  | "bio"
  | "insights_list"
  | "investments_grid"
  | "publications_selected"
  | "publications_index"
  | "footnote"
  | "interactive";

export type SectionField = {
  name: string;
  label: string;
  multi?: boolean;
  image?: boolean;
  /** An uploaded file (not an image); the panel shows upload / restore / preview controls. */
  file?: { accept: string };
  /** A choice from fixed options, shown as a select. */
  options?: Array<{ value: string; label: string }>;
  siteWide?: boolean;
};

export type SectionDef = {
  label: string;
  /** Text sections can appear many times; list-fed sections once per page. */
  repeatable: boolean;
  fields: SectionField[];
  defaults: Record<string, string>;
  /** Shared list whose items this section shows (edited in the side panel or in Records). */
  list?: "pillars" | "cards" | "hotspots";
  /** Where the section's items come from, when they are edited elsewhere. */
  source?: string;
};

export const SECTION_TYPES: Record<SectionType, SectionDef> = {
  statement: {
    label: "Statement",
    repeatable: true,
    fields: [{ name: "text", label: "Text", multi: true }],
    defaults: { text: "Write your statement here." },
  },
  pillars: { label: "Pillars", repeatable: false, fields: [], defaults: {}, list: "pillars" },
  cards: {
    label: "Stacking cards",
    repeatable: false,
    list: "cards",
    fields: [
      { name: "eyebrow", label: "Heading" },
      { name: "intro", label: "Intro", multi: true },
    ],
    defaults: { eyebrow: "Heading", intro: "Introduce the cards here." },
  },
  bio: {
    label: "Biography",
    repeatable: false,
    list: "hotspots",
    fields: [
      { name: "name", label: "Name" },
      { name: "description", label: "Description", multi: true },
      { name: "portrait_url", label: "Portrait", image: true },
      { name: "portrait_alt", label: "Portrait description (alt text)" },
    ],
    defaults: {
      name: "Name",
      description: "A short biography.",
      portrait_url: "",
      portrait_alt: "",
    },
  },
  insights_list: {
    label: "Insights feed",
    repeatable: false,
    source: "Insights",
    fields: [{ name: "label", label: "List label" }],
    defaults: { label: "More insights" },
  },
  investments_grid: {
    label: "Investments grid",
    repeatable: false,
    source: "Records → Investments",
    fields: [{ name: "disclaimer", label: "Disclaimer (site-wide)", multi: true, siteWide: true }],
    defaults: {},
  },
  publications_selected: {
    label: "Selected publications",
    repeatable: false,
    source: "Records → Publications (pinned pieces)",
    fields: [{ name: "label", label: "Label" }],
    defaults: { label: "Selected work" },
  },
  publications_index: {
    label: "Publications index",
    repeatable: false,
    source: "Records → Publications",
    fields: [],
    defaults: {},
  },
  footnote: {
    label: "Small print",
    repeatable: true,
    fields: [{ name: "text", label: "Text", multi: true }],
    defaults: { text: "Small print." },
  },
  interactive: {
    label: "Interactive",
    repeatable: false,
    // `file_name`, `previous_url` and `previous_name` also live in section_data; the file
    // control manages them, so they aren't panel fields.
    fields: [
      { name: "html_url", label: "HTML file", file: { accept: ".html,.htm,text/html" } },
      { name: "title", label: "Title (for screen readers)" },
      {
        name: "height",
        label: "Height",
        options: [
          { value: "content", label: "Fit content: scrolls with the page" },
          {
            value: "screen",
            label: "Full screen: scrolls inside (for pop-ups that cover the screen)",
          },
        ],
      },
    ],
    defaults: {
      html_url: "",
      file_name: "",
      previous_url: "",
      previous_name: "",
      title: "Interactive",
      height: "content",
    },
  },
};

export const SECTION_ORDER = Object.keys(SECTION_TYPES) as SectionType[];

type Legacy = { type: SectionType; fields: Record<string, string> };

/** Sections that existed before flexible pages, with the fields they already read. */
const LEGACY: Partial<Record<PageKey, Record<string, Legacy>>> = {
  home: {
    intro: { type: "statement", fields: { text: "home:intro.text" } },
    pillars: { type: "pillars", fields: {} },
    what: { type: "cards", fields: { eyebrow: "home:what.eyebrow", intro: "home:what.intro" } },
    bio: {
      type: "bio",
      fields: {
        name: "home:bio.name",
        description: "home:bio.description",
        portrait_url: "home:bio.portrait_url",
        portrait_alt: "home:bio.portrait_alt",
      },
    },
  },
  insights: { list: { type: "insights_list", fields: { label: "insights:list_label" } } },
  investments: { grid: { type: "investments_grid", fields: {} } },
  publications: {
    selected: { type: "publications_selected", fields: { label: "publications:selected_label" } },
    index: { type: "publications_index", fields: {} },
    footnote: { type: "footnote", fields: { text: "publications:footnote" } },
  },
};

/** The order each page had before flexible sections. */
export const DEFAULT_ORDER: Partial<Record<PageKey, string[]>> = {
  home: ["intro", "pillars", "what", "bio"],
  insights: ["list"],
  investments: ["grid"],
  publications: ["selected", "index", "footnote"],
};

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

export function sectionOrder(page: PageKey, doc: Doc | null | undefined): string[] {
  const s = doc?.["sections"];
  return Array.isArray(s)
    ? s.filter((x): x is string => typeof x === "string")
    : (DEFAULT_ORDER[page] ?? []);
}

/** Resolves one section id on a page, or null if it isn't a known section. */
export function resolveSection(
  page: PageKey,
  doc: Doc | null | undefined,
  id: string,
): SectionInstance | null {
  const own = doc?.["section_data"]?.[id];
  if (own && own.type in SECTION_TYPES) {
    const type = own.type as SectionType;
    const fields = Object.fromEntries(
      SECTION_TYPES[type].fields.map((f) => [
        f.name,
        f.siteWide ? siteWideField(f.name) : `${page}:section_data.${id}.${f.name}`,
      ]),
    );
    return { id, type, fields };
  }
  const legacy = LEGACY[page]?.[id];
  if (!legacy) return null;
  const extra = Object.fromEntries(
    SECTION_TYPES[legacy.type].fields
      .filter((f) => f.siteWide)
      .map((f) => [f.name, siteWideField(f.name)]),
  );
  return { id, type: legacy.type, fields: { ...extra, ...legacy.fields } };
}

function siteWideField(name: string): string {
  if (name === "disclaimer") return "settings:investments_disclaimer";
  return `settings:${name}`;
}

/**
 * The page's sections in order. Sections whose type the page's template doesn't allow are
 * skipped: a template switch clears sections anyway, so this is only a guard against a
 * mismatched page (e.g. an interactive on a Standard page).
 */
export function resolveSections(page: PageKey, doc: Doc | null | undefined): SectionInstance[] {
  const allowed = TEMPLATES[templateOf(page, doc)].allowed;
  return sectionOrder(page, doc)
    .map((id) => resolveSection(page, doc, id))
    .filter((s): s is SectionInstance => s != null && allowed(s.type));
}

/**
 * Section types the + menu can offer on a page: the ones its template allows that are
 * repeatable, plus list-fed ones not yet on it.
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
 * Adds a section after `afterId` (null = straight after the hero). Re-adding a type the page
 * used to have brings back its original section and content rather than starting empty.
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
  const restored = Object.entries(LEGACY[page] ?? {}).find(
    ([id, l]) => l.type === type && !order.includes(id),
  )?.[0];
  const id = restored ?? newId;
  const at = afterId == null ? 0 : order.indexOf(afterId) + 1 || order.length;
  const sections = [...order.slice(0, at), id, ...order.slice(at)];
  if (restored) return { doc: { ...doc, sections }, id };
  const section_data = {
    ...(doc["section_data"] ?? {}),
    [id]: { type, ...SECTION_TYPES[type].defaults },
  };
  return { doc: { ...doc, sections, section_data }, id };
}

/**
 * Removes a section from the page. Original sections keep their content so they can be re-added.
 * A section the template requires is never removed (the doc comes back unchanged).
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
