import { useEffect, useRef, useState } from "react";
import { fetchSiteRows } from "@/lib/admin-drafts";
import { useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useComments } from "./useComments";
import { usePages } from "./usePages";
import { NewPageDialog } from "./NewPageDialog";
import type { PageKey } from "@/lib/pages";
import { isOpen, type Device } from "@/lib/comments";
import {
  isSame,
  matches,
  switcherFlags,
  type Flags,
  type SwitcherTarget,
} from "@/lib/page-switcher";

/** Which rows have drafts. Refreshed when the switcher opens. */
const switcherQuery = queryOptions({
  queryKey: ["admin", "switcher"],
  queryFn: async () => ({
    drafts: (await fetchSiteRows()).filter((r) => r.draft != null).map((r) => r.key),
  }),
});

function Dots({ f }: { f: Flags | undefined }) {
  if (!f) return null;
  return (
    <span className="ml-auto flex gap-1.5 pl-3">
      {f.unpublished && (
        <span className="site-switch-dot" data-kind="unpublished" title="Unpublished changes">
          <span className="sr-only">Unpublished changes</span>
        </span>
      )}
      {f.comments && (
        <span className="site-switch-dot" data-kind="comments" title="Unresolved comments">
          <span className="sr-only">Unresolved comments</span>
        </span>
      )}
    </span>
  );
}

const ROW =
  "flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";

/**
 * The page name in the editor's top bar, as a dropdown to jump to another page.
 * Waits for any pending draft save before switching, and keeps the device view and comment mode.
 */
export function PageSwitcher({
  current,
  label,
  saving,
  view,
}: {
  current: SwitcherTarget;
  label: string;
  saving: boolean;
  view: { device: Device; commenting: boolean };
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [waiting, setWaiting] = useState(false);
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const search = useRef<HTMLInputElement>(null);
  const data = useQuery({ ...switcherQuery, enabled: open }).data;
  const comments = useComments().threads;
  const pageList = usePages().all;
  const [creating, setCreating] = useState(false);
  const flags = switcherFlags({
    drafts: data?.drafts ?? [],
    openCommentPlaces: comments.filter(isOpen).map((t) => t.opened_on),
    pages: pageList,
  });

  // Cmd/Ctrl+K opens the switcher with the search focused (also from inside the canvas).
  useEffect(() => {
    const show = () => {
      setOpen(true);
      setQ("");
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (
        e.origin === window.location.origin &&
        e.data?.type === "studio-shortcut" &&
        e.data.key === "switcher"
      )
        show();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const go = async (target: SwitcherTarget) => {
    if (isSame(target, current)) {
      setOpen(false);
      return;
    }
    // Let a draft that's still saving land first, so nothing typed is lost.
    if (savingRef.current) {
      setWaiting(true);
      const until = Date.now() + 5000;
      while (savingRef.current && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
      setWaiting(false);
    }
    setOpen(false);
    const search = {
      device: view.device === "desktop" ? undefined : view.device,
      mode: view.commenting ? ("comment" as const) : undefined,
    };
    void navigate({ to: "/admin/pages/$key", params: { key: target.key }, search });
  };

  const typing = q.trim().length > 0;
  const pageHits = pageList.filter((p) => matches(p.title, q));
  const here = (t: SwitcherTarget) => isSame(t, current);

  const PageRow = ({ k, title, draft }: { k: PageKey; title: string; draft?: boolean }) => (
    <button
      type="button"
      className={ROW}
      aria-current={here({ kind: "page", key: k }) ? "page" : undefined}
      onClick={() => go({ kind: "page", key: k })}
    >
      <span className="w-4 text-xs">{here({ kind: "page", key: k }) ? "✓" : ""}</span>
      <span className="min-w-0 truncate">{title}</span>
      {draft && <span className="ml-2 shrink-0 text-xs text-muted-foreground">Draft</span>}
      <Dots f={flags.pages[k]} />
    </button>
  );
  return (
    <>
      <NewPageDialog open={creating} onOpenChange={setCreating} />
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setQ("");
        }}
      >
        <PopoverTrigger
          className="site-switch-trigger min-w-0 truncate rounded-sm px-2 py-1 text-sm hover:bg-accent"
          aria-label={`${label} — switch page`}
        >
          <span className="truncate">{label}</span>
          <span aria-hidden="true" className="ml-1.5 text-xs text-muted-foreground">
            ▾
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-96 p-2"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            search.current?.focus();
          }}
        >
          <Input
            ref={search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages…"
            aria-label="Search pages"
            className="mb-2 h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter" && pageHits[0]) go({ kind: "page", key: pageHits[0].key });
            }}
          />
          <div className="max-h-[60vh] overflow-y-auto">
            {waiting && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Saving your draft…</p>
            )}
            {typing ? (
              <>
                {pageHits.map((p) => (
                  <PageRow key={p.key} k={p.key} title={p.title} draft={!p.published} />
                ))}
                {pageHits.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Nothing matches.</p>
                )}
              </>
            ) : (
              <>
                <p className="px-3 pb-1 pt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Pages
                </p>
                {pageList.map((p) => (
                  <PageRow key={p.key} k={p.key} title={p.title} draft={!p.published} />
                ))}
                <button
                  type="button"
                  className={`${ROW} text-muted-foreground`}
                  onClick={() => {
                    setOpen(false);
                    setCreating(true);
                  }}
                >
                  <span className="w-4" />+ New page
                </button>
              </>
            )}
          </div>
          <p className="mt-2 border-t border-border px-3 pt-2 text-[11px] text-muted-foreground">
            <span className="site-switch-dot mr-1" data-kind="unpublished" /> unpublished changes
            <span className="site-switch-dot ml-3 mr-1" data-kind="comments" /> unresolved comments
            · ⌘/Ctrl K
          </p>
        </PopoverContent>
      </Popover>
    </>
  );
}
