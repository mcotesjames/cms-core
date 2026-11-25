/**
 * Field types (spec section 14 → Made → Core scope → Field types): the one vocabulary every
 * section, setting, record type, content type and form is declared with. A site declares fields in
 * site.config.ts; the platform gives each type its editing control (components/admin/fields),
 * its validation (on screen and on the server, from `fieldSchema`) and the "empty = hidden" rule.
 *
 * Values are plain JSON so they store as-is in D1:
 *   text, longText, date, image (its URL), file (its URL)  → string
 *   number → number · boolean → boolean
 *   choice → string, or string[] when `multiple` (options are set in code)
 *   link → LinkTarget (the menus' link shape) · reference → string[] of ids
 *   richText → RichDoc (structured, never raw HTML) · group → GroupItem[]
 */
import { z } from "zod";
import type { LinkTarget } from "./menus";

type Common = {
  /** Key in the stored content: lowercase letters, digits and _. */
  name: string;
  label: string;
  /** One line of help shown under the field. */
  help?: string;
  /** Required fields must be filled before saving a form; sections publish regardless. */
  required?: boolean;
};

export type ChoiceOption = { value: string; label: string };

export type FieldDef =
  | (Common & { type: "text"; maxLength?: number; default?: string })
  | (Common & { type: "longText"; default?: string })
  | (Common & { type: "richText" })
  | (Common & {
      type: "image";
      /**
       * The sibling text field holding this image's description (alt text). Edited under the
       * image; required whenever an image is set, unless the image is `decorative`.
       */
      alt?: string;
      decorative?: boolean;
    })
  | (Common & { type: "file"; accept?: string })
  | (Common & { type: "link" })
  | (Common & {
      type: "choice";
      /** The options, set in code. */
      options: ChoiceOption[];
      multiple?: boolean;
      default?: string;
    })
  | (Common & { type: "date"; time?: boolean })
  | (Common & { type: "number"; min?: number; max?: number; default?: number })
  | (Common & { type: "boolean"; default?: boolean })
  | (Common & { type: "reference"; to: string; multiple?: boolean })
  | (Common & {
      type: "group";
      /** The fields of each item (no nested groups). */
      fields: FieldDef[];
      min?: number;
      max?: number;
      /** Which item field names an item in lists ("Item 1" otherwise). */
      itemLabel?: string;
    });

export type FieldType = FieldDef["type"];

// ---- Rich text: a small fixed set of nodes and marks (the toolbar's), stored as JSON ----

export type RichMark = { type: "bold" | "italic" } | { type: "link"; attrs: { href: string } };
export type RichNode =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "hardBreak" }
  | { type: "paragraph"; content?: RichNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RichNode[] }
  | { type: "bulletList" | "orderedList"; content?: RichNode[] }
  | { type: "listItem"; content?: RichNode[] };
export type RichDoc = { type: "doc"; content?: RichNode[] };

/** Plain text of a rich text document (search, previews, emptiness). */
export function richTextPlain(doc: unknown): string {
  const walk = (n: unknown): string => {
    if (!n || typeof n !== "object") return "";
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text") return node.text ?? "";
    const inline = node.type === "paragraph" || node.type === "heading";
    return (node.content ?? []).map(walk).join(inline ? "" : "\n");
  };
  return walk(doc).trim();
}

/** A paragraph-per-block rich text document from plain text (blank lines separate paragraphs). */
export function richTextFromPlain(text: string): RichDoc {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paras.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

/** Only safe link addresses survive in rich text: web, mail, phone, site-relative and anchors. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const h = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(h) || /^\/(?!\/)/.test(h) || h.startsWith("#")) return h;
  return null;
}

// ---- Groups ----

export type GroupItem = { id: string } & Record<string, unknown>;

/** A new item for a group, with each field's default. */
export function newGroupItem(def: Extract<FieldDef, { type: "group" }>, id: string): GroupItem {
  return { id, ...Object.fromEntries(def.fields.map((f) => [f.name, fieldDefault(f)])) };
}

// ---- Defaults and emptiness ----

/** A field's starting value. */
export function fieldDefault(def: FieldDef): unknown {
  switch (def.type) {
    case "text":
    case "longText":
      return def.default ?? "";
    case "choice":
      return def.multiple ? [] : (def.default ?? "");
    case "number":
      return def.default ?? null;
    case "boolean":
      return def.default ?? false;
    case "reference":
      return [];
    case "group":
      return [];
    case "richText":
      return { type: "doc", content: [] } satisfies RichDoc;
    case "link":
      return null;
    default:
      return "";
  }
}

/** Whether a value counts as empty (empty fields are hidden on the site). */
export function isEmptyValue(def: FieldDef, value: unknown): boolean {
  if (value == null) return true;
  switch (def.type) {
    case "richText":
      return richTextPlain(value) === "";
    case "boolean":
      return value !== true;
    case "number":
      return typeof value !== "number" || Number.isNaN(value);
    case "link":
      return !isLinkTarget(value) || linkIsBlank(value);
    case "choice":
    case "reference":
    case "group":
      return Array.isArray(value) ? value.length === 0 : String(value).trim() === "";
    default:
      return typeof value !== "string" || value.trim() === "";
  }
}

const isLinkTarget = (v: unknown): v is LinkTarget =>
  !!v && typeof v === "object" && typeof (v as { kind?: unknown }).kind === "string";

function linkIsBlank(t: LinkTarget): boolean {
  if (t.kind === "url") return !t.url.trim();
  if (t.kind === "email") return !t.email.trim();
  return false;
}

// ---- Validation ----

const linkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), page: z.string().min(1) }),
  z.object({ kind: z.literal("section"), page: z.string().min(1), section: z.string().min(1) }),
  z.object({ kind: z.literal("url"), url: z.string() }),
  z.object({ kind: z.literal("email"), email: z.string() }),
]);

const richNode: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.enum([
      "text",
      "hardBreak",
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "listItem",
    ]),
    text: z.string().optional(),
    attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).optional(),
    marks: z
      .array(
        z.union([
          z.object({ type: z.enum(["bold", "italic"]) }),
          z.object({
            type: z.literal("link"),
            attrs: z.object({ href: z.string().refine((h) => safeHref(h) !== null) }),
          }),
        ]),
      )
      .optional(),
    content: z.array(richNode).optional(),
  }),
);
const richDocSchema = z.object({ type: z.literal("doc"), content: z.array(richNode).optional() });

/** The schema a value must match (used on the server before saving, and in forms). */
export function fieldSchema(def: FieldDef): z.ZodType<unknown> {
  const optional = <T extends z.ZodType>(s: T) => (def.required ? s : s.optional().nullable());
  switch (def.type) {
    case "text": {
      let s = z.string();
      if (def.maxLength)
        s = s.max(def.maxLength, `${def.label}: at most ${def.maxLength} characters.`);
      return def.required ? s.trim().min(1, `${def.label} is required.`) : s.optional().nullable();
    }
    case "longText":
    case "image":
    case "file":
      return def.required
        ? z.string().trim().min(1, `${def.label} is required.`)
        : z.string().optional().nullable();
    case "date":
      return optional(
        z
          .string()
          .refine(
            (v) => v === "" || /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v),
            `${def.label}: use a valid date.`,
          ),
      );
    case "number": {
      let s = z.number({ error: `${def.label} must be a number.` });
      if (def.min !== undefined) s = s.min(def.min, `${def.label}: at least ${def.min}.`);
      if (def.max !== undefined) s = s.max(def.max, `${def.label}: at most ${def.max}.`);
      return optional(s);
    }
    case "boolean":
      return z.boolean().optional().nullable();
    case "choice": {
      const allowed = def.options.map((o) => o.value);
      const one = z
        .string()
        .refine((v) => v === "" || allowed.includes(v), `${def.label}: pick one of the options.`);
      return def.multiple ? optional(z.array(one)) : optional(one);
    }
    case "link":
      return optional(linkSchema);
    case "reference":
      return optional(z.array(z.string()));
    case "richText":
      return optional(richDocSchema);
    case "group": {
      const item = z.looseObject({
        id: z.string(),
        ...Object.fromEntries(def.fields.map((f) => [f.name, fieldSchema(f)])),
      });
      let s = z.array(item);
      if (def.min !== undefined) s = s.min(def.min, `${def.label}: at least ${def.min} items.`);
      if (def.max !== undefined) s = s.max(def.max, `${def.label}: at most ${def.max} items.`);
      return optional(s);
    }
  }
}

/** Checks values against their fields; returns a message per invalid field (empty when valid). */
export function validateValues(
  defs: FieldDef[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    const v = values[def.name];
    if (def.required && isEmptyValue(def, v)) {
      errors[def.name] = `${def.label} is required.`;
      continue;
    }
    const r = fieldSchema(def).safeParse(v ?? null);
    if (!r.success) errors[def.name] = r.error.issues[0]?.message ?? `${def.label} isn't valid.`;
    // An image needs its description unless it's decorative.
    if (def.type === "image" && def.alt && !def.decorative && !isEmptyValue(def, v)) {
      const alt = values[def.alt];
      if (typeof alt !== "string" || !alt.trim())
        errors[def.alt] = `Describe the image for people who can't see it (${def.label}).`;
    }
  }
  return errors;
}

// ---- Checking declarations (site.config.ts) ----

const NAME = /^[a-z][a-z0-9_]*$/;
const TYPES: FieldType[] = [
  "text",
  "longText",
  "richText",
  "image",
  "file",
  "link",
  "choice",
  "date",
  "number",
  "boolean",
  "reference",
  "group",
];

/**
 * Problems with a list of field declarations, as messages (empty when fine). `where` names the
 * owner in messages, e.g. `section "callout"`.
 */
export function checkFieldDefs(defs: FieldDef[], where: string, nested = false): string[] {
  const out: string[] = [];
  const names = new Set<string>();
  for (const f of defs) {
    const at = `${where}, field "${f.name}"`;
    if (!NAME.test(f.name)) out.push(`${at}: names are lowercase letters, digits and _.`);
    if (f.name === "type" || f.name === "id") out.push(`${at}: "${f.name}" is reserved.`);
    if (names.has(f.name)) out.push(`${at}: the name is used twice.`);
    names.add(f.name);
    if (!TYPES.includes(f.type)) out.push(`${at}: unknown type "${String(f.type)}".`);
    if (f.type === "choice") {
      if (!f.options?.length) out.push(`${at}: a choice needs options.`);
    }
    if (f.type === "group") {
      if (nested) out.push(`${at}: groups can't contain groups.`);
      if (!f.fields.length) out.push(`${at}: a group needs fields.`);
      if (f.min !== undefined && f.max !== undefined && f.min > f.max)
        out.push(`${at}: min is more than max.`);
      out.push(...checkFieldDefs(f.fields, `${at} (group)`, true));
    }
  }
  for (const f of defs)
    if (f.type === "image" && f.alt && !defs.some((g) => g.name === f.alt && g.type === "text"))
      out.push(`${where}, field "${f.name}": its alt field "${f.alt}" must be a text field here.`);
  return out;
}

/** Field names whose editing is handled by another field (an image's alt text). */
export function attachedFields(defs: FieldDef[]): Set<string> {
  return new Set(defs.flatMap((f) => (f.type === "image" && f.alt ? [f.alt] : [])));
}
