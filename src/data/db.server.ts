/** The Drizzle client over the site's D1 database. Server-only; only `src/data/` uses it. */
import { drizzle } from "drizzle-orm/d1";
import { bindings } from "./env.server";
import * as schema from "./schema";

export async function db() {
  return drizzle((await bindings()).DB, { schema });
}

export type Db = Awaited<ReturnType<typeof db>>;

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
