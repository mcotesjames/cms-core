/**
 * Paths into content documents, e.g. "section_data.s1.heading". A segment "#<id>" picks the item
 * with that id from a list (repeating items: "section_data.s1.items.#f2.title"), so an address
 * keeps pointing at the same item when items are reordered, added or removed.
 */
type Obj = Record<string, unknown>;

const isItemSeg = (k: string) => k.startsWith("#");

function child(a: unknown, k: string): unknown {
  if (a == null || typeof a !== "object") return undefined;
  if (isItemSeg(k))
    return Array.isArray(a)
      ? a.find((x) => !!x && typeof x === "object" && (x as Obj)["id"] === k.slice(1))
      : undefined;
  return (a as Obj)[k];
}

/** The value at a path, or undefined. */
export function getPath(o: unknown, path: string): unknown {
  if (!path) return o;
  return path.split(".").reduce<unknown>(child, o);
}

/** A copy of `o` with the value at `path` replaced (missing objects are created; missing items aren't). */
export function setPath<T extends Obj>(o: T, path: string, v: unknown): T {
  const [k, ...rest] = path.split(".");
  return setIn(o, k!, rest, v) as T;
}

function setIn(o: unknown, k: string, rest: string[], v: unknown): unknown {
  const next = (cur: unknown) => (rest.length ? setIn(cur ?? {}, rest[0]!, rest.slice(1), v) : v);
  if (isItemSeg(k)) {
    if (!Array.isArray(o)) return o;
    const id = k.slice(1);
    return o.map((x) => (!!x && typeof x === "object" && (x as Obj)["id"] === id ? next(x) : x));
  }
  const base = o != null && typeof o === "object" && !Array.isArray(o) ? (o as Obj) : {};
  return { ...base, [k]: next(base[k]) };
}
