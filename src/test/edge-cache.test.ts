import { describe, expect, it } from "vitest";
import { cacheKind, pageCacheKey } from "@/data/cache.server";
import { buildRobots } from "@/lib/sitemap";
import { SITE_URL } from "@/lib/seo";

const get = (path: string, method = "GET") => new Request(`https://example.com${path}`, { method });

describe("edge cache", () => {
  it("caches public pages, the sitemap and robots", () => {
    for (const path of ["/", "/about", "/sitemap.xml", "/robots.txt", "/about?utm_source=x"])
      expect(cacheKind(get(path))).toBe("page");
  });

  it("caches media by address", () => {
    expect(cacheKind(get("/media/library/1-photo.webp"))).toBe("media");
  });

  it("never caches the Studio, server functions, the canvas or non-GET requests", () => {
    for (const path of ["/admin", "/admin/pages", "/_serverFn/abc", "/studio", "/?studio=1"])
      expect(cacheKind(get(path))).toBeNull();
    expect(cacheKind(get("/", "POST"))).toBeNull();
  });

  it("keys pages by build as well as content, so a deploy never serves the old build's HTML", () => {
    const url = new URL("https://example.com/about?utm_source=x");
    const before = pageCacheKey(url, "2026-11-25T10:00:00Z", "abc123");
    expect(before).toBe(
      pageCacheKey(new URL("https://example.com/about"), "2026-11-25T10:00:00Z", "abc123"),
    );
    expect(pageCacheKey(url, "2026-11-25T10:00:00Z", "def456")).not.toBe(before);
    expect(pageCacheKey(url, "2026-11-25T11:00:00Z", "abc123")).not.toBe(before);
  });

  it("doesn't treat pages that merely start with a private word as private", () => {
    expect(cacheKind(get("/administration"))).toBe("page");
  });
});

describe("robots.txt", () => {
  it("keeps crawlers out of the Studio and points at the sitemap", () => {
    const robots = buildRobots();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /_serverFn");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});

describe("robots.txt off production", () => {
  it("blocks everything", () => {
    expect(buildRobots(false)).toBe("User-agent: *\nDisallow: /\n");
  });
});
