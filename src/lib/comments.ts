/**
 * Feedback comments left in the Content Studio (table `comments`). A thread is a first comment
 * (thread_id null, always "for" someone) plus its replies. Each thread is pinned to an `anchor`,
 * the address of what was clicked, and remembers where it was left (`opened_on`), so the
 * Feedback list can open it in place.
 *
 * Anchors use the canvas's own addresses:
 *   "home:intro.title" (text field)   "home:s1ab" (section)   "menu:<id>" / "menucol:<id>"
 *   "settings:footer_tagline"          "page:home" (the page as a whole)
 * Menus and the footer appear on every page, so their threads are pinned wherever they appear;
 * anything else only where the thread was left (`opened_on` = "page:<key>").
 */
import type { CommentRow } from "@/data/comments";
import type { PageKey } from "./page-sections";
import { isPageKey } from "./pages";

export type { CommentRow };
export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  approved: boolean;
};
export type Device = "desktop" | "tablet" | "mobile";
export type Thread = CommentRow & { replies: CommentRow[] };

export const DEVICES: Device[] = ["desktop", "tablet", "mobile"];

/** First comments with their replies (oldest first), newest thread first. */
export function groupThreads(rows: CommentRow[]): Thread[] {
  const replies = new Map<string, CommentRow[]>();
  for (const r of rows)
    if (r.thread_id) replies.set(r.thread_id, [...(replies.get(r.thread_id) ?? []), r]);
  return rows
    .filter((r) => !r.thread_id)
    .map((r) => ({
      ...r,
      replies: (replies.get(r.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const isOpen = (t: Pick<CommentRow, "resolved_at">) => !t.resolved_at;

/** Things that appear on every page (menus, footer). */
export function isSharedAnchor(anchor: string): boolean {
  return /^(menu|menucol|menus|settings):/.test(anchor);
}

/**
 * Open threads to show on a canvas: those left here, plus shared ones whose element is on this
 * canvas. `found` holds the anchors present on the canvas. Numbered in that order for the pins.
 */
export function canvasThreads(threads: Thread[], here: string, found: Record<string, string>) {
  return threads
    .filter(
      (t) => isOpen(t) && (t.opened_on === here || (isSharedAnchor(t.anchor) && t.anchor in found)),
    )
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((t, i) => ({
      ...t,
      n: i + 1,
      removed: !(t.anchor in found) && !t.anchor.startsWith("page:") && t.anchor !== here,
    }));
}

export const pageAnchor = (key: PageKey) => `page:${key}`;

/** Display name: first and last name, falling back to the email. */
export function profileName(
  p: Pick<Profile, "first_name" | "last_name" | "email"> | undefined | null,
): string {
  if (!p) return "Someone";
  const name = `${p.first_name} ${p.last_name}`.trim();
  return name || p.email || "Someone";
}

const PAGE_NAMES: Record<string, string> = { home: "Homepage" };

export type Place = { kind: "page"; key: PageKey; label: string };

/** Where a thread was left, as something the Feedback list can name and link to. */
export function parsePlace(
  openedOn: string,
  names: {
    /** Created pages' names, by key. */
    pages?: Record<string, string>;
  } = {},
): Place | null {
  const page = openedOn.match(/^page:(.+)$/);
  if (page && isPageKey(page[1]!)) {
    const key = page[1] as PageKey;
    return {
      kind: "page",
      key,
      label: PAGE_NAMES[key] ?? names.pages?.[key] ?? "A page that was deleted",
    };
  }
  return null;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} day${s < 86400 * 2 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Days left before a resolved thread is deleted (the daily clean-up removes it after 30 days). */
export function daysUntilRemoved(resolvedAt: string, now = Date.now()): number {
  return Math.max(0, 30 - Math.floor((now - new Date(resolvedAt).getTime()) / 86400000));
}

/** Search params that open a thread in place: `?comment=<id>`. */
export function commentSearch(s: Record<string, unknown>): {
  comment?: string | undefined;
  /** Carried over by the page switcher: the device view and comment mode. */
  device?: "tablet" | "mobile" | undefined;
  mode?: "comment" | undefined;
} {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const device = s["device"] === "tablet" || s["device"] === "mobile" ? s["device"] : undefined;
  return {
    comment: str(s["comment"]),
    device,
    mode: s["mode"] === "comment" ? "comment" : undefined,
  };
}

/**
 * Exactly where a comment was placed inside the element it's pinned to (column `position`):
 * `path` = child positions from the pinned element down to the element clicked (empty = the
 * pinned element itself); `x` / `y` = fractions across and down that element; `ax` / `ay` = the
 * same point as fractions of the pinned element, used if the inner element is no longer there.
 */
export type PinPosition = { path: number[]; x: number; y: number; ax: number; ay: number };

const frac = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;

/** Reads a stored position; anything malformed counts as none (the pin goes on the element's corner). */
export function parsePosition(v: unknown): PinPosition | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const path =
    Array.isArray(o["path"]) && o["path"].every((n) => Number.isInteger(n) && (n as number) >= 0)
      ? (o["path"] as number[])
      : null;
  const [x, y] = [frac(o["x"]), frac(o["y"])];
  if (!path || x === null || y === null) return null;
  return { path, x, y, ax: frac(o["ax"]) ?? x, ay: frac(o["ay"]) ?? y };
}
