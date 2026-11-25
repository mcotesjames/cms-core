import { createFileRoute } from "@tanstack/react-router";
import { buildRobots } from "@/lib/sitemap";

/** /robots.txt, built from the site's address; staging blocks everything (spec section 5 → Page settings and SEO). */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { isProduction } = await import("@/data/env.server");
        return new Response(buildRobots(await isProduction()), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
