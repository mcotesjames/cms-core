import { describe, expect, it } from "vitest";
import {
  availableTypes,
  insertSection,
  isRequired,
  removeSection,
  resolveSections,
} from "@/lib/page-sections";
import { duplicateDoc, newPageDoc } from "@/lib/pages";
import { TEMPLATES, startingSections, switchTemplate, templateOf } from "@/lib/templates";
import { interactiveFileProblem, normaliseHtml } from "@/lib/interactive";

const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};

const standardPage = {
  intro: { title: "About", summary: "Hi" },
  seo: { title: "About us" },
  sections: ["a", "b", "c"],
  section_data: {
    a: { type: "statement", text: "One" },
    b: { type: "statement", text: "Two" },
    c: { type: "insights_list", label: "More" },
  },
};

describe("page templates", () => {
  it("a page with no template is Standard; built-in pages are always Standard", () => {
    expect(templateOf("page_abc", standardPage)).toBe("standard");
    expect(templateOf("page_abc", { template: "nonsense" })).toBe("standard");
    expect(templateOf("page_abc", { template: "constructor" })).toBe("standard");
    expect(templateOf("home", { template: "interactive" })).toBe("standard");
  });

  it("Standard pages offer every section type except Interactive (as before)", () => {
    const t = availableTypes("page_abc", standardPage);
    expect(t).not.toContain("interactive");
    expect(t).toContain("statement");
    expect(t).toContain("pillars");
    expect(availableTypes("home", { sections: [] })).not.toContain("interactive");
  });

  it("a new Interactive page starts with one required Interactive section", () => {
    const doc = newPageDoc("Game", "interactive", ids());
    expect(doc["template"]).toBe("interactive");
    expect(doc["sections"]).toEqual(["s1"]);
    expect(doc["section_data"].s1).toMatchObject({ type: "interactive", height: "content" });
    expect(isRequired("page_abc", doc, "s1")).toBe(true);
    expect(removeSection("page_abc", doc, "s1")).toBe(doc);
    expect(availableTypes("page_abc", doc)).toEqual(["footnote"]);
  });

  it("Interactive pages have no hero; Standard and built-in pages do", () => {
    expect(TEMPLATES.interactive.hero).toBe(false);
    expect(TEMPLATES[templateOf("page_abc", { template: "interactive" })].hero).toBe(false);
    expect(TEMPLATES[templateOf("page_abc", {})].hero).toBe(true);
    expect(TEMPLATES[templateOf("home", { template: "interactive" })].hero).toBe(true);
  });

  it("a new Standard page starts empty", () => {
    expect(newPageDoc("About", "standard", ids())).toMatchObject({
      template: "standard",
      sections: [],
    });
    expect(startingSections("standard", ids())).toEqual({ sections: [], section_data: {} });
  });

  it("Small print can be added and deleted on an Interactive page; a second Interactive can't", () => {
    const doc = newPageDoc("Game", "interactive", ids());
    expect(insertSection("page_abc", doc, "s1", "statement", "x")).toBeNull();
    expect(insertSection("page_abc", doc, "s1", "interactive", "x")).toBeNull();
    const r = insertSection("page_abc", doc, "s1", "footnote", "fn")!;
    expect(r.doc["sections"]).toEqual(["s1", "fn"]);
    expect(isRequired("page_abc", r.doc, "fn")).toBe(false);
    expect(removeSection("page_abc", r.doc, "fn")["sections"]).toEqual(["s1"]);
  });

  it("switching clears sections and keeps the hero, SEO and everything else", () => {
    const next = switchTemplate(standardPage, "interactive", ids());
    expect(next["intro"]).toEqual(standardPage.intro);
    expect(next["seo"]).toEqual(standardPage.seo);
    expect(next["template"]).toBe("interactive");
    expect(next["sections"]).toEqual(["s1"]);
    expect(Object.keys(next["section_data"])).toEqual(["s1"]);
    const back = switchTemplate(next, "standard", ids());
    expect(back["sections"]).toEqual([]);
    expect(back["section_data"]).toEqual({});
  });

  it("a section the template doesn't allow is never rendered", () => {
    const mixed = {
      sections: ["a", "g"],
      section_data: {
        a: { type: "statement", text: "One" },
        g: { type: "interactive", html_url: "x" },
      },
    };
    expect(resolveSections("page_abc", mixed).map((s) => s.id)).toEqual(["a"]);
    expect(
      resolveSections("page_abc", { ...mixed, template: "interactive" }).map((s) => s.id),
    ).toEqual(["g"]);
  });

  it("duplicating keeps the template and the interactive's file details", () => {
    const game = {
      intro: { title: "Game", summary: "" },
      template: "interactive",
      sections: ["g"],
      section_data: {
        g: {
          type: "interactive",
          html_url: "https://x/v2.html",
          file_name: "v2.html",
          previous_url: "https://x/v1.html",
          previous_name: "v1.html",
          title: "Stockpile",
          height: "screen",
        },
      },
    };
    const copy = duplicateDoc({ page_abc: game }, "page_abc", ids());
    expect(copy["template"]).toBe("interactive");
    expect(copy["section_data"].s1).toEqual({ ...game.section_data.g });
    // Built-in pages copy as Standard.
    expect(duplicateDoc({ home: {} }, "home", ids())["template"]).toBeUndefined();
  });
});

describe("interactive files", () => {
  it("wraps a bare export in a full standards-mode document", () => {
    const html = normaliseHtml("<style>a{}</style><div id=app></div>");
    expect(html.startsWith('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">')).toBe(
      true,
    );
    expect(html).toContain('name="viewport"');
    expect(html).toContain("satoshi");
    expect(html).toContain("<body><style>a{}</style><div id=app></div></body></html>");
  });

  it("only adds the font to a full document", () => {
    const doc = "<!doctype html><html><head><title>t</title></head><body>x</body></html>";
    const html = normaliseHtml(doc);
    expect(html).toBe(doc.replace("</head>", `${html.match(/<link[^>]+>/)![0]}</head>`));
    expect(html.match(/<!doctype/gi)).toHaveLength(1);
  });

  it("accepts .html / .htm up to 5 MB", () => {
    expect(interactiveFileProblem({ name: "game.html", size: 1000 })).toBeNull();
    expect(interactiveFileProblem({ name: "GAME.HTM", size: 1000 })).toBeNull();
    expect(interactiveFileProblem({ name: "game.js", size: 1000 })).toMatch(/html/);
    expect(interactiveFileProblem({ name: "game.html", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});
