import { createFileRoute, Link } from "@tanstack/react-router";
import { getStudioPost, savePostSettings } from "@/data/entries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SeoPanel } from "@/components/admin/SeoPanel";
import { siteContentQuery } from "@/lib/site-content";
import { SITE_HOST, insightSeo, readSeoFields, type SeoFields } from "@/lib/seo";

export const Route = createFileRoute("/admin/insight-settings/$id")({ component: InsightSettings });

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_url: string | null;
  author: string | null;
  published: boolean;
  published_at: string | null;
  seo?: unknown;
  draft: Record<string, unknown> | null;
};
type Form = { author: string; date: string; slug: string; seo: SeoFields };

const formOf = (p: Post): Form => {
  const d = p.draft ?? {};
  const pick = <T,>(k: string, live: T) => (k in d ? d[k] : live) as T;
  const date = pick<string | null>("published_at", p.published_at);
  return {
    author: pick<string | null>("author", p.author) ?? "",
    date: date ? date.slice(0, 10) : "",
    slug: pick<string>("slug", p.slug),
    seo: readSeoFields(pick<unknown>("seo", p.seo)),
  };
};
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

/**
 * An insight's settings, opened from Insights → Settings: author, publish date, web address and
 * search & sharing. Title, standfirst and cover are edited on the page in the visual editor.
 * Save puts these live straight away (and into any draft, so publishing later keeps them).
 */
function InsightSettings() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const liveSettings = (
    useQuery(siteContentQuery).data as unknown as Record<string, unknown> | undefined
  )?.["settings"];
  const [post, setPost] = useState<Post | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let p: Post;
    try {
      const found = await getStudioPost({ data: { id } });
      if (!found) throw new Error("Insight not found");
      p = found as unknown as Post;
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setPost(p);
    setForm(formOf(p));
  };
  useEffect(() => {
    void load();
  }, [id]);

  if (!post || !form) return <p className="text-muted-foreground">Loading…</p>;
  const saved = formOf(post);
  const dirty = JSON.stringify({ ...form, seo: readSeoFields(form.seo) }) !== JSON.stringify(saved);
  const d = post.draft ?? {};
  const shown = {
    title: (d["title"] as string) ?? post.title,
    excerpt: (d["excerpt"] as string) ?? post.excerpt,
    cover_url: (d["cover_url"] as string) ?? post.cover_url,
  };
  const preview = insightSeo({ ...shown, slug: form.slug, seo: form.seo }, liveSettings);
  const status = !post.published ? "Draft" : post.draft ? "Live · unpublished changes" : "Live";
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form.slug) {
      toast.error("Add a web address.");
      return;
    }
    setBusy(true);
    const values = {
      author: form.author,
      published_at: form.date ? new Date(form.date).toISOString() : null,
      slug: form.slug,
      seo: readSeoFields(form.seo),
    };
    try {
      await savePostSettings({ data: { id, ...values } });
    } catch (e) {
      setBusy(false);
      toast.error((e as Error).message);
      return;
    }
    setBusy(false);
    await qc.invalidateQueries();
    await load();
    toast.success(
      post.published
        ? "Saved — live on the site"
        : "Saved — it goes live when the insight is published",
    );
  };

  return (
    <div className="max-w-3xl">
      <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← Insights
      </Link>
      <div className="sticky top-0 z-10 -mx-2 mb-6 mt-2 flex flex-wrap items-center justify-between gap-3 bg-background px-2 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-xl">{shown.title || "Untitled"}</h1>
          <Badge
            variant={status === "Live" ? "default" : status === "Draft" ? "outline" : "secondary"}
          >
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/admin/insights/$id" params={{ id }}>
              Edit insight
            </Link>
          </Button>
          <Button size="sm" disabled={!dirty || busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <section className="mb-8 space-y-4 rounded-sm border border-border p-6">
        <h2 className="text-lg">Insight</h2>
        <p className="text-sm text-muted-foreground">
          The title, standfirst and cover are edited on the page in the visual editor.
        </p>
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Author</span>
          <Input value={form.author} onChange={(e) => set({ author: e.target.value })} />
        </label>
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Publish date
          </span>
          <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          <span className="block text-xs text-muted-foreground">
            Leave empty to use the day it's first published.
          </span>
        </label>
        <div className="space-y-2">
          <label
            htmlFor="insight-address"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            Web address
          </label>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {SITE_HOST}/insights/
            <Input
              id="insight-address"
              value={form.slug}
              onChange={(e) => set({ slug: slugify(e.target.value) })}
            />
          </div>
          {post.published && (
            <span className="block text-xs text-muted-foreground">
              Changing it breaks links others have shared.
            </span>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-sm border border-border p-6">
        <SeoPanel
          seo={preview}
          fields={form.seo}
          set={(patch) => set({ seo: { ...form.seo, ...patch } })}
        />
      </section>
    </div>
  );
}
