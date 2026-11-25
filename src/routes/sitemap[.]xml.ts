import { createFileRoute } from "@tanstack/react-router";
import { getSiteContent } from "@/data/content";
import { buildSitemap } from "@/lib/sitemap";

/**
 * /sitemap.xml, built from the live content on every request: the built-in pages and published
 * created pages, leaving out anything hidden from search engines.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const site = await getSiteContent();
          const rows = Object.entries(site)
            .map(([key, content]) => ({ key, content }))
            .sort((a, b) => a.key.localeCompare(b.key));
          return new Response(buildSitemap(rows), {
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
