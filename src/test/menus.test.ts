import { describe, expect, it } from "vitest";
import { NAV_LINKS } from "@/components/SiteChrome";
import {
  addColumn,
  defaultMenus,
  findLink,
  move,
  resolveLink,
  resolveMenus,
  setButton,
  updateLink,
  MAX_FOOTER_COLUMNS,
} from "@/lib/menus";

const settings = {
  substack_url: "https://example.substack.com/",
  contact_email: "info@example.com",
};
const ctx = {
  posts: [{ id: "p1", slug: "semis" }],
  site: { home: { sections: ["intro", "pillars", "what", "bio"] } },
};

describe("menus", () => {
  it("keeps missing settings from creating invalid external destinations", () => {
    for (const settings of [undefined, null]) {
      const menus = resolveMenus(undefined, settings);
      const substack = menus.main.find((link) => link.button);
      expect(substack?.target).toEqual({ kind: "url", url: "" });
      if (!substack) throw new Error("Missing default external link");
      expect(resolveLink(substack.target, ctx).pending).toBe(true);
    }
  });
  it("defaults reproduce the menus as they were hardcoded", () => {
    const m = defaultMenus(settings);
    expect(m.main.filter((l) => !l.button).map((l) => l.label)).toEqual(
      NAV_LINKS.map((l) => l.label),
    );
    expect(m.main.find((l) => l.button)).toMatchObject({
      label: "Substack",
      target: { kind: "url", url: settings.substack_url },
    });
    expect(m.footer.map((c) => c.heading)).toEqual(["Explore", "Connect", "Contact"]);
    expect(m.footer[0]!.links.map((l) => resolveLink(l.target, ctx).href)).toEqual([
      "/#section-pillars",
      "/#section-what",
      "/#section-bio",
      "/insights",
      "/investments",
    ]);
    expect(resolveLink(m.footer[1]!.links[0]!.target, ctx).pending).toBe(true); // LinkedIn, no address yet
    expect(resolveLink(m.footer[2]!.links[0]!.target, ctx).href).toBe("mailto:info@example.com");
  });

  it("uses stored menus once they exist", () => {
    const stored = { main: [], footer: [] };
    expect(resolveMenus(stored, settings)).toBe(stored);
    expect(resolveMenus({}, settings).main.length).toBe(4);
  });

  it("flags links whose target has gone", () => {
    expect(resolveLink({ kind: "insight", id: "p1" }, ctx)).toMatchObject({
      href: "/insights/semis",
      broken: null,
    });
    expect(resolveLink({ kind: "insight", id: "gone" }, ctx).broken).toBeTruthy();
    expect(
      resolveLink({ kind: "section", page: "home", section: "removed" }, ctx).broken,
    ).toBeTruthy();
    expect(resolveLink({ kind: "email", email: "" }, ctx).broken).toBeTruthy();
  });

  it("only one main-menu link can be the button", () => {
    const m = defaultMenus(settings).main;
    const next = setButton(m, "m-insights", true);
    expect(next.filter((l) => l.button).map((l) => l.id)).toEqual(["m-insights"]);
  });

  it("allows at most three footer columns", () => {
    const m = defaultMenus(settings);
    expect(m.footer.length).toBe(MAX_FOOTER_COLUMNS);
    expect(addColumn(m, "x")).toBeNull();
    expect(addColumn({ ...m, footer: m.footer.slice(0, 2) }, "x")!.footer.length).toBe(3);
  });

  it("edits, moves and deletes links wherever they are", () => {
    const m = defaultMenus(settings);
    const renamed = updateLink(m, "f-what", (l) => ({ ...l, label: "Our work" }));
    expect(findLink(renamed, "f-what")!.link.label).toBe("Our work");
    expect(findLink(renamed, "f-what")!.column!.heading).toBe("Explore");
    expect(
      findLink(
        updateLink(m, "m-insights", () => null),
        "m-insights",
      ),
    ).toBeNull();
    expect(
      move(m.main, "m-insights", -1)!
        .map((l) => l.id)
        .slice(0, 3),
    ).toEqual(["m-investments", "m-insights", "m-publications"]);
  });
});
