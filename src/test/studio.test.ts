import { describe, expect, it } from "vitest";
import { canvasSsr, isStudioFrame, moveSection, parseField } from "@/lib/studio-mode";

describe("section reordering", () => {
  const order = ["a", "b", "c"];
  it("moves a section down and up", () => {
    expect(moveSection(order, "a", 1)).toEqual(["b", "a", "c"]);
    expect(moveSection(order, "c", -1)).toEqual(["a", "c", "b"]);
    expect(order).toEqual(["a", "b", "c"]);
  });
  it("first section can't move up", () => expect(moveSection(order, "a", -1)).toBeNull());
  it("last section can't move down", () => expect(moveSection(order, "c", 1)).toBeNull());
  it("an unknown section can't move", () => expect(moveSection(order, "x", 1)).toBeNull());
});

describe("canvas field addresses", () => {
  it("splits a page key from its field path", () => {
    expect(parseField("home:intro.title")).toEqual({ key: "home", path: "intro.title" });
    expect(parseField("page_about:section_data.s1ab.body")).toEqual({
      key: "page_about",
      path: "section_data.s1ab.body",
    });
  });
  it("rejects malformed addresses", () => {
    for (const bad of ["home", "home:", ":intro", "home:intro title", "home-x:intro"])
      expect(parseField(bad)).toBeNull();
  });
});

describe("studio mode", () => {
  it("only the Studio canvas loads data without server rendering", () => {
    expect(canvasSsr({ location: { searchStr: "?studio=1" } })).toBe("data-only");
    expect(canvasSsr({ location: { searchStr: "?studio=0" } })).toBe(true);
    expect(canvasSsr({ location: { searchStr: "" } })).toBe(true);
  });
  it("a top-level window is never the canvas", () => {
    expect(isStudioFrame()).toBe(false);
  });
});
