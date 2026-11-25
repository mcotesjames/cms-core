import { describe, expect, it } from "vitest";
import {
  allPages,
  customPages,
  findPage,
  isPageKey,
  newPageKey,
  slugProblem,
  slugify,
  uniqueSlug,
} from "@/lib/pages";
import {
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  organisationLd,
  pageSeo,
  readSeoFields,
  resolveSeo,
  seoHead,
  titleSuffix,
} from "@/lib/seo";

const created = { key: "page_about", title: "About", slug: "about", published: true } as const;
const draft = { key: "page_team", title: "Team", slug: "team", published: false } as const;
const site = { pages: { list: [created, draft, { junk: true }] } };

describe("pages", () => {
  it("lists the built-in homepage first, then created ones (ignoring malformed entries)", () => {
    expect(allPages(site).map((p) => [p.key, p.path, p.published, p.custom])).toEqual([
      ["home", "/", true, false],
      ["page_about", "/about", true, true],
      ["page_team", "/team", false, true],
    ]);
    expect(allPages(site).every((p) => p.template === "standard")).toBe(true);
    expect(customPages({}).length).toBe(0);
    expect(findPage(site, "page_team")?.title).toBe("Team");
    expect(findPage(site, "page_gone")).toBeUndefined();
  });

  it("suggests and checks web addresses", () => {
    expect(slugify("Über uns & Team!")).toBe("uber-uns-and-team");
    expect(slugProblem("about", customPages(site))).toMatch(/Another page/);
    expect(slugProblem("about", customPages(site), "page_about")).toBeNull();
    expect(slugProblem("admin", [])).toMatch(/already used by the site/);
    expect(slugProblem("Bad Slug", [])).toMatch(/lowercase/);
    expect(slugProblem("", [])).toMatch(/Add a web address/);
  });

  it("makes keys that are valid page keys", () => {
    const k = newPageKey();
    expect(isPageKey(k)).toBe(true);
    expect(isPageKey("home")).toBe(true);
    expect(isPageKey("page_Bad-1")).toBe(false);
    expect(isPageKey("insights")).toBe(false);
  });

  it("built-in pages can be renamed (admin name only)", () => {
    const named = allPages({ pages: { list: [], names: { home: "Front page", nope: "x" } } });
    expect(named.map((p) => p.title)).toEqual(["Front page"]);
    expect(allPages({ pages: { names: { home: "  " } } })[0]!.title).toBe("Homepage");
  });

  it("finds a free web address for a copy", () => {
    expect(uniqueSlug("About (copy)", [])).toBe("about-copy");
    expect(
      uniqueSlug("About (copy)", [
        { key: "page_a", title: "A", slug: "about-copy", published: false },
      ]),
    ).toBe("about-copy-2");
    expect(uniqueSlug("Admin", [])).toBe("admin-2");
    expect(uniqueSlug("!!!", [])).toBe("page");
  });
});

describe("seo", () => {
  it("the homepage is titled with the site name, as is, and described by its hero", () => {
    const s = pageSeo({ home: { intro: { title: "Welcome", summary: " Who we are. " } } }, "home", {
      title: "Homepage",
      path: "/",
    });
    expect([s.title, s.pageTitle, s.description, s.url]).toEqual([
      SITE_NAME,
      SITE_NAME,
      "Who we are.",
      `${SITE_URL}/`,
    ]);
    expect(s.custom).toEqual({ title: false, description: false, image: false });
    const renamed = pageSeo({ settings: { seo: { site_name: "Example Co" } } }, "home", {
      title: "Homepage",
      path: "/",
    });
    expect(renamed.title).toBe("Example Co");
  });

  it("other pages use their hero title, then their name, with the site ending", () => {
    const withHero = pageSeo(
      { page_about: { intro: { title: "About Us", summary: "Who we are." } } },
      "page_about",
      { title: "About", path: "/about" },
    );
    expect([withHero.title, withHero.description, withHero.url]).toEqual([
      `About Us — ${SITE_NAME}`,
      "Who we are.",
      `${SITE_URL}/about`,
    ]);
    const bare = pageSeo({}, "page_about", { title: "About", path: "/about" });
    expect([bare.pageTitle, bare.description]).toEqual(["About", ""]);
  });

  it("the title ending follows Settings → SEO", () => {
    expect(titleSuffix({})).toBe(` — ${SITE_NAME}`);
    expect(titleSuffix({ site_name: "Example Co" })).toBe(" — Example Co");
    expect(titleSuffix({ title_suffix: "  | Studio" })).toBe(" | Studio");
    const s = pageSeo({ settings: { seo: { title_suffix: "| Studio" } } }, "page_about", {
      title: "About",
      path: "/about",
    });
    expect(s.title).toBe("About | Studio");
  });

  it("page overrides win, including noindex and the share image", () => {
    const s = pageSeo(
      {
        page_about: {
          intro: { title: "About Us", summary: "Auto" },
          seo: { title: "Custom", description: "Typed", image: "/media/a.png", noindex: true },
        },
      },
      "page_about",
      { title: "About", path: "/about" },
    );
    expect([s.title, s.description, s.image, s.noindex]).toEqual([
      `Custom — ${SITE_NAME}`,
      "Typed",
      `${SITE_URL}/media/a.png`,
      true,
    ]);
    expect(s.custom).toEqual({ title: true, description: true, image: true });
    expect(s.auto.title).toBe("About Us");
    const home = pageSeo({ home: { seo: { title: "Example" } } }, "home", {
      title: "Homepage",
      path: "/",
    });
    expect(home.title).toBe("Example");
  });

  it("custom values win, blanks stay automatic, and the default share image applies", () => {
    const s = resolveSeo({
      fields: { title: "Custom", description: "  ", image: "" },
      auto: { title: "Auto", description: "Auto description" },
      settings: { default_image: "https://example.com/x.png" },
      path: "/p",
    });
    expect([s.pageTitle, s.description, s.image, s.noindex]).toEqual([
      "Custom",
      "Auto description",
      "https://example.com/x.png",
      false,
    ]);
    expect(s.custom.title).toBe(true);
    expect(s.custom.image).toBe(false);
    expect(readSeoFields({ noindex: "yes", title: 3 })).toEqual({
      title: "",
      description: "",
      image: "",
      noindex: false,
    });
  });

  it("makes uploaded media addresses absolute and leaves full ones alone", () => {
    expect(absoluteUrl("/media/x.png")).toBe(`${SITE_URL}/media/x.png`);
    expect(absoluteUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(absoluteUrl("")).toBe("");
  });

  it("builds every tag: canonical, social, robots, image and structured data", () => {
    const s = pageSeo(
      {
        page_about: {
          intro: { title: "About", summary: "Who we are." },
          seo: { image: "/media/c.jpg", noindex: true },
        },
      },
      "page_about",
      { title: "About", path: "/about" },
    );
    const head = seoHead(s, { jsonLd: organisationLd({}) });
    const meta = (k: string) =>
      head.meta.find((m) => m["name"] === k || m["property"] === k)?.["content"];
    expect(head.links).toEqual([{ rel: "canonical", href: `${SITE_URL}/about` }]);
    expect(head.meta[0]).toEqual({ title: `About — ${SITE_NAME}` });
    expect([
      meta("description"),
      meta("og:url"),
      meta("og:type"),
      meta("og:image"),
      meta("twitter:card"),
      meta("robots"),
    ]).toEqual([
      "Who we are.",
      `${SITE_URL}/about`,
      "website",
      `${SITE_URL}/media/c.jpg`,
      "summary_large_image",
      "noindex",
    ]);
    expect(head.scripts[0]!.type).toBe("application/ld+json");
    expect(JSON.parse(head.scripts[0]!.children)).toMatchObject({
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    });
  });

  it("leaves out robots, image tags and structured data when there are none", () => {
    const head = seoHead(pageSeo({}, "home", { title: "Homepage", path: "/" }));
    const names = head.meta.map((m) => m["name"] ?? m["property"]);
    expect(names).not.toContain("robots");
    expect(names).not.toContain("og:image");
    expect(head.meta.find((m) => m["name"] === "twitter:card")?.["content"]).toBe("summary");
    expect(head.scripts).toEqual([]);
  });
});
