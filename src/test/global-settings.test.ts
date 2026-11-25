import { describe, expect, it } from "vitest";
import {
  bannerLive,
  readBanner,
  readBrand,
  settingsGroups,
  siteSettings,
  siteTimeToUtc,
} from "@/lib/global-settings";
import { validateSite } from "@/lib/site-config";
import { checkFieldDefs } from "@/lib/fields";

const banner = (b: Record<string, unknown>) =>
  readBanner({ banner: { on: true, text: "Hi", ...b } });

describe("global settings", () => {
  it("are tabs: the platform's groups, then the site's own", () => {
    const keys = settingsGroups().map((g) => g.key);
    expect(keys.slice(0, 5)).toEqual(["general", "brand", "banner", "footer", "seo"]);
    expect(keys).toContain("contact");
    expect(settingsGroups().find((g) => g.key === "contact")!.fields[0]!.path).toBe(
      "contact.phone",
    );
    for (const g of settingsGroups()) expect(checkFieldDefs(g.fields, g.key)).toEqual([]);
  });

  it("read a site group's values, and the logo and favicon", () => {
    expect(siteSettings({ contact: { phone: "1" } }, "contact")).toEqual({ phone: "1" });
    expect(siteSettings(null, "contact")).toEqual({});
    expect(readBrand({ brand: { logo: " /media/l.svg ", favicon: "" } })).toEqual({
      logo: "/media/l.svg",
      logoAlt: "",
      favicon: "",
    });
  });

  it("refuse site groups that reuse platform keys, and unknown time zones", () => {
    const base = { name: "X", url: "https://x.com" };
    const group = { label: "G", fields: [{ name: "a", label: "A", type: "text" as const }] };
    expect(() => validateSite({ ...base, settings: { banner: group } })).toThrow(
      /used by the platform/,
    );
    expect(() => validateSite({ ...base, settings: { social: group } })).not.toThrow();
    expect(() => validateSite({ ...base, timeZone: "Mars/Olympus" })).toThrow(/time zone/);
  });
});

describe("the announcement", () => {
  const at = (iso: string) => Date.parse(iso);

  it("shows only while on, with text, inside its start and end", () => {
    expect(bannerLive(banner({}))).toBe(true);
    expect(bannerLive(banner({ on: false }))).toBe(false);
    expect(bannerLive(banner({ text: "" }))).toBe(false);
    const b = banner({ starts: "2026-12-24T09:00", ends: "2026-12-27" });
    // London is on GMT in December, so site time equals UTC.
    expect(bannerLive(b, at("2026-12-24T08:59:00Z"))).toBe(false);
    expect(bannerLive(b, at("2026-12-24T09:00:00Z"))).toBe(true);
    expect(bannerLive(b, at("2026-12-26T23:59:00Z"))).toBe(true);
    expect(bannerLive(b, at("2026-12-27T00:00:00Z"))).toBe(false);
  });

  it("reads start and end times in the site's time zone (summer time included)", () => {
    expect(siteTimeToUtc("2026-07-01T09:00", "Europe/London")).toBe(at("2026-07-01T08:00:00Z"));
    expect(siteTimeToUtc("2026-01-01T09:00", "Europe/London")).toBe(at("2026-01-01T09:00:00Z"));
    expect(siteTimeToUtc("2026-07-01", "America/New_York")).toBe(at("2026-07-01T04:00:00Z"));
    expect(siteTimeToUtc("not a date")).toBeNull();
  });
});
