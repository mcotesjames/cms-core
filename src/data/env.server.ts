/**
 * The site's Cloudflare bindings (D1 `DB`, R2 `MEDIA`). Server-only; only `src/data/` uses it.
 *
 * Deployed, Nitro's Cloudflare handler puts the Worker's `env` on `globalThis.__env__`.
 * In `vite dev` there is no Worker, so Wrangler's platform proxy provides a local D1 and R2
 * (persisted under .wrangler/state, the same place `npm run db:migrate` / `db:seed` write to).
 */
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type Bindings = {
  DB: D1Database;
  MEDIA: R2Bucket;
  /** "production" lets search engines in; anything else (staging, dev) keeps them out. */
  SITE_ENV?: string;
};

let devProxy: Promise<{ env: Bindings }> | undefined;

export async function bindings(): Promise<Bindings> {
  if (import.meta.env.DEV) {
    devProxy ??= (async () => {
      // Kept out of the Worker bundle: `import.meta.env.DEV` is false there, so this whole branch
      // is dropped, and the variable specifier stops Vite from following it in dev.
      const pkg = "wrangler";
      const { getPlatformProxy } = (await import(
        /* @vite-ignore */ pkg
      )) as typeof import("wrangler");
      return getPlatformProxy<Bindings>({ persist: { path: ".wrangler/state/v3" } });
    })();
    return (await devProxy).env;
  }
  const env = (globalThis as { __env__?: Bindings }).__env__;
  if (!env?.DB) throw new Error("The DB binding is missing: check wrangler.jsonc.");
  return env;
}

/** True only on the production site: everywhere else asks search engines not to index. */
export async function isProduction(): Promise<boolean> {
  return (await bindings()).SITE_ENV === "production";
}
