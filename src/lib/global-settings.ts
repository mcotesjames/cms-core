/**
 * Global settings (spec: Core scope → Global settings): site-wide values in the site_content row
 * "settings", edited on Settings → Global settings in tabs, with draft + Publish like all content.
 *
 * Platform groups exist on every site (footer, contact, brand, banner, SEO). A site declares its
 * own groups in site.config.ts `settings` (e.g. contact details, social links); each becomes a tab
 * and is stored under its key: settings.<group>.<field>.
 */
import type { FieldDef } from "./fields";
import { site } from "./site";

export type SettingsField = FieldDef & { path: string };
export type SettingsGroup = { key: string; title: string; note?: string; fields: SettingsField[] };

export { RESERVED_SETTINGS_KEYS } from "./site-config";

const PLATFORM_GROUPS: SettingsGroup[] = [
  {
    key: "general",
    title: "General",
    fields: [
      {
        path: "contact_email",
        name: "contact_email",
        label: "Contact email",
        help: "Used by the footer menu's default Contact link.",
        type: "text",
      },
    ],
  },
  {
    key: "brand",
    title: "Logo & icon",
    note: "Leave the logo empty to show the site name as text.",
    fields: [
      {
        path: "brand.logo",
        name: "logo",
        label: "Logo",
        type: "image",
        alt: "logo_alt",
        decorative: true,
      },
      { path: "brand.logo_alt", name: "logo_alt", label: "Logo description", type: "text" },
      {
        path: "brand.favicon",
        name: "favicon",
        label: "Browser icon (favicon)",
        help: "A square image, at least 64 × 64 pixels (PNG or SVG).",
        type: "image",
      },
    ],
  },
  {
    key: "banner",
    title: "Announcement",
    note: "A bar across the top of every page, e.g. holiday opening hours. It shows while it's on and between its start and end, if set.",
    fields: [
      { path: "banner.on", name: "on", label: "Show the announcement", type: "boolean" },
      { path: "banner.text", name: "text", label: "Text", type: "text", maxLength: 140 },
      { path: "banner.link", name: "link", label: "Links to (optional)", type: "link" },
      {
        path: "banner.starts",
        name: "starts",
        label: "Starts",
        help: "Optional. Site time.",
        type: "date",
        time: true,
      },
      {
        path: "banner.ends",
        name: "ends",
        label: "Ends",
        help: "Optional. Site time.",
        type: "date",
        time: true,
      },
    ],
  },
  {
    key: "footer",
    title: "Footer",
    fields: [
      { path: "footer_heading", name: "footer_heading", label: "Heading", type: "text" },
      { path: "footer_tagline", name: "footer_tagline", label: "Text", type: "longText" },
    ],
  },
  {
    key: "seo",
    title: "Search & sharing",
    note: 'Used on every page unless a page sets its own (Page settings in the editor). Leave blank for the defaults: the site name and "— <site name>" after each page\'s title.',
    fields: [
      { path: "seo.site_name", name: "site_name", label: "Site name", type: "text" },
      {
        path: "seo.title_suffix",
        name: "title_suffix",
        label: "Title ending",
        help: "Added after each page's title.",
        type: "text",
      },
      {
        path: "seo.default_image",
        name: "default_image",
        label: "Default share image",
        help: "1200 × 630 pixels.",
        type: "image",
      },
    ],
  },
];

/** Every tab on Global settings: the platform's groups, then the site's own. */
export function settingsGroups(): SettingsGroup[] {
  const own = Object.entries(site.settings ?? {}).map(([key, g]) => ({
    key,
    title: g.label,
    ...(g.note ? { note: g.note } : {}),
    fields: g.fields.map((f) => ({ ...f, path: `${key}.${f.name}` })),
  }));
  return [...PLATFORM_GROUPS, ...own];
}

/** A site-declared group's values from the settings row (live, or the draft in the canvas). */
export function siteSettings(settings: unknown, group: string): Record<string, unknown> {
  const v = (settings as Record<string, unknown> | null | undefined)?.[group];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// ---- Brand ----

export type Brand = { logo: string; logoAlt: string; favicon: string };

export function readBrand(settings: unknown): Brand {
  const b = siteSettings(settings, "brand");
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  return { logo: s("logo"), logoAlt: s("logo_alt"), favicon: s("favicon") };
}

// ---- Announcement banner ----

export type Banner = {
  on: boolean;
  text: string;
  link: unknown;
  starts: string;
  ends: string;
};

export function readBanner(settings: unknown): Banner {
  const b = siteSettings(settings, "banner");
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  return {
    on: b["on"] === true,
    text: s("text"),
    link: b["link"] ?? null,
    starts: s("starts"),
    ends: s("ends"),
  };
}

/** The site's time zone, for announcement start and end times (site.config.ts `timeZone`). */
export const SITE_TIME_ZONE = site.timeZone ?? "Europe/London";

/**
 * A "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" time in the site's time zone, as a UTC timestamp (ms).
 * Dates alone mean the start of that day.
 */
export function siteTimeToUtc(local: string, timeZone = SITE_TIME_ZONE): number | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0"] = m.slice(1).map((x) => x ?? "0");
  const asUtc = Date.UTC(+y!, +mo! - 1, +d!, +h, +mi);
  // The zone's offset at that moment: format the UTC guess in the zone and compare.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const zoned = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return asUtc - (zoned - asUtc);
}

/** Whether the announcement shows at `now` (on, has text, and inside its start / end). */
export function bannerLive(b: Banner, now = Date.now()): boolean {
  if (!b.on || !b.text) return false;
  const start = b.starts ? siteTimeToUtc(b.starts) : null;
  const end = b.ends ? siteTimeToUtc(b.ends) : null;
  if (start !== null && now < start) return false;
  if (end !== null && now >= end) return false;
  return true;
}
