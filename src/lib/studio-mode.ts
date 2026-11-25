import type { PinPosition } from "./comments";
import { useSyncExternalStore } from "react";

/** True only in the browser when the page is shown inside the Content Studio canvas. */
export function isStudioFrame(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.parent !== window && new URLSearchParams(window.location.search).get("studio") === "1"
  );
}

export function useStudioMode(): boolean {
  return useSyncExternalStore(
    () => () => {},
    isStudioFrame,
    () => false,
  );
}

export type StudioMessage =
  | { type: "studio-ready" }
  | { type: "studio-edit"; field: string; value: string }
  | { type: "studio-image"; field: string }
  /** Draft page, settings and menus content to show. */
  | {
      type: "studio-content";
      content: Record<string, unknown>;
    }
  /** section is a "key:name" address (e.g. home:hero); field is set when a text was clicked; item when a menu link or column ("menu:<id>") was clicked. */
  | {
      type: "studio-select";
      section: string | null;
      field?: string | undefined;
      item?: string | undefined;
    }
  | { type: "studio-move"; section: string; dir: -1 | 1 }
  /** "+" on a block: add a new block after it. */
  | { type: "studio-insert"; section: string }
  /** Highlights the selected section and item; scroll brings the item into view (after adding it from the panel). */
  | {
      type: "studio-selected";
      section: string | null;
      item?: string | null | undefined;
      scroll?: boolean | undefined;
    }
  /**
   * Comment mode. While on, clicks start a comment instead of editing, and the open threads show
   * as numbered pins (never while off). `check` lists the anchors to look for on the canvas;
   * `scrollTo` brings one thread into view (its exact spot when it has one); the canvas keeps
   * trying until the element is on the page, then answers with `studio-scrolled`.
   */
  | {
      type: "studio-comments";
      on: boolean;
      pins: Array<{
        id: string;
        anchor: string;
        n: number;
        active: boolean;
        position: PinPosition | null;
      }>;
      check: string[];
      scrollTo?: { id: string; anchor: string; position: PinPosition | null } | null | undefined;
    }
  /** Comment mode: something was clicked; `anchor` is its address, `label` a short description, `position` the exact spot. */
  | { type: "studio-comment-at"; anchor: string; label: string; position: PinPosition | null }
  /** A keyboard shortcut pressed inside the canvas, for the editor (Cmd/Ctrl+K: page switcher). */
  | { type: "studio-shortcut"; key: "switcher" }
  /** The canvas has scrolled a thread into view (answer to `scrollTo`). */
  | { type: "studio-scrolled"; id: string }
  /** Comment mode: a pin was clicked. */
  | { type: "studio-pin"; id: string }
  /**
   * Which of the checked anchors are on the canvas (with a short label each); `pinLabels` describe
   * the exact element each placed pin is on; `hidden` = pins whose element is currently hidden
   * (e.g. in a closed accordion), drawn hollow on the nearest visible part.
   */
  | {
      type: "studio-anchors";
      found: Record<string, string>;
      pinLabels: Record<string, string>;
      hidden: string[];
    };

/** Splits a "key:path.to.field" CMS address. */
export function parseField(field: string): { key: string; path: string } | null {
  const m = field.match(/^([a-z_]+):([a-z0-9_.]+)$/i);
  return m ? { key: m[1]!, path: m[2]! } : null;
}

/** Moves one section within the page order; returns null when it can't move that way. */
export function moveSection(order: string[], name: string, dir: -1 | 1): string[] | null {
  const i = order.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return null;
  const n = [...order];
  [n[i], n[j]] = [n[j]!, n[i]!];
  return n;
}

/**
 * Route `ssr` option for pages that open in the Content Studio canvas (`?studio=1`): there the
 * server only loads the data and the page is drawn in the browser, because the editor's drafts
 * can arrive while the page is still starting up, and server-drawn HTML would then not match
 * (React logs a hydration error and redraws). Visitors always get the fully server-drawn page.
 */
export function canvasSsr({ location }: { location: { searchStr: string } }): true | "data-only" {
  return new URLSearchParams(location.searchStr).get("studio") === "1" ? "data-only" : true;
}
