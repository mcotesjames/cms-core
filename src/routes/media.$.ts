import { createFileRoute } from "@tanstack/react-router";

/** Uploaded media at a stable public address: /media/<key> (spec section 2 → Media). */
export const Route = createFileRoute("/media/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { mediaResponse } = await import("@/data/media.server");
        return mediaResponse(params._splat ?? "", request);
      },
    },
  },
});
