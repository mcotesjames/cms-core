import { describe, expect, it } from "vitest";
import {
  currentList,
  moveItem,
  newItem,
  parseItem,
  placeInBox,
  planPublish,
} from "@/lib/list-drafts";

const live = [
  { id: "a", title: "Strategy", sort: 1 },
  { id: "b", title: "Invest", sort: 2 },
];

describe("list drafts", () => {
  it("shows live items until the list has a draft", () => {
    expect(currentList({ pillars: live }, null, "pillars")).toBe(live);
    const draft = { pillars: [live[1]!] };
    expect(currentList({ pillars: live }, draft, "pillars")).toEqual([live[1]]);
  });

  it("new items get visible placeholder content", () => {
    expect(newItem("pillars", "n1")).toMatchObject({ id: "n1", title: "New pillar" });
    expect(newItem("hotspots", "n2")).toMatchObject({ id: "n2", x: 50, y: 50 });
  });

  it("new items don't share nested defaults", () => {
    const a = newItem("pillars", "1");
    (a["accordions"] as unknown[]).push({ title: "x", body: "" });
    expect(newItem("pillars", "2")["accordions"]).toEqual([]);
  });

  it("moves an item and refuses moves past either end", () => {
    expect(moveItem(live, "b", -1)!.map((r) => r.id)).toEqual(["b", "a"]);
    expect(moveItem(live, "a", -1)).toBeNull();
  });

  it("publish writes the draft order and deletes only removed live rows", () => {
    const draft = [
      { id: "b", title: "Invest" },
      { id: "n", title: "New" },
    ];
    const plan = planPublish(live, draft);
    expect(plan.upserts.map((r) => [r.id, r.sort])).toEqual([
      ["b", 1],
      ["n", 2],
    ]);
    expect(plan.deletes).toEqual(["a"]);
  });

  it("reads item addresses", () => {
    expect(parseItem("hotspots:abc-1")).toEqual({ list: "hotspots", id: "abc-1" });
    expect(parseItem("home:intro")).toBeNull();
  });

  it("converts a click into clamped % coordinates", () => {
    const box = { left: 100, top: 50, width: 400, height: 200 };
    expect(placeInBox(box, 300, 150)).toEqual({ x: 50, y: 50 });
    expect(placeInBox(box, 0, 999)).toEqual({ x: 0, y: 100 });
  });
});
