/**
 * Edge cache for public responses (spec section 2 → Rendering). Server-only.
 *
 * The Worker's Cache API is per data centre, so deleting entries on Publish would only clear the
 * one data centre that handled the publish (a global purge needs Cloudflare's purge API, a zone
 * and a token per site). Instead, cached pages are keyed by a **content version**: the time live
 * site content last changed (`site_content.updated_at`, written only when live content changes:
 * Publish and Settings saves, never draft autosaves). Any change makes every data centre miss on
 * its next request, with no purge call. The version is one small D1 read, reused for 2 seconds
 * per Worker instance, so a publish is live everywhere within seconds.
 *
 * Media files (`/media/<key>`) never change at a key, so they're cached by address alone.
 */
import { max } from "drizzle-orm";

const VERSION_TTL_MS = 2000;
let memo: { version: string; at: number } | null = null;

/** When live site content last changed. */
export async function contentVersion(): Promise<string> {
  if (memo && Date.now() - memo.at < VERSION_TTL_MS) return memo.version;
  const { db } = await import("./db.server");
  const { siteContent } = await import("./schema");
  const [row] = await (await db()).select({ v: max(siteContent.updatedAt) }).from(siteContent);
  memo = { version: row?.v ?? "0", at: Date.now() };
  return memo.version;
}

/** Never cached: the Studio, server functions, sign-in (`/api`) and the Studio canvas (`?studio=1`). */
const PRIVATE = /^\/(admin|_serverFn|api|studio)(\/|$)/;

type Kind = "page" | "media";
export function cacheKind(request: Request): Kind | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (PRIVATE.test(url.pathname) || url.searchParams.has("studio")) return null;
  return url.pathname.startsWith("/media/") ? "media" : "page";
}

type Ctx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;

/**
 * Serves a public GET from the edge cache, or renders it and stores it. Pages are stored under
 * their path (query strings ignored: public pages don't read them) plus the content version.
 * Only complete 200 responses without cookies are stored.
 */
export async function withEdgeCache(
  request: Request,
  ctx: unknown,
  render: () => Promise<Response>,
): Promise<Response> {
  const kind = cacheKind(request);
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!kind || !cache) return render();

  const url = new URL(request.url);
  const version = kind === "page" ? await contentVersion() : "";
  const key =
    kind === "media"
      ? new Request(`${url.origin}${url.pathname}`)
      : new Request(`${url.origin}${url.pathname}?__v=${encodeURIComponent(version)}`);

  const hit = await cache.match(key);
  if (hit) return forVisitor(hit, kind, `HIT ${version}`.trim());

  const response = await render();
  const cacheable =
    response.status === 200 && !response.headers.has("set-cookie") && response.body !== null;
  if (!cacheable) return response;

  // The stored copy lives as long as its key is current; visitors' browsers always revalidate
  // pages with the edge (media is immutable, so browsers keep it too).
  const stored = new Response(response.clone().body, response);
  if (kind === "page") stored.headers.set("cache-control", "public, max-age=31536000");
  const put = cache.put(key, stored);
  const waitUntil = (ctx as Ctx)?.waitUntil;
  if (waitUntil) waitUntil.call(ctx, put);
  else await put;

  return forVisitor(response, kind, `MISS ${version}`.trim());
}

/**
 * The response as sent to the browser: pages always revalidate with the edge (the stored copy's
 * long lifetime is only for the edge), media keeps its immutable caching. `x-edge-cache` says
 * HIT or MISS, with the content version for pages.
 */
function forVisitor(response: Response, kind: Kind, status: string): Response {
  const out = new Response(response.body, response);
  out.headers.set("x-edge-cache", status);
  if (kind === "page") out.headers.set("cache-control", "public, max-age=0, must-revalidate");
  return out;
}
