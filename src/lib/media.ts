import { uploadMediaFile } from "@/data/media";

/** Browser-side image limits (spec section 2 → Media; site config later). */
const MAX_DIMENSION = 2400;
const QUALITY = 0.82;

/** Images we resize: raster formats a canvas can re-encode without losing anything that matters. */
const RESIZABLE = /^image\/(jpeg|png|webp)$/;

/**
 * Shrinks a large photo to MAX_DIMENSION on its longest side and re-encodes it (JPEG stays JPEG,
 * PNG and WebP become WebP so transparency survives). SVG, GIF and anything that isn't a raster
 * image upload unchanged, as do images already small enough. Workers can't run `sharp`, so this
 * keeps uploads small and free.
 */
async function prepare(file: File): Promise<{ file: File; width?: number; height?: number }> {
  if (!RESIZABLE.test(file.type) || typeof createImageBitmap !== "function") return { file };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file };
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return { file, width, height };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  if (!blob || blob.size >= file.size) return { file, width, height };
  const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/jpeg" ? ".jpg" : ".webp");
  return { file: new File([blob], name, { type }), width: w, height: h };
}

/**
 * Uploads to the site's media library and returns its stable address (`/media/…`).
 * `contentType` overrides the browser's guess (some browsers report an empty type for some files).
 */
export async function uploadMedia(file: File, opts?: { contentType?: string }): Promise<string> {
  const ready = await prepare(file);
  const form = new FormData();
  form.set("file", ready.file);
  if (opts?.contentType) form.set("contentType", opts.contentType);
  if (ready.width) form.set("width", String(ready.width));
  if (ready.height) form.set("height", String(ready.height));
  return (await uploadMediaFile({ data: form })).url;
}
