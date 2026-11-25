import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/**
 * Uploads to the shared private media library and returns a long-lived signed URL.
 * `contentType` overrides the browser's guess (e.g. "text/html" for interactive files, which
 * some browsers report as empty).
 */
export async function uploadMedia(file: File, opts?: { contentType?: string }): Promise<string> {
  const path = `library/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, opts?.contentType ? { contentType: opts.contentType } : undefined);
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (e2) throw e2;
  return data.signedUrl;
}

export async function signMedia(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from("media").createSignedUrls(paths, TEN_YEARS);
  if (error) throw error;
  return Object.fromEntries(
    data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])),
  );
}
