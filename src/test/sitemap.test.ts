import { describe, expect, it } from "vitest";
import { buildSitemap, readSitemapRows } from "@/lib/sitemap";

describe("sitemap", () => {
  it("includes all four built-in pages and published created pages", () => {
    const body = buildSitemap(
      [
        {
          key: "pages",
          content: {
            list: [
              {
                key: "page_minerals",
                title: "Minerals",
                slug: "critical-minerals-standoff",
                published: true,
              },
              { key: "page_draft", title: "Draft", slug: "unpublished", published: false },
            ],
          },
        },
      ],
      [],
    );
    for (const path of [
      "/",
      "/insights",
      "/investments",
      "/publications",
      "/critical-minerals-standoff",
    ]) {
      expect(body).toContain(`<loc>https://mcotesjames.com${path}</loc>`);
    }
    expect(body).not.toContain("/unpublished");
  });

  it("includes every published insight, not drafts or noindex entries", () => {
    const body = buildSitemap(
      [],
      [
        { slug: "visible", published: true, published_at: "2026-10-23T00:00:00Z", seo: null },
        { slug: "draft", published: false, published_at: null, seo: null },
        { slug: "hidden", published: true, published_at: null, seo: { noindex: true } },
      ],
    );
    expect(body).toContain(
      "<loc>https://mcotesjames.com/insights/visible</loc><lastmod>2026-10-23</lastmod>",
    );
    expect(body).not.toContain("/insights/draft");
    expect(body).not.toContain("/insights/hidden");
  });

  it("excludes pages hidden from search", () => {
    expect(
      buildSitemap([{ key: "investments", content: { seo: { noindex: true } } }], []),
    ).not.toContain("<loc>https://mcotesjames.com/investments</loc>");
  });

  it("omits page lastmod because a draft save is not a live page change", () => {
    expect(buildSitemap([{ key: "home", content: {} }], [])).not.toContain("<lastmod>");
  });

  it("escapes XML characters in content addresses", () => {
    expect(
      buildSitemap([], [{ slug: "a&b", published: true, published_at: null, seo: null }]),
    ).toContain("/insights/a&amp;b</loc>");
  });

  it("paginates beyond one response so later published rows are included", async () => {
    const source = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const ranges: number[][] = [];
    const rows = await readSitemapRows(async (from, to) => {
      ranges.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    });
    expect(rows).toEqual(source);
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });

  it("rejects a failed later page rather than returning a partial sitemap", async () => {
    const error = new Error("Source unavailable");
    await expect(
      readSitemapRows(
        async (from) => (from === 0 ? { data: [{ id: 1 }], error: null } : { data: null, error }),
        1,
      ),
    ).rejects.toBe(error);
  });
});
