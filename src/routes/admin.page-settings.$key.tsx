import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fetchSiteRows, saveSiteRow } from "@/lib/admin-drafts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePages } from "@/components/admin/usePages";
import { SeoPanel } from "@/components/admin/SeoPanel";
import { siteContentQuery } from "@/lib/site-content";
import { SITE_HOST, readSeoFields, pageSeo, type SeoFields } from "@/lib/seo";
import { slugProblem } from "@/lib/pages";

export const Route = createFileRoute("/admin/page-settings/$key")({ component: PageSettings });

type Row = { content: Record<string, unknown>; draft: Record<string, unknown> | null };

const same = (a: SeoFields, b: SeoFields) =>
  JSON.stringify(readSeoFields(a)) === JSON.stringify(readSeoFields(b));

/**
 * A page's settings, opened from Pages → Settings: name, web address and search & sharing.
 * Save puts them live straight away (they don't wait for the page to be published).
 */
function PageSettings() {
  const { key } = Route.useParams();
  const pages = usePages();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const page = pages.all.find((p) => p.key === key);
  const liveSite = (useQuery(siteContentQuery).data ?? {}) as unknown as Record<string, unknown>;
  const [row, setRow] = useState<Row | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [seo, setSeo] = useState<SeoFields>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let data: { content: unknown; draft: unknown } | undefined;
    try {
      data = (await fetchSiteRows(key))[0];
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    const r: Row = {
      content: (data?.content ?? {}) as Record<string, unknown>,
      draft: (data?.draft ?? null) as Record<string, unknown> | null,
    };
    setRow(r);
    setSeo(readSeoFields((r.draft ?? r.content)["seo"]));
  }, [key]);
  useEffect(() => {
    void load();
  }, [load]);
  // The form follows the page's saved name and address (e.g. after saving).
  const savedTitle = page?.title;
  const savedPath = page?.path;
  useEffect(() => {
    if (savedTitle === undefined || savedPath === undefined) return;
    setTitle(savedTitle);
    setSlug(savedPath.slice(1));
  }, [savedTitle, savedPath]);

  if (!pages.ready || !row) return <p className="text-muted-foreground">Loading…</p>;
  if (!page)
    return (
      <p className="text-muted-foreground">
        This page no longer exists.{" "}
        <Link to="/admin/pages" className="underline">
          Back to Pages
        </Link>
      </p>
    );

  const savedSeo = readSeoFields((row.draft ?? row.content)["seo"]);
  const slugErr =
    page.custom && slug !== page.path.slice(1) ? slugProblem(slug, pages.list, key) : null;
  const dirty =
    title.trim() !== page.title ||
    (page.custom && slug !== page.path.slice(1)) ||
    !same(seo, savedSeo);
  const doc = { ...(row.draft ?? row.content), seo };
  const preview = pageSeo({ ...liveSite, [key]: doc, pages: { list: pages.list } }, page.key, {
    title: page.title,
    path: page.custom ? `/${slug}` : page.path,
  });
  const status = !page.published ? "Draft" : row.draft ? "Live · unpublished changes" : "Live";

  const save = async () => {
    if (!title.trim() || slugErr) return;
    setBusy(true);
    let ok = true;
    if (title.trim() !== page.title) ok = (await pages.update(key, { title: title.trim() })) && ok;
    if (page.custom && slug !== page.path.slice(1)) ok = (await pages.update(key, { slug })) && ok;
    if (!same(seo, savedSeo)) {
      // Live straight away, and into the draft too so publishing the page later keeps it.
      const clean = readSeoFields(seo);
      const { error } = await saveSiteRow(key, {
        content: { ...row.content, seo: clean },
        draft: row.draft ? { ...row.draft, seo: clean } : null,
      });
      if (error) {
        toast.error(error.message);
        ok = false;
      }
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: siteContentQuery.queryKey });
    await load();
    if (ok)
      toast.success(
        page.published
          ? "Saved — live on the site"
          : "Saved — it goes live when the page is published",
      );
  };
  const duplicate = async () => {
    const data = await fetchSiteRows().catch(() => []);
    const site = Object.fromEntries((data ?? []).map((r) => [r.key, r.draft ?? r.content]));
    const newKey = await pages.duplicate(page.key, page.title, site);
    if (newKey) {
      toast.success("Duplicated as a draft page");
      void navigate({ to: "/admin/page-settings/$key", params: { key: newKey } });
    }
  };
  const remove = async () => {
    if (!confirm(`Delete “${page.title}”? It comes off the site, and menu links to it are hidden.`))
      return;
    if (await pages.remove(key)) void navigate({ to: "/admin/pages" });
  };

  return (
    <div className="max-w-3xl">
      <Link to="/admin/pages" className="text-sm text-muted-foreground hover:text-foreground">
        ← Pages
      </Link>
      <div className="sticky top-0 z-10 -mx-2 mb-6 mt-2 flex flex-wrap items-center justify-between gap-3 bg-background px-2 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-xl">{page.title}</h1>
          <Badge
            variant={status === "Live" ? "default" : status === "Draft" ? "outline" : "secondary"}
          >
            {status}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/admin/pages/$key" params={{ key }}>
              Edit page
            </Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={duplicate}>
            Duplicate
          </Button>
          {page.custom && (
            <Button size="sm" variant="ghost" onClick={remove}>
              Delete
            </Button>
          )}
          <Button size="sm" disabled={!dirty || busy || !title.trim() || !!slugErr} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <section className="mb-8 space-y-4 rounded-sm border border-border p-6">
        <h2 className="text-lg">Page</h2>
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Page name
          </span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <span className="block text-xs text-muted-foreground">
            Used in the Studio, the page switcher and menu link options.
          </span>
        </label>
        <div className="space-y-2">
          <label
            htmlFor="page-address"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >
            Web address
          </label>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {SITE_HOST}/
            {page.custom ? (
              <Input
                id="page-address"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              />
            ) : (
              <span id="page-address" className="text-foreground">
                {page.path === "/" ? "" : page.path.slice(1)}
              </span>
            )}
          </div>
          {slugErr ? (
            <span className="block text-xs text-destructive">{slugErr}</span>
          ) : page.custom ? (
            page.published && (
              <span className="block text-xs text-muted-foreground">
                Changing it breaks links others have shared. Menu links update automatically.
              </span>
            )
          ) : (
            <span className="block text-xs text-muted-foreground">
              Built-in page: its address is part of the site's structure, so it's fixed.
            </span>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-sm border border-border p-6">
        <SeoPanel
          seo={preview}
          fields={seo}
          set={(patch) => setSeo((s) => ({ ...s, ...patch }))}
          home={key === "home"}
        />
      </section>
    </div>
  );
}
