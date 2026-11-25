import { createFileRoute } from "@tanstack/react-router";
import { buildRobots } from "@/lib/sitemap";

/** /robots.txt, built from the site's address (spec section 5 → Page settings and SEO). */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildRobots(), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
