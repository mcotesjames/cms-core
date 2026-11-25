import { describe, expect, it } from "vitest";
import {
  availableTypes,
  insertSection,
  removeSection,
  resolveSections,
  sectionOrder,
} from "@/lib/page-sections";

const home = { hero: {}, intro: { text: "Hi" }, sections: ["intro", "pillars", "what", "bio"] };

describe("flexible page sections", () => {
  it("existing sections keep reading their original fields", () => {
    const s = resolveSections("home", home);
    expect(s.map((x) => x.type)).toEqual(["statement", "pillars", "cards", "bio"]);
    expect(s[0]!.fields).toEqual({ text: "home:intro.text" });
  });

  it("pages without a saved order show the layout they had before", () => {
    expect(sectionOrder("publications", {})).toEqual(["selected", "index", "footnote"]);
    expect(resolveSections("investments", {}).map((x) => x.type)).toEqual(["investments_grid"]);
    expect(resolveSections("investments", {})[0]!.fields).toEqual({
      disclaimer: "settings:investments_disclaimer",
    });
  });

  it("list-fed sections are offered once per page; text sections always", () => {
    const t = availableTypes("home", home);
    expect(t).not.toContain("pillars");
    expect(t).toContain("statement");
    expect(t).toContain("investments_grid");
  });

  it("adds a new text section with its own content after the chosen section", () => {
    const r = insertSection("home", home, "pillars", "statement", "s1")!;
    expect(r.doc["sections"]).toEqual(["intro", "pillars", "s1", "what", "bio"]);
    expect(r.doc["section_data"].s1).toMatchObject({ type: "statement" });
    expect(resolveSections("home", r.doc)[2]!.fields).toEqual({
      text: "home:section_data.s1.text",
    });
  });

  it("null adds straight after the hero", () => {
    const r = insertSection("insights", {}, null, "statement", "s2")!;
    expect(r.doc["sections"]).toEqual(["s2", "list"]);
  });

  it("refuses a second copy of a list-fed section", () => {
    expect(insertSection("home", home, "bio", "pillars", "s3")).toBeNull();
  });

  it("deleting an original section keeps its content, and re-adding brings it back", () => {
    const removed = removeSection("home", home, "intro");
    expect(removed["sections"]).toEqual(["pillars", "what", "bio"]);
    expect(removed["intro"]).toEqual({ text: "Hi" });
    const back = insertSection("home", removed, "bio", "statement", "s4")!;
    expect(back.id).toBe("intro");
    expect(back.doc["sections"]).toEqual(["pillars", "what", "bio", "intro"]);
  });

  it("deleting an added section removes its own content", () => {
    const r = insertSection("home", home, null, "footnote", "s5")!;
    const removed = removeSection("home", r.doc, "s5");
    expect(removed["sections"]).toEqual(["intro", "pillars", "what", "bio"]);
    expect(removed["section_data"]).toEqual({});
  });
});
