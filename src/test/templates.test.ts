import { describe, expect, it } from "vitest";
import { availableTypes, resolveSections } from "@/lib/page-sections";
import { duplicateDoc, newPageDoc } from "@/lib/pages";
import {
  TEMPLATE_ORDER,
  TEMPLATES,
  isTemplateKey,
  startingSections,
  switchTemplate,
  templateOf,
} from "@/lib/templates";

const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};

const aboutPage = {
  intro: { title: "About", summary: "Hi" },
  seo: { title: "About us" },
  template: "standard",
  sections: ["a", "b"],
  section_data: {
    a: { type: "text", heading: "One", body: "First" },
    b: {
      type: "image",
      image_url: "https://example.com/a.jpg",
      alt: "A",
      caption: "",
      width: "full",
    },
  },
};

describe("page templates", () => {
  it("Standard is the only template and it shows the hero", () => {
    expect(TEMPLATE_ORDER).toEqual(["standard"]);
    expect(TEMPLATES.standard.hero).toBe(true);
    expect(TEMPLATES.standard.required).toEqual([]);
    expect(isTemplateKey("standard")).toBe(true);
    expect(isTemplateKey("interactive")).toBe(false);
    expect(isTemplateKey("toString")).toBe(false);
  });

  it("a page with no or an unknown template is Standard; built-in pages are always Standard", () => {
    expect(templateOf("page_abc", {})).toBe("standard");
    expect(templateOf("page_abc", { template: "nonsense" })).toBe("standard");
    expect(templateOf("home", { template: "interactive" })).toBe("standard");
  });

  it("Standard pages allow both section types", () => {
    expect(availableTypes("page_abc", aboutPage)).toEqual(["text", "image"]);
  });

  it("a new Standard page starts with its title, an empty summary and no sections", () => {
    expect(newPageDoc("About", "standard", ids())).toEqual({
      intro: { title: "About", summary: "" },
      template: "standard",
      sections: [],
      section_data: {},
    });
    expect(startingSections("standard", ids())).toEqual({ sections: [], section_data: {} });
  });

  it("switching clears sections and keeps the hero, SEO and everything else", () => {
    const next = switchTemplate(aboutPage, "standard", ids());
    expect(next["intro"]).toEqual(aboutPage.intro);
    expect(next["seo"]).toEqual(aboutPage.seo);
    expect(next["template"]).toBe("standard");
    expect(next["sections"]).toEqual([]);
    expect(next["section_data"]).toEqual({});
  });
});

describe("duplicating pages", () => {
  it("copies the hero and every section's content under new ids, without SEO", () => {
    const copy = duplicateDoc({ page_abc: aboutPage }, "page_abc", ids());
    expect(copy).toEqual({
      intro: { title: "About", summary: "Hi" },
      sections: ["s1", "s2"],
      section_data: {
        s1: { type: "text", heading: "One", body: "First" },
        s2: {
          type: "image",
          image_url: "https://example.com/a.jpg",
          alt: "A",
          caption: "",
          width: "full",
        },
      },
    });
    expect(resolveSections("page_xyz", copy).map((s) => s.type)).toEqual(["text", "image"]);
  });

  it("copies a built-in page, and fills missing fields with empty text", () => {
    const site = {
      home: {
        intro: { title: "Welcome" },
        sections: ["h"],
        section_data: { h: { type: "text", heading: "Hello" } },
      },
    };
    expect(duplicateDoc(site, "home", ids())).toEqual({
      intro: { title: "Welcome", summary: "" },
      sections: ["s1"],
      section_data: { s1: { type: "text", heading: "Hello", body: "" } },
    });
    expect(duplicateDoc({}, "home", ids())).toEqual({
      intro: { title: "", summary: "" },
      sections: [],
      section_data: {},
    });
  });
});
