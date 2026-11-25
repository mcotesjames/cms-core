import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchSiteRows } from "@/lib/admin-drafts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePages } from "@/components/admin/usePages";
import { NewPageDialog } from "@/components/admin/NewPageDialog";
import type { PageInfo } from "@/lib/pages";
import { TEMPLATES, templateOf, type TemplateKey } from "@/lib/templates";
import { templateDef } from "@/lib/templates";

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
  if (!p.published) return { label: "Draft", variant: "draft" as const };
  if (hasDraft) return { label: "Live · unpublished changes", variant: "changes" as const };
  return { label: "Live", variant: "live" as const };
}

/** "Standard", or "Standard → Landing (unpublished)" when the draft switches template. */
function templateLabel(p: PageInfo, row: { content: unknown; draft: unknown } | undefined) {
  const live: TemplateKey = templateOf(p.key, row?.content as Record<string, unknown> | undefined);
  const draft: TemplateKey =
    row?.draft != null ? templateOf(p.key, row.draft as Record<string, unknown>) : live;
  return String(draft) === String(live)
    ? templateDef(live).label
    : `${templateDef(live).label} → ${templateDef(draft).label} (unpublished)`;
}

const MENU_ITEM =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent [&_svg]:size-4 [&_svg]:stroke-[1.75] [&_svg]:text-muted-foreground";

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

  const edited = pages.all.filter((p) => rows[p.key]?.draft != null).length;
  const summary = `${pages.all.length} ${pages.all.length === 1 ? "page" : "pages"}${edited ? ` · ${edited} with unpublished changes` : ""}`;

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1>Pages</h1>
          <p className="studio-help mt-0.5">{summary}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New page
        </Button>
      </div>
      <NewPageDialog open={creating} onOpenChange={setCreating} />
      <ul className="studio-rows">
        {pages.all.map((p) => {
          const s = status(p, rows[p.key]?.draft != null);
          return (
            <li key={p.key} className="studio-row relative">
              {/* The whole row opens the editor; the … menu sits above the row link. */}
              <Link
                to="/admin/pages/$key"
                params={{ key: p.key }}
                className="studio-row-title min-w-[8rem] flex-1 truncate after:absolute after:inset-0"
              >
                {p.title}
              </Link>
              <span className="studio-row-meta hidden w-44 truncate sm:inline">{p.path}</span>
              <Badge variant="outline" className="hidden md:inline-flex">
                {templateLabel(p, rows[p.key])}
              </Badge>
              <Badge variant={s.variant}>{s.label}</Badge>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="relative z-10"
                    aria-label={`More actions for ${p.title}`}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-44 p-1">
                  <Link
                    to="/admin/page-settings/$key"
                    params={{ key: p.key }}
                    className={MENU_ITEM}
                  >
                    <Settings aria-hidden="true" />
                    Settings
                  </Link>
                  <button type="button" className={MENU_ITEM} onClick={() => duplicate(p)}>
                    <Copy aria-hidden="true" />
                    Duplicate
                  </button>
                  {p.custom && (
                    <button
                      type="button"
                      className={`${MENU_ITEM} text-destructive`}
                      onClick={() => remove(p)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </li>
          );
        })}
      </ul>
      <p className="studio-help mt-3">
        The homepage keeps its web address and can't be deleted. Everything else works the same.
      </p>
    </div>
  );
}
