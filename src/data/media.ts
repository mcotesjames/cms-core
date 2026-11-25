/**
 * The media library (spec section 2 → Media): files in the site's R2 bucket, one `media` row
 * each, served at the stable public address `/media/<key>` (routes/media.$.ts). No expiring
 * links. Images arrive already resized by the browser (lib/media.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { asEditor } from "./access";

export const MEDIA_PREFIX = "/media/";
export const mediaUrl = (key: string) => `${MEDIA_PREFIX}${key}`;

/** Largest file accepted (R2 itself allows far more; this keeps pages light). */
const MAX_BYTES = 25 * 1024 * 1024;

export type MediaItem = {
  id: string;
  key: string;
  url: string;
  filename: string;
  mime: string;
  bytes: number;
  created_at: string;
};

/** Uploads one file (FormData: `file`, optional `contentType`, `width`, `height`). */
export const uploadMediaFile = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected a file upload.");
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("No file was sent.");
    if (file.size > MAX_BYTES) throw new Error("That file is larger than 25 MB.");
    const num = (k: string) => {
      const v = Number(data.get(k));
      return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
    };
    const type = data.get("contentType");
    return {
      file,
      contentType: (typeof type === "string" && type) || file.type || "application/octet-stream",
      width: num("width"),
      height: num("height"),
    };
  })
  .handler(async ({ data, context }): Promise<{ url: string; key: string }> => {
    const { bindings } = await import("./env.server");
    const { db, newId } = await import("./db.server");
    const { media } = await import("./schema");
    const safe = data.file.name.replace(/[^a-z0-9.]+/gi, "-").replace(/^-+|-+$/g, "") || "file";
    const key = `library/${Date.now()}-${safe}`;
    await (
      await bindings()
    ).MEDIA.put(key, await data.file.arrayBuffer(), {
      httpMetadata: { contentType: data.contentType },
    });
    await (await db()).insert(media).values({
      id: newId(),
      key,
      filename: data.file.name,
      mime: data.contentType,
      bytes: data.file.size,
      width: data.width,
      height: data.height,
      uploadedBy: context.user.id,
    });
    return { url: mediaUrl(key), key };
  });

/** Every file in the library, newest first. */
export const listMedia = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .handler(async (): Promise<MediaItem[]> => {
    const { db } = await import("./db.server");
    const { media } = await import("./schema");
    const rows = await (await db()).select().from(media).orderBy(desc(media.createdAt));
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      url: mediaUrl(r.key),
      filename: r.filename,
      mime: r.mime,
      bytes: r.bytes,
      created_at: r.createdAt,
    }));
  });
