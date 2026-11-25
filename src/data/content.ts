/**
 * Public reads of live content: what visitors see. Every function here is `asVisitor` and reads
 * only live columns, never `draft`.
 */
import { createServerFn } from "@tanstack/react-start";
import { asVisitor } from "./access";
import type { JsonObject } from "./shapes";

/** Live content of every site_content row, keyed by row (`home`, `settings`, `page_…`). */
export const getSiteContent = createServerFn({ method: "GET" })
  .middleware([asVisitor])
  .handler(async (): Promise<Record<string, JsonObject>> => {
    const { db } = await import("./db.server");
    const { siteContent } = await import("./schema");
    const rows = await (
      await db()
    )
      .select({ key: siteContent.key, data: siteContent.data })
      .from(siteContent);
    return Object.fromEntries(rows.map((r) => [r.key, r.data]));
  });
