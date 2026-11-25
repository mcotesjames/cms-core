import { describe, expect, it } from "vitest";
import { normalizeSiteContent } from "@/lib/site-content-shape";

describe("missing CMS rows", () => {
  it("supplies empty settings and nested page fields", () => {
    const result = normalizeSiteContent({});
    expect(result["settings"]).toMatchObject({ substack_url: "", contact_email: "" });
    expect(result["home"]).toMatchObject({ hero: { headline: "", cta_label: "" } });
  });
  it("preserves saved content, drafts, section order and custom pages", () => {
    const site = {
      home: {
        hero: { headline: "Saved headline" },
        sections: ["s1"],
        draft: { text: "Unpublished" },
      },
      page_demo: { template: "interactive" },
    };
    const result = normalizeSiteContent(site);
    expect(result["home"]).toMatchObject(site.home);
    expect(result["page_demo"]).toBe(site.page_demo);
    expect(site.home.hero).toEqual({ headline: "Saved headline" });
  });
});
