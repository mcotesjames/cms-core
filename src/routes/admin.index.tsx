import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fetchSiteRows, fetchPostDrafts, ADMIN_POST_COLUMNS } from "@/lib/admin-drafts";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { blockId } from "@/lib/blocks-convert";

export const Route = createFileRoute("/admin/")({ component: InsightsList });

type Row = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  published_at: string | null;
  draft: unknown;
};

function status(r: Row) {
  if (!r.published) return { label: "Draft", variant: "outline" as const };
  if (r.draft) return { label: "Live · unpublished changes", variant: "secondary" as const };
  return { label: "Live", variant: "default" as const };
}

function InsightsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const [{ data, error }, drafts] = await Promise.all([
      supabase
        .from("posts")
        .select("id,title,slug,published,published_at")
        .order("published_at", { ascending: false, nullsFirst: true }),
      fetchPostDrafts().catch(() => ({}) as Record<string, unknown>),
    ]);
    if (error) toast.error(error.message);
    else setRows((data ?? []).map((r) => ({ ...r, draft: drafts[r.id] ?? null })) as Row[]);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        title: "Untitled insight",
        slug: `untitled-${Date.now().toString(36)}`,
        published: false,
        modules: [{ id: blockId(), type: "rich_text", body: "" }],
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/admin/insights/$id", params: { id: data.id } });
  };
  const duplicate = async (id: string) => {
    const { data: p, error } = await supabase
      .from("posts")
      .select(ADMIN_POST_COLUMNS)
      .eq("id", id)
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const { id: _, created_at: __, ...rest } = p;
    const res = await supabase
      .from("posts")
      .insert({
        ...rest,
        title: `${p.title} (copy)`,
        slug: `${p.slug}-copy-${Date.now().toString(36)}`,
        published: false,
      })
      .select("id")
      .single();
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Duplicated as a draft");
    load();
  };
  const remove = async (r: Row) => {
    if (!confirm(`Delete “${r.title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("posts").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-xl">Insights</h1>
        <Button onClick={create}>+ New insight</Button>
      </div>
      <ul className="divide-y divide-border rounded-sm border border-border">
        {rows.map((r) => {
          const s = status(r);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                to="/admin/insights/$id"
                params={{ id: r.id }}
                className="min-w-0 flex-1 truncate hover:text-primary"
              >
                {r.title || "Untitled"}
              </Link>
              <Badge variant={s.variant}>{s.label}</Badge>
              <span className="w-28 text-sm text-muted-foreground">
                {r.published_at ? new Date(r.published_at).toLocaleDateString("en-GB") : "—"}
              </span>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/admin/insights/$id" params={{ id: r.id }}>
                  Edit
                </Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/admin/insight-settings/$id" params={{ id: r.id }}>
                  Settings
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => duplicate(r.id)}>
                Duplicate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                Delete
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
