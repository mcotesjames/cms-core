/**
 * Page templates: rule sets on top of the one section system, not separate renderers. A template
 * decides which section types a created page can hold, which it starts with and which can't be
 * deleted, and whether the page hero shows. Every page keeps the same nav, footer, draft/publish,
 * comments, SEO, menus and canvas.
 *
 * Stored as `template` in a created page's site_content row; a missing value is Standard.
 * Built-in pages are always Standard. The platform ships Standard; a site adds its own in
 * site.config.ts `templates` (spec section 6).
 *
 * Switching template is a draft edit that replaces the page's sections with the new template's
 * starting sections and keeps everything else (hero, SEO, …). Discard undoes it until Publish.
 */
import { SECTION_TYPES, type Doc, type SectionType } from "./page-sections";
import { isFixedPage, type PageKey } from "./pages";
import { site } from "./site";
import { sectionDef } from "./page-sections";

/** A template key: "standard" or one of the site's own. */
export type TemplateKey = string;

export type TemplateDef = {
  label: string;
  /** Shown in the template picker. */
  description: string;
  /**
   * Whether the page hero (title + summary) shows. When it doesn't, its text is kept in the page
   * row, so switching back to a template with a hero brings it back.
   */
  hero: boolean;
  /** Added when the page starts on this template; the first of each type can't be deleted (can be moved). */
  required: SectionType[];
  /** Section types the page can hold and the + menu can offer. */
  allowed: (t: SectionType) => boolean;
};

/** Standard first, then the site's own templates. */
export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  standard: {
    label: "Standard",
    description: "A hero, then any sections.",
    hero: true,
    required: [],
    allowed: () => true,
  },
  ...Object.fromEntries(
    Object.entries(site.templates ?? {}).map(([key, t]) => [
      key,
      {
        label: t.label,
        description: t.description,
        hero: t.hero,
        required: t.required,
        allowed: (type: SectionType) => t.sections.includes(type),
      } satisfies TemplateDef,
    ]),
  ),
};

export const TEMPLATE_ORDER = Object.keys(TEMPLATES) as TemplateKey[];

/** A template's definition; an unknown key (e.g. a template a site no longer has) is Standard. */
export function templateDef(key: TemplateKey): TemplateDef {
  return TEMPLATES[key] ?? TEMPLATES["standard"]!;
}

export const isTemplateKey = (v: unknown): v is TemplateKey =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(TEMPLATES, v);

/** The template a page uses (built-in pages and pages with none saved are Standard). */
export function templateOf(page: PageKey, doc: Doc | null | undefined): TemplateKey {
  if (isFixedPage(page)) return "standard";
  const t: unknown = doc?.["template"];
  return isTemplateKey(t) ? t : "standard";
}

/** The template's starting sections: each required type with its defaults. */
export function startingSections(
  to: TemplateKey,
  newId: () => string,
): { sections: string[]; section_data: Record<string, Record<string, string>> } {
  const sections: string[] = [];
  const section_data: Record<string, Record<string, string>> = {};
  for (const type of templateDef(to).required) {
    const id = newId();
    sections.push(id);
    section_data[id] = { type, ...sectionDef(type).defaults };
  }
  return { sections, section_data };
}

/**
 * Switches a page doc to another template: sets `template`, replaces `sections` and `section_data`
 * with the template's starting sections, and keeps everything else (`intro`, `seo`, …).
 */
export function switchTemplate(doc: Doc, to: TemplateKey, newId: () => string): Doc {
  return { ...doc, template: to, ...startingSections(to, newId) };
}
