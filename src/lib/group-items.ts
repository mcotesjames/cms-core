/**
 * Repeating items in sections (spec: Core scope → Repeating items): a section's `group` field,
 * edited on the canvas. Each item is addressed by its id, not its position, so selection, in-place
 * edits and comments follow it when items move:
 *
 *   group field   "home:section_data.s1.items"
 *   item          "home:section_data.s1.items.#f2"          (data-cms-item)
 *   item field    "home:section_data.s1.items.#f2.title"    (data-cms)
 */
import { getPath, setPath } from "./paths";

type Doc = Record<string, unknown>;
type Item = { id: string } & Record<string, unknown>;

/** An item's address, from its group field's address. */
export const itemAddress = (group: string, id: string) => `${group}.#${id}`;

/** An item field's address, for `data-cms` on text inside an item. */
export const itemFieldAddress = (group: string, id: string, field: string) =>
  `${group}.#${id}.${field}`;

/** Splits an item address into its group field's address and the item's id. */
export function parseItemAddress(address: string | null | undefined): {
  group: string;
  id: string;
  /** The page key and section id when the group belongs to a page section. */
  page: string | null;
  section: string | null;
  /** The group field's name within its section. */
  field: string;
} | null {
  const m = address?.match(
    /^((([a-z_]+):section_data\.([a-z0-9]+))\.([a-z][a-z0-9_]*))\.#([a-z0-9-]+)$/i,
  );
  if (!m) return null;
  return { group: m[1]!, page: m[3]!, section: m[4]!, field: m[5]!, id: m[6]! };
}

const pathOf = (group: string) => group.slice(group.indexOf(":") + 1);

/** The items of a group field in a page doc. */
export function groupItems(doc: Doc | null | undefined, group: string): Item[] {
  const v = doc ? getPath(doc, pathOf(group)) : undefined;
  return Array.isArray(v) ? (v as Item[]).filter((x) => x && typeof x.id === "string") : [];
}

const withItems = (doc: Doc, group: string, items: Item[]) => setPath(doc, pathOf(group), items);

/** Moves an item one place; null when it can't move that way. */
export function moveItem(doc: Doc, group: string, id: string, dir: -1 | 1): Doc | null {
  const items = groupItems(doc, group);
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return null;
  const next = [...items];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return withItems(doc, group, next);
}

/** Adds an item after another (or at the end); null when the group is full. */
export function insertItem(
  doc: Doc,
  group: string,
  item: Item,
  afterId: string | null,
  max?: number,
): Doc | null {
  const items = groupItems(doc, group);
  if (max !== undefined && items.length >= max) return null;
  const at = afterId ? items.findIndex((x) => x.id === afterId) + 1 : items.length;
  const next = [...items];
  next.splice(at <= 0 ? items.length : at, 0, item);
  return withItems(doc, group, next);
}

/** Removes an item; null when the group is at its minimum. */
export function removeItem(doc: Doc, group: string, id: string, min?: number): Doc | null {
  const items = groupItems(doc, group);
  if (min !== undefined && items.length <= min) return null;
  if (!items.some((x) => x.id === id)) return null;
  return withItems(
    doc,
    group,
    items.filter((x) => x.id !== id),
  );
}
