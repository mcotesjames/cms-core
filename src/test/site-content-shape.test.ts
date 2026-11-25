import { describe, expect, it } from "vitest";
import { normalizeSiteContent } from "@/lib/site-content-shape";

describe("missing CMS rows", () => {
  it("supplies empty settings and the homepage hero", () => {
    const result = normalizeSiteContent({});
    expect(result["settings"]).toEqual({
      contact_email: "",
      footer_heading: "",
      footer_tagline: "",
    });
    expect(result["home"]).toEqual({ intro: { title: "", summary: "" } });
  });

  it("replaces non-text values in known fields with empty text", () => {
    const result = normalizeSiteContent({
      home: { intro: { title: 5, summary: null } },
      settings: "broken",
    });
    expect(result["home"]).toEqual({ intro: { title: "", summary: "" } });
    expect(result["settings"]).toMatchObject({ contact_email: "" });
  });

  it("preserves saved content, drafts, section order and custom pages", () => {
    const site = {
      home: {
        intro: { title: "Saved title" },
        sections: ["s1"],
        draft: { intro: { title: "Unpublished" } },
      },
      settings: { contact_email: "info@example.com", seo: { site_name: "Example" } },
      page_demo: { template: "standard" },
    };
    const result = normalizeSiteContent(site);
    expect(result["home"]).toMatchObject(site.home);
    expect(result["home"]).toMatchObject({ intro: { title: "Saved title", summary: "" } });
    expect(result["settings"]).toMatchObject(site.settings);
    expect(result["page_demo"]).toBe(site.page_demo);
    expect(site.home.intro).toEqual({ title: "Saved title" });
  });
});
