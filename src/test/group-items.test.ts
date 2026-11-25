import { describe, expect, it } from "vitest";
import { getPath, setPath } from "@/lib/paths";
import {
  groupItems,
  insertItem,
  itemAddress,
  itemFieldAddress,
  moveItem,
  parseItemAddress,
  removeItem,
} from "@/lib/group-items";
import { parseField } from "@/lib/studio-mode";
import { readValue } from "@/lib/page-sections";

const doc = {
  section_data: {
    s1: {
      type: "features",
      items: [
        { id: "a", title: "One" },
        { id: "b", title: "Two" },
        { id: "c", title: "Three" },
      ],
    },
  },
};
const group = "home:section_data.s1.items";

describe("paths", () => {
  it("pick list items by id with #id segments", () => {
    expect(getPath(doc, "section_data.s1.items.#b.title")).toBe("Two");
    expect(getPath(doc, "section_data.s1.items.#zzz.title")).toBeUndefined();
    const next = setPath(doc, "section_data.s1.items.#b.title", "Deux");
    expect(getPath(next, "section_data.s1.items.#b.title")).toBe("Deux");
    expect(getPath(doc, "section_data.s1.items.#b.title")).toBe("Two");
    // Setting an item that isn't there changes nothing.
    expect(groupItems(setPath(doc, "section_data.s1.items.#zzz.title", "x"), group)).toEqual(
      groupItems(doc, group),
    );
  });

  it("are accepted in canvas field addresses", () => {
    expect(parseField(itemFieldAddress(group, "b", "title"))).toEqual({
      key: "home",
      path: "section_data.s1.items.#b.title",
    });
    expect(readValue({ home: doc }, itemFieldAddress(group, "c", "title"))).toBe("Three");
  });
});

describe("repeating items", () => {
  it("parse item addresses", () => {
    expect(parseItemAddress(itemAddress(group, "b"))).toEqual({
      group,
      page: "home",
      section: "s1",
      field: "items",
      id: "b",
    });
    expect(parseItemAddress("menu:m-home")).toBeNull();
    expect(parseItemAddress(null)).toBeNull();
  });

  it("move, add and remove items within min / max", () => {
    const ids = (d: typeof doc | null) => groupItems(d, group).map((x) => x.id);
    expect(ids(moveItem(doc, group, "b", -1) as typeof doc)).toEqual(["b", "a", "c"]);
    expect(moveItem(doc, group, "a", -1)).toBeNull();
    expect(ids(insertItem(doc, group, { id: "n" }, "a") as typeof doc)).toEqual([
      "a",
      "n",
      "b",
      "c",
    ]);
    expect(ids(insertItem(doc, group, { id: "n" }, null) as typeof doc)).toEqual([
      "a",
      "b",
      "c",
      "n",
    ]);
    expect(insertItem(doc, group, { id: "n" }, "a", 3)).toBeNull();
    expect(ids(removeItem(doc, group, "b") as typeof doc)).toEqual(["a", "c"]);
    expect(removeItem(doc, group, "b", 3)).toBeNull();
  });
});
