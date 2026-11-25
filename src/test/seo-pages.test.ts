import { describe, expect, it } from "vitest";
import {
  allPages,
  customPages,
  duplicateDoc,
  isPageKey,
  newPageKey,
  slugProblem,
  slugify,
  uniqueSlug,
} from "@/lib/pages";
import { resolveSections, readField } from "@/lib/page-sections";
import { FIXED_PAGE_SEO, insightSeo, pageSeo, resolveSeo, seoHead } from "@/lib/seo";
import { resolveLink } from "@/lib/menus";

const created = { key: "page_about", title: "About", slug: "about", published: true } as const;
const draft = { key: "page_team", title: "Team", slug: "team", published: false } as const;
const site = { pages: { list: [created, draft, { junk: true }] } };

describe("pages", () => {
  it("lists built-in pages first, then created ones (ignoring malformed entries)", () => {
    expect(allPages(site).map((p) => [p.key, p.path, p.published])).toEqual([
      ["home", "/", true],
      ["insights", "/insights", true],
      ["investments", "/investments", true],
      ["publications", "/publications", true],
      ["page_about", "/about", true],
      ["page_team", "/team", false],
    ]);
    expect(customPages({}).length).toBe(0);
  });

  it("suggests and checks web addresses", () => {
    expect(slugify("Über uns & Team!")).toBe("uber-uns-and-team");
    expect(slugProblem("about", customPages(site))).toMatch(/Another page/);
    expect(slugProblem("about", customPages(site), "page_about")).toBeNull();
    expect(slugProblem("insights", [])).toMatch(/already used by the site/);
    expect(slugProblem("Bad Slug", [])).toMatch(/lowercase/);
    expect(slugProblem("", [])).toMatch(/Add a web address/);
  });

  it("makes keys that are valid page keys", () => {
    const k = newPageKey();
    expect(isPageKey(k)).toBe(true);
    expect(isPageKey("home")).toBe(true);
    expect(isPageKey("page_Bad-1")).toBe(false);
  });

  it("menu links to a created page work only once it's published", () => {
    const ctx = { posts: [], site };
    expect(resolveLink({ kind: "page", page: "page_about" }, ctx)).toMatchObject({
      href: "/about",
      broken: null,
    });
    expect(resolveLink({ kind: "page", page: "page_team" }, ctx).broken).toMatch(/isn't published/);
    expect(resolveLink({ kind: "page", page: "page_gone" }, ctx).broken).toMatch(
      /no longer exists/,
    );
  });
});

describe("seo", () => {
  it("built-in pages keep their original tags until overridden", () => {
    const s = pageSeo({}, "investments", { title: "Investments page", path: "/investments" });
    expect(s.title).toBe("Investments — MCJames");
    expect(s.description).toBe(FIXED_PAGE_SEO["investments"]!.description);
    expect(s.url).toBe("https://mcotesjames.com/investments");
    expect(s.custom).toEqual({ title: false, description: false, image: false });
  });

  it("the homepage title is used as is; other pages get the site ending", () => {
    expect(pageSeo({}, "home", { title: "Homepage", path: "/" }).title).toBe(
      FIXED_PAGE_SEO["home"]!.title,
    );
    expect(
      pageSeo({ home: { seo: { title: "MCJames" } } }, "home", { title: "Homepage", path: "/" })
        .title,
    ).toBe("MCJames");
    const custom = pageSeo({ settings: { seo: { title_suffix: "| Studio" } } }, "insights", {
      title: "x",
      path: "/insights",
    });
    expect(custom.title).toBe("Insights | Studio");
  });

  it("created pages fall back to their hero, then their name", () => {
    const withHero = pageSeo(
      { page_about: { intro: { title: "About Us", summary: "Who we are." } } },
      "page_about",
      { title: "About", path: "/about" },
    );
    expect([withHero.title, withHero.description]).toEqual(["About Us — MCJames", "Who we are."]);
    expect(pageSeo({}, "page_about", { title: "About", path: "/about" }).pageTitle).toBe("About");
  });

  it("custom values win, blanks stay automatic, and the default share image applies", () => {
    const s = resolveSeo({
      fields: { title: "Custom", description: "  ", image: "" },
      auto: { title: "Auto", description: "Auto description" },
      settings: { default_image: "https://cdn/x.png" },
      path: "/p",
    });
    expect([s.pageTitle, s.description, s.image]).toEqual([
      "Custom",
      "Auto description",
      "https://cdn/x.png",
    ]);
    expect(s.custom.title).toBe(true);
  });

  it("insights use title, standfirst and cover unless overridden", () => {
    const s = insightSeo(
      {
        title: "Chips",
        excerpt: "On fabs.",
        cover_url: "https://cdn/c.jpg",
        slug: "chips",
        seo: { noindex: true },
      },
      {},
    );
    expect([s.title, s.description, s.image, s.url, s.type, s.noindex]).toEqual([
      "Chips — MCJames",
      "On fabs.",
      "https://cdn/c.jpg",
      "https://mcotesjames.com/insights/chips",
      "article",
      true,
    ]);
  });

  it("builds every tag: canonical, social, robots, image and structured data", () => {
    const s = insightSeo(
      {
        title: "Chips",
        excerpt: "On fabs.",
        cover_url: "https://cdn/c.jpg",
        slug: "chips",
        seo: { noindex: true },
      },
      {},
    );
    const head = seoHead(s, { jsonLd: { "@type": "Article" } });
    const meta = (k: string) =>
      head.meta.find((m) => m["name"] === k || m["property"] === k)?.["content"];
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://mcotesjames.com/insights/chips" },
    ]);
    expect([meta("og:url"), meta("og:image"), meta("twitter:card"), meta("robots")]).toEqual([
      "https://mcotesjames.com/insights/chips",
      "https://cdn/c.jpg",
      "summary_large_image",
      "noindex",
    ]);
    expect(head.scripts[0]!.type).toBe("application/ld+json");
  });
});

describe("managing pages like insights", () => {
  it("built-in pages can be renamed (admin name only)", () => {
    const named = allPages({
      pages: { list: [], names: { home: "Front page", nope: "x", insights: "  " } },
    });
    expect(named.map((p) => p.title).slice(0, 2)).toEqual(["Front page", "Insights page"]);
  });

  it("finds a free web address for a copy", () => {
    expect(uniqueSlug("About (copy)", [])).toBe("about-copy");
    expect(
      uniqueSlug("About (copy)", [
        { key: "page_a", title: "A", slug: "about-copy", published: false },
      ]),
    ).toBe("about-copy-2");
    expect(uniqueSlug("Insights", [])).toBe("insights-2");
  });

  it("duplicating a built-in page copies its hero and every section's text into a created page", () => {
    const site = {
      home: {
        hero: { headline: "Investing in a world", cta_label: "Discover" },
        intro: { text: "Statement text" },
        what: { eyebrow: "What we do", intro: "Cards intro" },
        sections: ["intro", "what"],
      },
      settings: { investments_disclaimer: "Disclaimer" },
    };
    let n = 0;
    const doc = duplicateDoc(site, "home", () => `s${++n}`);
    expect(doc["intro"]).toEqual({ title: "Investing in a world", summary: "" });
    expect(doc["sections"]).toEqual(["s1", "s2"]);
    expect(doc["section_data"]).toEqual({
      s1: { type: "statement", text: "Statement text" },
      s2: { type: "cards", eyebrow: "What we do", intro: "Cards intro" },
    });
    // The copy reads as a normal created page with the same text.
    const copy = { ...site, page_copy: doc };
    const secs = resolveSections("page_copy", doc);
    expect(secs.map((s) => readField(copy, s.fields["text"] ?? s.fields["eyebrow"]!))).toEqual([
      "Statement text",
      "What we do",
    ]);
  });

  it("duplicating keeps site-wide fields shared rather than copied", () => {
    const site = {
      investments: { intro: { title_line_1: "Building", title_line_2: "layers.", summary: "Sum" } },
      settings: { investments_disclaimer: "D" },
    };
    const doc = duplicateDoc(site, "investments", () => "g1");
    expect(doc["intro"]).toEqual({ title: "Building layers.", summary: "Sum" });
    expect(doc["section_data"]).toEqual({ g1: { type: "investments_grid" } });
  });
});
