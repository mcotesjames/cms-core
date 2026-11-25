/**
 * Uploaded interactive HTML files (the Interactive section). The file is fetched from its signed
 * media URL and shown in a srcdoc iframe; this normalises it first.
 *
 * Claude-artifact exports (and other AI/third-party exports) often have no doctype, <html>,
 * <head>, charset or viewport, so as-is they render in quirks mode, with the wrong text encoding
 * and a zoomed-out view on phones. Wrapping them fixes that. Satoshi is added either way so a file
 * can use the site's font by putting "Satoshi" first in its font stacks.
 */

/** The same Fontshare stylesheet the site loads in the root head. */
export const SATOSHI_CSS =
  "https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap";

const SATOSHI_LINK = `<link rel="stylesheet" href="${SATOSHI_CSS}">`;

/** Largest file the Studio accepts. */
export const MAX_INTERACTIVE_BYTES = 5 * 1024 * 1024;

/** Why a file can't be used as an interactive, or null when it can. */
export function interactiveFileProblem(file: { name: string; size: number }): string | null {
  if (!/\.html?$/i.test(file.name)) return "Choose an .html or .htm file.";
  if (file.size > MAX_INTERACTIVE_BYTES) return "That file is over 5 MB.";
  return null;
}

/** Makes an uploaded HTML file safe to drop into srcdoc as a complete standards-mode document. */
export function normaliseHtml(text: string): string {
  const src = text.replace(/^\uFEFF/, "");
  if (!/^\s*<!doctype/i.test(src)) {
    return (
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      SATOSHI_LINK +
      "</head><body>" +
      src +
      "</body></html>"
    );
  }
  // A full document: only add the font, before </head> (or after <head…> / <html…> if needed).
  if (/<\/head\s*>/i.test(src)) return src.replace(/<\/head\s*>/i, `${SATOSHI_LINK}$&`);
  if (/<head(\s[^>]*)?>/i.test(src)) return src.replace(/<head(\s[^>]*)?>/i, `$&${SATOSHI_LINK}`);
  if (/<html(\s[^>]*)?>/i.test(src))
    return src.replace(/<html(\s[^>]*)?>/i, `$&<head>${SATOSHI_LINK}</head>`);
  return src;
}

/** Fetches and normalises an interactive file. */
export async function loadInteractive(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normaliseHtml(await res.text());
}

/**
 * Opens a file in a new tab exactly as the site will show it (normalised), so a draft upload can
 * be checked before publishing. The tab is opened first so pop-up blockers allow it.
 */
export async function previewInteractive(url: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const html = await loadInteractive(url);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    if (tab) tab.location.href = blobUrl;
    else window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
