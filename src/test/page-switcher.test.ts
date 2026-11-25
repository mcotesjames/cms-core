import { describe, expect, it } from "vitest";
import { isSame, matches, switcherFlags } from "@/lib/page-switcher";

const post = (id: string, p: Partial<{ published: boolean; hasDraft: boolean }> = {}) => ({
  id,
  title: id,
  published: true,
  hasDraft: false,
  published_at: null,
  ...p,
});

describe("page switcher", () => {
  it("marks unpublished changes: a page's own draft, or a site-wide draft on every page", () => {
    const own = switcherFlags({ drafts: ["investments"], posts: [], openCommentPlaces: [] });
    expect(own.pages["investments"]!.unpublished).toBe(true);
    expect(own.pages["home"]!.unpublished).toBe(false);
    const menus = switcherFlags({ drafts: ["menus"], posts: [], openCommentPlaces: [] });
    expect(Object.values(menus.pages).every((f) => f.unpublished)).toBe(true);
  });

  it("marks insights with a draft or never published, and rolls them up to Insights", () => {
    const f = switcherFlags({
      drafts: [],
      posts: [post("a"), post("b", { hasDraft: true }), post("c", { published: false })],
      openCommentPlaces: ["post:a"],
    });
    expect([
      f.posts["a"]!.unpublished,
      f.posts["b"]!.unpublished,
      f.posts["c"]!.unpublished,
    ]).toEqual([false, true, true]);
    expect(f.posts["a"]!.comments).toBe(true);
    expect(f.insights).toEqual({ unpublished: true, comments: true });
  });

  it("marks pages with unresolved comments left on them", () => {
    const f = switcherFlags({
      drafts: [],
      posts: [],
      openCommentPlaces: ["page:home", "record:investments:x"],
    });
    expect(f.pages["home"]!.comments).toBe(true);
    expect(f.pages["investments"]!.comments).toBe(false);
  });

  it("matches every word typed, in any case", () => {
    expect(matches("The New Geography of Semiconductors", "geo semi")).toBe(true);
    expect(matches("Publications page", "PUB")).toBe(true);
    expect(matches("Homepage", "home x")).toBe(false);
  });

  it("knows the current page", () => {
    expect(isSame({ kind: "page", key: "home" }, { kind: "page", key: "home" })).toBe(true);
    expect(isSame({ kind: "page", key: "home" }, { kind: "post", id: "home" })).toBe(false);
  });
});
