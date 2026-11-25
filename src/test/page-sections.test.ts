import { describe, expect, it } from "vitest";
import {
  availableTypes,
  insertSection,
  isRequired,
  readField,
  removeSection,
  resolveSection,
  resolveSections,
  sectionOrder,
} from "@/lib/page-sections";

const home = {
  intro: { title: "Welcome", summary: "Hi" },
  sections: ["a", "b"],
  section_data: {
    a: { type: "text", heading: "About", body: "One" },
    b: {
      type: "image",
      image_url: "https://example.com/x.jpg",
      alt: "",
      caption: "",
      width: "full",
    },
  },
};

describe("flexible page sections", () => {
  it("resolves each section to its own field addresses, in page order", () => {
    const s = resolveSections("home", home);
    expect(s.map((x) => x.type)).toEqual(["text", "image"]);
    expect(s[0]!.fields).toEqual({
      heading: "home:section_data.a.heading",
      body: "home:section_data.a.body",
    });
    expect(Object.keys(s[1]!.fields)).toEqual(["image_url", "alt", "caption", "width"]);
    expect(readField({ home }, s[0]!.fields["heading"]!)).toBe("About");
    expect(readField({ home }, "home:section_data.zz.heading")).toBe("");
  });

  it("a page with no saved order has no sections; unknown ids and types are skipped", () => {
    expect(sectionOrder("home", {})).toEqual([]);
    expect(sectionOrder("home", { sections: ["a", 3, null] })).toEqual(["a"]);
    expect(resolveSections("page_abc", null)).toEqual([]);
    const odd = { sections: ["a", "x", "y"], section_data: { y: { type: "pillars" } } };
    expect(
      resolveSections("home", {
        ...odd,
        section_data: { ...home.section_data, ...odd.section_data },
      }).map((s) => s.id),
    ).toEqual(["a"]);
    expect(resolveSection("home", odd, "y")).toBeNull();
  });

  it("offers the platform's sections, then the site's own (all repeatable here)", () => {
    expect(availableTypes("home", home)).toEqual(["text", "image", "callout"]);
    expect(availableTypes("page_abc", {})).toEqual(["text", "image", "callout"]);
  });

  it("adds a section with its type's defaults after the chosen section", () => {
    const r = insertSection("home", home, "a", "text", "s1")!;
    expect(r.id).toBe("s1");
    expect(r.doc["sections"]).toEqual(["a", "s1", "b"]);
    expect(r.doc["section_data"].s1).toEqual({
      type: "text",
      heading: "A heading",
      body: "Write your text here.",
    });
    expect(resolveSections("home", r.doc)[1]!.fields["body"]).toBe("home:section_data.s1.body");
    // The original doc is untouched.
    expect(home.sections).toEqual(["a", "b"]);
  });

  it("null adds straight after the hero; an unknown anchor appends", () => {
    expect(insertSection("home", home, null, "image", "s2")!.doc["sections"]).toEqual([
      "s2",
      "a",
      "b",
    ]);
    expect(insertSection("home", home, "gone", "image", "s3")!.doc["sections"]).toEqual([
      "a",
      "b",
      "s3",
    ]);
    const first = insertSection("page_abc", {}, null, "image", "s4")!;
    expect(first.doc["sections"]).toEqual(["s4"]);
    expect(first.doc["section_data"].s4).toMatchObject({ type: "image", width: "contained" });
  });

  it("deleting a section removes it and its own content", () => {
    const removed = removeSection("home", home, "a");
    expect(removed["sections"]).toEqual(["b"]);
    expect(removed["section_data"]).toEqual({ b: home.section_data.b });
    expect(removed["intro"]).toEqual(home.intro);
  });

  it("no section is required on a Standard page", () => {
    expect(isRequired("home", home, "a")).toBe(false);
    expect(isRequired("page_abc", home, "b")).toBe(false);
  });
});
