/**
 * Draft editing for the shared lists shown inside page sections (pillars, stacking cards,
 * biography hotspots). Live items stay in their own tables, which the public site reads.
 * While editing, the whole edited list is kept as a draft in the site_content row "lists"
 * (draft column); Publish writes it back to the tables and clears the draft, Discard clears it.
 */

export type ListName = "pillars" | "cards" | "hotspots";
export type ListRow = { id: string; sort?: number } & Record<string, unknown>;
export type ListsDraft = Partial<Record<ListName, ListRow[]>>;

export type ItemField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "number" | "list" | "accordions";
};

export type ListDef = {
  table: "pillars" | "stack_cards" | "hotspots";
  /** "Pillars" — the list heading. */
  title: string;
  /** "pillar" — used in "Add pillar" / "Delete pillar". */
  singular: string;
  titleKey: string;
  fields: ItemField[];
  /** Placeholder content for a newly added item, so it is visible on the page straight away. */
  defaults: Record<string, unknown>;
};

export const LISTS: Record<ListName, ListDef> = {
  pillars: {
    table: "pillars",
    title: "Pillars",
    singular: "pillar",
    titleKey: "title",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "tagline", label: "Tagline", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
      { key: "image_url", label: "Image", type: "image" },
      { key: "accordions", label: "Accordions", type: "accordions" },
    ],
    defaults: {
      title: "New pillar",
      tagline: "Tagline",
      body: "Describe this pillar.",
      image_url: "",
      accordions: [],
    },
  },
  cards: {
    table: "stack_cards",
    title: "Cards",
    singular: "card",
    titleKey: "title",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "body", label: "Description", type: "textarea" },
      { key: "image_url", label: "Photo", type: "image" },
    ],
    defaults: { title: "New card", body: "Describe this card.", image_url: "" },
  },
  hotspots: {
    table: "hotspots",
    title: "Hotspots",
    singular: "hotspot",
    titleKey: "label",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "body", label: "Text", type: "textarea" },
      { key: "items", label: "Bullet points", type: "list" },
      { key: "link_url", label: "Link URL (optional — opens instead of expanding)", type: "text" },
      { key: "x", label: "Horizontal position (0–100%)", type: "number" },
      { key: "y", label: "Vertical position (0–100%)", type: "number" },
    ],
    defaults: { label: "New point", body: "", items: [], link_url: "", x: 50, y: 50 },
  },
};

export const LIST_NAMES = Object.keys(LISTS) as ListName[];
export const isListName = (s: string): s is ListName => s in LISTS;

/** "pillars:<id>" item address used between the editor and the canvas. */
export const itemAddress = (list: ListName, id: string) => `${list}:${id}`;
export function parseItem(
  address: string | null | undefined,
): { list: ListName; id: string } | null {
  const m = address?.match(/^([a-z]+):(.+)$/);
  return m && isListName(m[1]!) ? { list: m[1], id: m[2]! } : null;
}

/** The list as currently being edited: its draft if there is one, otherwise the live items. */
export function currentList(
  live: Partial<Record<ListName, ListRow[]>>,
  draft: ListsDraft | null | undefined,
  list: ListName,
): ListRow[] {
  return draft?.[list] ?? live[list] ?? [];
}

export function newItem(list: ListName, id: string): ListRow {
  return { id, ...structuredClone(LISTS[list].defaults) };
}

export function moveItem(rows: ListRow[], id: string, dir: -1 | 1): ListRow[] | null {
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return null;
  const next = [...rows];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * What Publish writes for one list: every draft row upserted with its position as `sort`,
 * and the ids of live rows the editor deleted from the draft.
 */
export function planPublish(
  live: ListRow[],
  draft: ListRow[],
): { upserts: ListRow[]; deletes: string[] } {
  const keep = new Set(draft.map((r) => r.id));
  return {
    upserts: draft.map((r, i) => ({ ...r, sort: i + 1 })),
    deletes: live.filter((r) => !keep.has(r.id)).map((r) => r.id),
  };
}

/** Converts a click inside the biography canvas into rounded % coordinates for a hotspot. */
export function placeInBox(
  box: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
): { x: number; y: number } {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
  return {
    x: clamp(((x - box.left) / box.width) * 100),
    y: clamp(((y - box.top) / box.height) * 100),
  };
}
