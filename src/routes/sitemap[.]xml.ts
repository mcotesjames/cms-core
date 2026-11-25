import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { buildSitemap, readSitemapRows } from "@/lib/sitemap";

/**
 * /sitemap.xml, built from the live content on every request: the built-in pages, published
 * created pages, and published insights — leaving out anything hidden from search engines.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [rows, posts] = await Promise.all([
            readSitemapRows((from, to) =>
              supabase.from("site_content").select("key, content").order("key").range(from, to),
            ),
            readSitemapRows((from, to) =>
              supabase
                .from("posts")
                .select("slug, published, published_at, seo")
                .eq("published", true)
                .order("id")
                .range(from, to),
            ),
          ]);
          return new Response(buildSitemap(rows, posts), {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: { "cache-control": "no-store", "retry-after": "60" },
          });
        }
      },
    },
  },
});
