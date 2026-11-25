import { useEffect, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { PanelHeading } from "@/components/admin/StudioShell";
import { NewThread, ThreadRow, ThreadView } from "./CommentThreads";
import { useComments } from "./useComments";
import {
  canvasThreads,
  isSharedAnchor,
  parsePosition,
  type Device,
  type PinPosition,
} from "@/lib/comments";
import type { StudioMessage } from "@/lib/studio-mode";

/**
 * Comment mode for a Studio canvas (page or article editor). `here` is where comments left on
 * this canvas are filed ("page:home", "post:<id>") and doubles as the anchor for a comment on
 * the page as a whole. `focus` opens one thread straight away (from the Feedback list).
 */
export function useCanvasComments({
  frame,
  here,
  hereLabel,
  focus,
  initial,
}: {
  frame: RefObject<HTMLIFrameElement | null>;
  here: string;
  hereLabel: string;
  focus?: string | undefined;
  /** Carried over from the page switcher. */
  initial?: { device?: Device | undefined; commenting?: boolean | undefined } | undefined;
}) {
  const c = useComments();
  const [on, setOn] = useState(!!focus || !!initial?.commenting);
  const [device, setDevice] = useState<Device>(initial?.device ?? "desktop");
  const [found, setFound] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    anchor: string;
    label: string;
    position: PinPosition | null;
  } | null>(null);
  /** From the canvas: what each placed pin is on, and which pins are inside something closed. */
  const [pinInfo, setPinInfo] = useState<{ labels: Record<string, string>; hidden: string[] }>({
    labels: {},
    hidden: [],
  });
  const [openId, setOpenId] = useState<string | null>(focus ?? null);
  const [scrollTo, setScrollTo] = useState<string | null>(focus ?? null);
  const [showResolved, setShowResolved] = useState(false);

  const list = canvasThreads(c.threads, here, found);
  /** The thread to bring into view (from the Feedback list, or picked in the panel's list). */
  const scrollThread = scrollTo ? c.threads.find((t) => t.id === scrollTo) : undefined;
  const relevant = (t: { opened_on: string; anchor: string }) =>
    t.opened_on === here || isSharedAnchor(t.anchor);
  const resolved = c.threads.filter(
    (t) =>
      t.resolved_at && (t.opened_on === here || (isSharedAnchor(t.anchor) && t.anchor in found)),
  );
  const check = [...new Set(c.threads.filter(relevant).map((t) => t.anchor))];
  const message: StudioMessage = {
    type: "studio-comments",
    on,
    pins: list
      .filter((t) => t.anchor in found)
      .map((t) => ({
        id: t.id,
        anchor: t.anchor,
        n: t.n,
        active: t.id === openId,
        position: parsePosition(t.position),
      })),
    check,
    scrollTo: scrollThread
      ? {
          id: scrollThread.id,
          anchor: scrollThread.anchor,
          position: parsePosition(scrollThread.position),
        }
      : null,
  };
  const key = JSON.stringify(message);
  const sync = () => frame.current?.contentWindow?.postMessage(message, window.location.origin);
  useEffect(sync, [key]);
  // Stop asking after a while if the element never appears (e.g. it was removed).
  useEffect(() => {
    if (!scrollTo) return;
    const t = setTimeout(() => setScrollTo(null), 15000);
    return () => clearTimeout(t);
  }, [scrollTo]);

  const labelFor = (anchor: string, id?: string) =>
    (id && pinInfo.labels[id]) ||
    found[anchor] ||
    (anchor === here || anchor.startsWith("page:")
      ? hereLabel
      : "an element no longer on the page");

  /** Handles comment messages from the canvas; returns true when it did. */
  const handle = (m: StudioMessage) => {
    if (m.type === "studio-comment-at") {
      setPending({ anchor: m.anchor, label: m.label, position: m.position });
      setOpenId(null);
      return true;
    }
    if (m.type === "studio-pin") {
      setOpenId(m.id);
      setPending(null);
      return true;
    }
    if (m.type === "studio-scrolled") {
      if (m.id === scrollTo) setScrollTo(null);
      return true;
    }
    if (m.type === "studio-anchors") {
      setFound(m.found);
      setPinInfo({ labels: m.pinLabels, hidden: m.hidden });
      return true;
    }
    return false;
  };

  const open = openId ? c.threads.find((t) => t.id === openId) : undefined;
  const openMeta = open && list.find((t) => t.id === open.id);
  const panel = (
    <>
      <PanelHeading title="Comments" onDone={() => setOn(false)} />
      {pending ? (
        <NewThread
          label={pending.label}
          onCancel={() => setPending(null)}
          onPost={async (body, assignee_id) => {
            const id = await c.start({
              anchor: pending.anchor,
              opened_on: here,
              device,
              body,
              assignee_id,
              position: pending.position,
            });
            if (id) {
              setPending(null);
              setOpenId(id);
            }
          }}
        />
      ) : open ? (
        <>
          <ThreadView
            thread={open}
            label={labelFor(open.anchor, open.id)}
            removed={openMeta?.removed}
            onBack={() => setOpenId(null)}
          />
          {pinInfo.hidden.includes(open.id) && (
            <p className="rounded-sm border border-border p-2 text-xs text-muted-foreground">
              This comment is on something that's closed right now (such as the mobile menu). Its
              pin is shown hollow nearby — Alt-click (Option-click on a Mac) to open it.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Click exactly where you want to leave a comment. Numbered pins show open comments; click
            one to read or reply. Comments record the device you're viewing ({device}).
          </p>
          <p className="text-xs text-muted-foreground">
            Hold Alt (Option on a Mac) and click to use the page as normal — e.g. open an accordion
            — then click the text inside to comment on it.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPending({ anchor: here, label: hereLabel, position: null })}
          >
            Comment on {hereLabel}
          </Button>
          <section className="space-y-1">
            <h3 className="text-sm">Open ({list.length})</h3>
            {list.length === 0 && (
              <p className="text-xs text-muted-foreground">No open comments here.</p>
            )}
            {list.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                n={t.n}
                label={labelFor(t.anchor, t.id)}
                removed={t.removed}
                onOpen={() => {
                  setOpenId(t.id);
                  setScrollTo(t.id);
                }}
              />
            ))}
          </section>
          {resolved.length > 0 && (
            <section className="space-y-1">
              <Button variant="ghost" size="sm" onClick={() => setShowResolved(!showResolved)}>
                {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
              </Button>
              {showResolved &&
                resolved.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    label={labelFor(t.anchor)}
                    onOpen={() => setOpenId(t.id)}
                  />
                ))}
            </section>
          )}
        </>
      )}
    </>
  );

  return {
    on,
    toggle: () => {
      setOn(!on);
      setPending(null);
    },
    forMe: c.forMe,
    device,
    setDevice,
    /** Re-sends the pins (when the canvas reloads). */
    sync,
    handle,
    /** Escape: back out of a new comment or open thread. */
    back: () => {
      setPending(null);
      setOpenId(null);
    },
    panel,
  };
}
