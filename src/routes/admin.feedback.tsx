import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listStudioPosts } from "@/data/entries";
import { listStudioRecords } from "@/data/records";
import { Button } from "@/components/ui/button";
import { ThreadRow } from "@/components/admin/CommentThreads";
import { useComments } from "@/components/admin/useComments";
import { usePages } from "@/components/admin/usePages";
import { useAdminUser } from "@/components/admin/adminUser";
import { isOpen, parsePlace, type Place, type Thread } from "@/lib/comments";

export const Route = createFileRoute("/admin/feedback")({ component: Feedback });

type Tab = "mine" | "open" | "resolved";

/** Names for the places threads were left (insights, investments, publications). */
function usePlaceNames() {
  return (
    useQuery({
      queryKey: ["admin", "comment-place-names"],
      queryFn: async () => {
        const [p, i, u] = await Promise.all([
          listStudioPosts(),
          listStudioRecords({ data: { table: "investments" } }),
          listStudioRecords({ data: { table: "publications" } }),
        ]);
        const map = (rows: Array<{ id: string; title?: unknown; name?: unknown }>) =>
          Object.fromEntries(rows.map((r) => [r.id, String(r.title ?? r.name ?? "")]));
        return { posts: map(p), records: { ...map(i), ...map(u) } };
      },
    }).data ?? { posts: {}, records: {} }
  );
}

/** Every feedback thread across the Studio. Opening one takes you to it, in place. */
function Feedback() {
  const me = useAdminUser();
  const c = useComments();
  const names = usePlaceNames();
  const pageNames = Object.fromEntries(usePages().all.map((p) => [p.key, p.title]));
  const navigate = useNavigate();
  const mine = c.threads.filter((t) => isOpen(t) && t.assignee_id === me.id);
  const [tab, setTab] = useState<Tab | null>(null);
  const current: Tab = tab ?? (mine.length ? "mine" : "open");
  const shown: Thread[] =
    current === "mine"
      ? mine
      : current === "open"
        ? c.threads.filter(isOpen)
        : c.threads.filter((t) => !isOpen(t));

  const go = (t: Thread, place: Place | null) => {
    if (!place) return;
    const search = { comment: t.id };
    if (place.kind === "page")
      void navigate({ to: "/admin/pages/$key", params: { key: place.key }, search });
    else if (place.kind === "post")
      void navigate({ to: "/admin/insights/$id", params: { id: place.id }, search });
    else
      void navigate({
        to: place.table === "investments" ? "/admin/investments" : "/admin/publications",
        search: { ...search, record: place.id },
      });
  };

  const tabs: Array<[Tab, string, number]> = [
    ["mine", "For me", mine.length],
    ["open", "All open", c.threads.filter(isOpen).length],
    ["resolved", "Resolved", c.threads.filter((t) => !isOpen(t)).length],
  ];
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl">Feedback</h1>
      <p className="text-sm text-muted-foreground">
        Comments left on pages, insights and records. To add one, open a page or insight and press
        Comment in the top bar, or use Comments in a record's form. Resolved comments are deleted
        after 30 days.
      </p>
      <div className="flex gap-2" role="tablist">
        {tabs.map(([k, label, n]) => (
          <Button
            key={k}
            role="tab"
            aria-selected={current === k}
            size="sm"
            variant={current === k ? "default" : "ghost"}
            onClick={() => setTab(k)}
          >
            {label} ({n})
          </Button>
        ))}
      </div>
      {!c.ready ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {current === "mine"
            ? "Nothing for you right now."
            : current === "open"
              ? "No open comments."
              : "No resolved comments in the last 30 days."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-sm border border-border">
          {shown.map((t) => {
            const place = parsePlace(t.opened_on, { ...names, pages: pageNames });
            return (
              <li key={t.id}>
                <ThreadRow
                  thread={t}
                  label={place?.label ?? t.opened_on}
                  onOpen={() => go(t, place)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
