import { describe, expect, it } from "vitest";
import { isSame, matches, switcherFlags } from "@/lib/page-switcher";

const pages = [
  { key: "home" as const, published: true },
  { key: "page_about" as const, published: true },
  { key: "page_new" as const, published: false },
];

describe("page switcher", () => {
  it("marks unpublished changes: a page's own draft, or a site-wide draft on every page", () => {
    const own = switcherFlags({ drafts: ["page_about"], openCommentPlaces: [], pages });
    expect(own.pages["page_about"]!.unpublished).toBe(true);
    expect(own.pages["home"]!.unpublished).toBe(false);
    for (const siteWide of ["menus", "settings"]) {
      const f = switcherFlags({ drafts: [siteWide], openCommentPlaces: [], pages });
      expect(Object.values(f.pages).every((x) => x.unpublished)).toBe(true);
    }
  });

  it("marks created pages that were never published", () => {
    const f = switcherFlags({ drafts: [], openCommentPlaces: [], pages });
    expect(f.pages["page_new"]!.unpublished).toBe(true);
    expect(f.pages["page_about"]!.unpublished).toBe(false);
  });

  it("falls back to the built-in pages", () => {
    const f = switcherFlags({ drafts: ["home"], openCommentPlaces: ["page:home"] });
    expect(Object.keys(f.pages)).toEqual(["home"]);
    expect(f.pages["home"]).toEqual({ unpublished: true, comments: true });
  });

  it("marks pages with unresolved comments left on them", () => {
    const f = switcherFlags({
      drafts: [],
      openCommentPlaces: ["page:page_about", "menu:m-home"],
      pages,
    });
    expect(f.pages["page_about"]!.comments).toBe(true);
    expect(f.pages["home"]!.comments).toBe(false);
  });

  it("matches every word typed, in any case", () => {
    expect(matches("About our team", "team abo")).toBe(true);
    expect(matches("Contact page", "CON")).toBe(true);
    expect(matches("Homepage", "home x")).toBe(false);
    expect(matches("Homepage", "  ")).toBe(true);
  });

  it("knows the current page", () => {
    expect(isSame({ kind: "page", key: "home" }, { kind: "page", key: "home" })).toBe(true);
    expect(isSame({ kind: "page", key: "home" }, { kind: "page", key: "page_about" })).toBe(false);
  });
});
