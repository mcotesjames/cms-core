import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import site from "@/site/site.config";
import { validateSite, type SiteConfig } from "@/lib/site-config";
import { availableTypes, isRequired, removeSection, resolveSections } from "@/lib/page-sections";
import { newPageDoc, uniqueSlug } from "@/lib/pages";
import { templateDef, templateOf } from "@/lib/templates";

const Noop = () => null;
const base: SiteConfig = { name: "Example", url: "https://example.com" };
const section = {
  label: "Banner",
  repeatable: true,
  fields: [{ name: "text", label: "Text" }],
  defaults: { text: "" },
  component: Noop,
};

describe("defineSite() checks the site's config", () => {
  it("accepts a minimal config", () => {
    expect(validateSite(base)).toBe(base);
  });

  it("refuses an address that isn't a bare https origin", () => {
    for (const url of [
      "http://example.com",
      "https://example.com/",
      "https://example.com/path",
      "",
    ])
      expect(() => validateSite({ ...base, url })).toThrow(/url/);
  });

  it("refuses site sections or templates that reuse platform keys", () => {
    expect(() => validateSite({ ...base, sections: { text: section } })).toThrow(/platform/);
    expect(() =>
      validateSite({
        ...base,
        templates: {
          standard: { label: "S", description: "", hero: true, required: [], sections: ["text"] },
        },
      }),
    ).toThrow(/platform/);
  });

  it("refuses templates that name unknown sections or require sections they don't offer", () => {
    const tpl = (required: string[], sections: string[]) => ({
      ...base,
      templates: { promo: { label: "Promo", description: "", hero: false, required, sections } },
    });
    expect(() => validateSite(tpl([], ["missing"]))).toThrow(/unknown section/);
    expect(() => validateSite(tpl(["image"], ["text"]))).toThrow(/must also be in sections/);
    expect(validateSite(tpl(["text"], ["text", "image"]))).toBeTruthy();
  });

  it("refuses defaults for fields a section doesn't have, and a field called type", () => {
    expect(() =>
      validateSite({ ...base, sections: { banner: { ...section, defaults: { colour: "red" } } } }),
    ).toThrow(/default "colour"/);
    expect(() =>
      validateSite({
        ...base,
        sections: {
          banner: { ...section, fields: [{ name: "type", label: "Type" }], defaults: {} },
        },
      }),
    ).toThrow(/type/);
  });

  it("refuses a section limited to a template that doesn't exist", () => {
    expect(() =>
      validateSite({ ...base, sections: { banner: { ...section, templates: ["nope"] } } }),
    ).toThrow(/unknown template/);
  });
});

describe("the fixture site's Landing template", () => {
  let n = 0;
  const ids = () => `s${++n}`;

  it("has no hero and starts with its required Callout", () => {
    expect(templateDef("landing").hero).toBe(false);
    const doc = newPageDoc("Spring offer", "landing", ids);
    expect(templateOf("page_offer", doc)).toBe("landing");
    const sections = resolveSections("page_offer", doc);
    expect(sections.map((s) => s.type)).toEqual(["callout"]);
    expect(isRequired("page_offer", doc, sections[0]!.id)).toBe(true);
    expect(removeSection("page_offer", doc, sections[0]!.id)).toBe(doc);
  });

  it("offers only its own sections", () => {
    const doc = newPageDoc("Spring offer", "landing", ids);
    expect(availableTypes("page_offer", doc)).toEqual(["text", "image", "callout"]);
  });

  it("falls back to Standard for a template the site no longer has", () => {
    expect(templateOf("page_old", { template: "retired" })).toBe("standard");
    expect(templateDef("retired").label).toBe("Standard");
    expect(uniqueSlug("Spring offer", [])).toBe("spring-offer");
  });
});

describe("the site's own routes", () => {
  it("are all listed in site.config.ts `routes`, so Studio pages can't take their addresses", () => {
    const files = readdirSync(join(__dirname, "../site/routes")).filter((f) => /\.tsx?$/.test(f));
    const top = [...new Set(files.map((f) => f.replace(/\.tsx?$/, "").split(/[./]/)[0]!))];
    for (const route of top) expect(site.routes ?? []).toContain(route);
  });

  it("can't be used as a created page's address", async () => {
    const { slugProblem } = await import("@/lib/pages");
    expect(slugProblem("styleguide", [])).toMatch(/already used/);
  });
});
