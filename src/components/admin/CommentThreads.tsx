import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PanelField } from "@/components/admin/StudioShell";
import { useAdminUser } from "./adminUser";
import { useComments, useProfiles } from "./useComments";
import {
  daysUntilRemoved,
  profileName,
  timeAgo,
  type CommentRow,
  type Thread,
} from "@/lib/comments";

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Required "For" picker: approved users, by name. */
function ForSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const me = useAdminUser();
  const { approved } = useProfiles();
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      required
      onChange={(e) => onChange(e.target.value)}
    >
      {!value && <option value="">Choose who it's for…</option>}
      {approved.map((p) => (
        <option key={p.id} value={p.id}>
          {profileName(p)}
          {p.id === me.id ? " (you)" : ""}
        </option>
      ))}
    </select>
  );
}

/** Starts a thread on `label`. Both the comment and who it's for are required. */
export function NewThread({
  label,
  onCancel,
  onPost,
}: {
  label: string;
  onCancel?: () => void;
  onPost: (body: string, assignee: string) => Promise<unknown>;
}) {
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = body.trim() && assignee;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setBusy(true);
        await onPost(body.trim(), assignee);
        setBusy(false);
        setBody("");
        setAssignee("");
      }}
    >
      <p className="text-xs text-muted-foreground">
        New comment on <span className="text-foreground">{label}</span>
      </p>
      <Textarea
        rows={4}
        autoFocus
        placeholder="Write your comment…"
        aria-label="Comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <PanelField label="For">
        <ForSelect value={assignee} onChange={setAssignee} />
      </PanelField>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!ok || busy}>
          Post comment
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Message({
  c,
  root,
  onDelete,
}: {
  c: CommentRow;
  root?: boolean;
  onDelete?: (() => void) | undefined;
}) {
  const { byId } = useProfiles();
  return (
    <div className="space-y-1 rounded-sm border border-border p-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        <span className="text-sm text-foreground">{profileName(byId[c.author_id])}</span>
        <span>{timeAgo(c.created_at)}</span>
        {root && <span className="site-comment-device">{c.device}</span>}
      </p>
      <p className="whitespace-pre-wrap text-sm">{c.body}</p>
      {onDelete && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={onDelete}
        >
          Delete
        </button>
      )}
    </div>
  );
}

/** One thread: the comment, replies, who it's for (changeable), reply box, resolve / reopen. */
export function ThreadView({
  thread,
  label,
  removed,
  onBack,
  backLabel = "All comments",
}: {
  thread: Thread;
  label: string;
  removed?: boolean | undefined;
  onBack: () => void;
  backLabel?: string;
}) {
  const me = useAdminUser();
  const c = useComments();
  const [reply, setReply] = useState("");
  const del = async (row: CommentRow) => {
    const isRoot = row.id === thread.id;
    if (!confirm(isRoot ? "Delete this comment and its replies?" : "Delete this reply?")) return;
    await c.remove(row.id);
    if (isRoot) onBack();
  };
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← {backLabel}
      </Button>
      <p className="text-xs text-muted-foreground">
        On <span className="text-foreground">{label}</span>
      </p>
      {removed && (
        <p className="rounded-sm border border-border p-2 text-xs text-muted-foreground">
          The element this was pinned to has been removed from the page.
        </p>
      )}
      <Message
        c={thread}
        root
        onDelete={thread.author_id === me.id ? () => del(thread) : undefined}
      />
      {thread.replies.map((r) => (
        <Message key={r.id} c={r} onDelete={r.author_id === me.id ? () => del(r) : undefined} />
      ))}
      <PanelField label="For">
        <ForSelect
          value={thread.assignee_id ?? ""}
          onChange={(v) => v && c.reassign(thread.id, v)}
        />
      </PanelField>
      {thread.resolved_at ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Resolved {timeAgo(thread.resolved_at)} · deleted in{" "}
            {daysUntilRemoved(thread.resolved_at)} days
          </p>
          <Button size="sm" variant="outline" onClick={() => c.reopen(thread.id)}>
            Reopen
          </Button>
        </div>
      ) : (
        <>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              if (await c.reply(thread, reply.trim())) setReply("");
            }}
          >
            <Textarea
              rows={3}
              placeholder="Reply…"
              aria-label="Reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline" disabled={!reply.trim()}>
              Reply
            </Button>
          </form>
          <Button size="sm" onClick={() => c.resolve(thread.id)}>
            Resolve
          </Button>
        </>
      )}
    </div>
  );
}

/** A thread in a list: number (on canvases), comment, who it's for, who left it, when. */
export function ThreadRow({
  thread,
  n,
  label,
  removed,
  onOpen,
}: {
  thread: Thread;
  n?: number | undefined;
  label?: string | undefined;
  removed?: boolean | undefined;
  onOpen: () => void;
}) {
  const me = useAdminUser();
  const { byId } = useProfiles();
  const forMe = thread.assignee_id === me.id;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 rounded-sm px-3 py-2 text-left hover:bg-accent"
    >
      {n !== undefined && (
        <span className="site-comment-number" aria-hidden="true">
          {n}
        </span>
      )}
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="line-clamp-2 block text-sm">{thread.body}</span>
        {label && <span className="block truncate text-xs text-muted-foreground">{label}</span>}
        <span className="block text-xs text-muted-foreground">
          For{" "}
          <span className={forMe ? "text-primary" : "text-foreground"}>
            {forMe ? "you" : profileName(byId[thread.assignee_id ?? ""])}
          </span>
          {" · "}
          {profileName(byId[thread.author_id])}, {timeAgo(thread.created_at)}
          {thread.replies.length > 0 &&
            ` · ${thread.replies.length} repl${thread.replies.length === 1 ? "y" : "ies"}`}
          {removed && " · element removed"}
          {thread.device !== "desktop" && ` · ${thread.device}`}
        </span>
      </span>
    </button>
  );
}
