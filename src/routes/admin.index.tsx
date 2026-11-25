import { createPost, deletePost, duplicatePost, listStudioPosts } from "@/data/entries";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
    try {
      setRows((await listStudioPosts()) as unknown as Row[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    try {
      const { id } = await createPost({ data: { firstBlockId: blockId() } });
      navigate({ to: "/admin/insights/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const duplicate = async (id: string) => {
    try {
      await duplicatePost({ data: { id } });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    toast.success("Duplicated as a draft");
    load();
  };
  const remove = async (r: Row) => {
    if (!confirm(`Delete “${r.title}”? This cannot be undone.`)) return;
    try {
      await deletePost({ data: { id: r.id } });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
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
