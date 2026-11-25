/** Reads a media file from R2 for the public `/media/<key>` route. Server-only. */
import { bindings } from "./env.server";

/** One year: keys are unique per upload (timestamped), so a file at a key never changes. */
const CACHE = "public, max-age=31536000, immutable";

export async function mediaResponse(key: string, request: Request): Promise<Response> {
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });
  const bucket = (await bindings()).MEDIA;
  const etag = request.headers.get("if-none-match");
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  if (etag && etag === object.httpEtag) {
    await object.body?.cancel();
    return new Response(null, {
      status: 304,
      headers: { etag: object.httpEtag, "cache-control": CACHE },
    });
  }
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "content-length": String(object.size),
    etag: object.httpEtag,
    "cache-control": CACHE,
    "x-content-type-options": "nosniff",
  });
  return new Response(object.body as unknown as BodyInit, { headers });
}
