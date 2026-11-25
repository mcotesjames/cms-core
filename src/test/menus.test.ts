import { describe, expect, it } from "vitest";
import {
  addColumn,
  blankTarget,
  defaultMenus,
  findLink,
  move,
  parseMenuItem,
  resolveLink,
  resolveMenus,
  sectionAnchor,
  setButton,
  updateLink,
  MAX_FOOTER_COLUMNS,
  type Menus,
} from "@/lib/menus";

const settings = { contact_email: "info@example.com" };
const ctx = {
  site: {
    home: { sections: ["s1", "s2"] },
    pages: {
      list: [
        { key: "page_about", title: "About", slug: "about", published: true },
        { key: "page_draft", title: "Draft", slug: "draft", published: false },
      ],
    },
    page_about: { sections: ["t1"] },
  },
};

const sample: Menus = {
  main: [
    { id: "m-home", label: "Home", target: { kind: "page", page: "home" } },
    { id: "m-about", label: "About", target: { kind: "page", page: "page_about" } },
    { id: "m-news", label: "News", target: { kind: "url", url: "https://example.com" } },
  ],
  footer: [
    {
      id: "c1",
      heading: "Explore",
      links: [
        { id: "f-s1", label: "Intro", target: { kind: "section", page: "home", section: "s1" } },
      ],
    },
  ],
};

describe("menus", () => {
  it("defaults to Home in the main menu and a Contact column in the footer", () => {
    const m = defaultMenus(settings);
    expect(m.main).toEqual([
      { id: "m-home", label: "Home", target: { kind: "page", page: "home" } },
    ]);
    expect(m.footer.map((c) => c.heading)).toEqual(["Contact"]);
    expect(resolveLink(m.footer[0]!.links[0]!.target, ctx).href).toBe("mailto:info@example.com");
    expect(resolveLink(m.main[0]!.target, ctx)).toMatchObject({
      href: "/",
      internal: true,
      broken: null,
    });
  });

  it("a missing contact email leaves the default email link flagged, not invalid", () => {
    for (const s of [undefined, null, {}]) {
      const link = resolveMenus(undefined, s).footer[0]!.links[0]!;
      expect(link.target).toEqual({ kind: "email", email: "" });
      expect(resolveLink(link.target, ctx).broken).toBeTruthy();
    }
  });

  it("uses stored menus once they exist", () => {
    const stored = { main: [], footer: [] };
    expect(resolveMenus(stored, settings)).toBe(stored);
    expect(resolveMenus({}, settings).main.length).toBe(1);
    expect(resolveMenus({ main: [] }, settings).footer.length).toBe(1);
  });

  it("resolves page links, and flags unpublished or deleted pages", () => {
    expect(resolveLink({ kind: "page", page: "page_about" }, ctx)).toMatchObject({
      href: "/about",
      internal: true,
      broken: null,
    });
    expect(resolveLink({ kind: "page", page: "page_draft" }, ctx).broken).toMatch(/published/);
    expect(resolveLink({ kind: "page", page: "page_gone" }, ctx).broken).toMatch(/no longer/);
  });

  it("section links point at the section's anchor and break when it's removed", () => {
    expect(sectionAnchor("s1")).toBe("section-s1");
    expect(resolveLink({ kind: "section", page: "home", section: "s2" }, ctx)).toMatchObject({
      href: "/#section-s2",
      broken: null,
    });
    expect(resolveLink({ kind: "section", page: "page_about", section: "t1" }, ctx)).toMatchObject({
      href: "/about#section-t1",
      broken: null,
    });
    expect(
      resolveLink({ kind: "section", page: "home", section: "removed" }, ctx).broken,
    ).toBeTruthy();
    expect(resolveLink({ kind: "section", page: "page_draft", section: "x" }, ctx).broken).toMatch(
      /published/,
    );
  });

  it("external links open in a new tab; empty ones are pending; empty emails are broken", () => {
    expect(resolveLink({ kind: "url", url: " https://example.com " }, ctx)).toMatchObject({
      href: "https://example.com",
      external: true,
      pending: false,
    });
    expect(resolveLink({ kind: "url", url: "" }, ctx)).toMatchObject({
      href: "",
      pending: true,
      broken: null,
    });
    expect(resolveLink({ kind: "email", email: "" }, ctx).broken).toBeTruthy();
  });

  it("switching a link's kind gives a blank target of that kind", () => {
    expect(blankTarget("page")).toEqual({ kind: "page", page: "home" });
    expect(blankTarget("section")).toEqual({ kind: "section", page: "home", section: "" });
    expect(blankTarget("url")).toEqual({ kind: "url", url: "" });
    expect(blankTarget("email")).toEqual({ kind: "email", email: "" });
  });

  it("only one main-menu link can be the button", () => {
    const once = setButton(sample.main, "m-news", true);
    const next = setButton(once, "m-about", true);
    expect(next.filter((l) => l.button).map((l) => l.id)).toEqual(["m-about"]);
    expect(setButton(next, "m-about", false).some((l) => l.button)).toBe(false);
  });

  it("allows at most three footer columns", () => {
    expect(MAX_FOOTER_COLUMNS).toBe(3);
    const two = addColumn(sample, "c2")!;
    const three = addColumn(two, "c3")!;
    expect(three.footer.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(addColumn(three, "c4")).toBeNull();
  });

  it("edits, moves and deletes links wherever they are", () => {
    const renamed = updateLink(sample, "f-s1", (l) => ({ ...l, label: "Our work" }));
    expect(findLink(renamed, "f-s1")!.link.label).toBe("Our work");
    expect(findLink(renamed, "f-s1")!.column!.heading).toBe("Explore");
    expect(findLink(renamed, "m-home")!.column).toBeNull();
    expect(
      findLink(
        updateLink(sample, "m-about", () => null),
        "m-about",
      ),
    ).toBeNull();
    expect(move(sample.main, "m-about", -1)!.map((l) => l.id)).toEqual([
      "m-about",
      "m-home",
      "m-news",
    ]);
    expect(move(sample.main, "m-news", 1)).toBeNull();
  });

  it("parses canvas item addresses", () => {
    expect(parseMenuItem("menu:m-home")).toEqual({ kind: "link", id: "m-home" });
    expect(parseMenuItem("menucol:c1")).toEqual({ kind: "column", id: "c1" });
    expect(parseMenuItem("home:intro.title")).toBeNull();
    expect(parseMenuItem(null)).toBeNull();
  });
});
