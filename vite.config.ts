import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

/**
 * Vite config for the site: TanStack Start (SSR + server functions), React, Tailwind, and for
 * builds Nitro's Cloudflare preset, which packages everything as a Worker in .output/ with a
 * wrangler.json generated from wrangler.jsonc (spec section 2).
 *
 * In `vite dev` there is no Worker: the data layer reaches a local D1 and R2 through Wrangler's
 * platform proxy (src/data/env.server.ts), so Nitro is only used for builds.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps TanStack Start's server entry with the SSR error page.
      server: { entry: "server" },
      // Server-only code must never reach the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    command === "build" &&
      nitro({
        preset: "cloudflare-module",
        cloudflare: { nodeCompat: true, deployConfig: true },
      }),
    viteReact(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: { port: 8080 },
}));
