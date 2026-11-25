import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchSiteRows } from "@/lib/admin-drafts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePages } from "@/components/admin/usePages";
import { NewPageDialog } from "@/components/admin/NewPageDialog";
import type { PageInfo } from "@/lib/pages";
import { TEMPLATES, templateOf, type TemplateKey } from "@/lib/templates";

export const Route = createFileRoute("/admin/pages/")({ component: PagesList });

/** Every page row's live content and draft, keyed by page (for status and for duplicating). */
const rowsQuery = {
  queryKey: ["admin", "page-rows"],
  queryFn: async () => {
    const data = await fetchSiteRows();
    return Object.fromEntries(
      (data ?? []).map((r) => [r.key, { content: r.content, draft: r.draft }]),
    ) as Record<string, { content: unknown; draft: unknown }>;
  },
};

function status(p: PageInfo, hasDraft: boolean) {
  if (!p.published) return { label: "Draft", variant: "outline" as const };
  if (hasDraft) return { label: "Live · unpublished changes", variant: "secondary" as const };
  return { label: "Live", variant: "default" as const };
}

/** "Standard", or "Standard → Landing (unpublished)" when the draft switches template. */
function templateLabel(p: PageInfo, row: { content: unknown; draft: unknown } | undefined) {
  const live: TemplateKey = templateOf(p.key, row?.content as Record<string, unknown> | undefined);
  const draft: TemplateKey =
    row?.draft != null ? templateOf(p.key, row.draft as Record<string, unknown>) : live;
  return String(draft) === String(live)
    ? TEMPLATES[live].label
    : `${TEMPLATES[live].label} → ${TEMPLATES[draft].label} (unpublished)`;
}

/**
 * Pages: Edit opens the visual editor, Settings the page's settings (name,
 * web address, search & sharing). Any page can be duplicated; pages made here can be deleted.
 */
function PagesList() {
  const pages = usePages();
  const qc = useQueryClient();
  const rows = useQuery(rowsQuery).data ?? {};
  const [creating, setCreating] = useState(false);

  const duplicate = async (p: PageInfo) => {
    // Copy what's in the editor right now: each row's draft if it has one, else its live content.
    const site = Object.fromEntries(
      Object.entries(rows).map(([k, r]) => [k, r.draft ?? r.content]),
    );
    const key = await pages.duplicate(p.key, p.title, site);
    if (!key) return;
    toast.success("Duplicated as a draft page");
    await qc.invalidateQueries({ queryKey: rowsQuery.queryKey });
  };
  const remove = async (p: PageInfo) => {
    if (!confirm(`Delete “${p.title}”? It comes off the site, and menu links to it are hidden.`))
      return;
    if (await pages.remove(p.key)) toast.success("Page deleted");
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-xl">Pages</h1>
        <Button onClick={() => setCreating(true)}>+ New page</Button>
      </div>
      <NewPageDialog open={creating} onOpenChange={setCreating} />
      <ul className="divide-y divide-border rounded-sm border border-border">
        {pages.all.map((p) => {
          const s = status(p, rows[p.key]?.draft != null);
          return (
            <li key={p.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                to="/admin/pages/$key"
                params={{ key: p.key }}
                className="min-w-[10rem] flex-1 truncate hover:text-primary"
              >
                {p.title}
              </Link>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {templateLabel(p, rows[p.key])}
              </Badge>
              <Badge variant={s.variant}>{s.label}</Badge>
              <span className="w-40 truncate text-sm text-muted-foreground">{p.path}</span>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/admin/pages/$key" params={{ key: p.key }}>
                  Edit
                </Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/admin/page-settings/$key" params={{ key: p.key }}>
                  Settings
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => duplicate(p)}>
                Duplicate
              </Button>
              {p.custom ? (
                <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                  Delete
                </Button>
              ) : (
                <span className="w-[62px]" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        The homepage keeps its web address and can't be deleted. Everything else works the same.
      </p>
    </div>
  );
}
