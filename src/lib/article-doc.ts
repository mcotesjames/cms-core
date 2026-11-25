import type { SeoFields } from "./seo";
import type { ArticleModule } from "@/lib/modules";

export type PostDoc = {
  title: string;
  slug: string;
  excerpt: string;
  cover_url: string;
  author: string;
  published_at: string | null;
  modules: ArticleModule[];
  /** Search & sharing overrides (column `seo`); empty values are automatic (lib/seo.ts). */
  seo?: SeoFields | null;
};

/** Publishing rules: a title, web address, cover image and first paragraph are required. */
export function articleProblems(d: PostDoc): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("Add a title.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug))
    out.push("Set a web address using lowercase letters, numbers and dashes.");
  if (!d.cover_url.trim()) out.push("Add a cover image.");
  const first = d.modules[0];
  if (!first || first.type !== "rich_text" || !first.body.trim())
    out.push("Write the first paragraph.");
  return out;
}
