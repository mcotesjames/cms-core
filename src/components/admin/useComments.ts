import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  groupThreads,
  isOpen,
  type CommentRow,
  type Device,
  type PinPosition,
  type Profile,
} from "@/lib/comments";
import { useAdminUser } from "./adminUser";
import { listProfiles } from "@/data/users";
import {
  deleteComment,
  listComments,
  reassignThread,
  replyToThread,
  setThreadResolved,
  startThread,
} from "@/data/comments";

export const commentsQuery = queryOptions({
  queryKey: ["admin", "comments"],
  queryFn: () => listComments(),
  // Keeps the "for you" counts current without a reload.
  refetchInterval: 60_000,
});

/** Everyone who has signed up, with whether an admin has approved them. */
export const profilesQuery = queryOptions({
  queryKey: ["admin", "profiles"],
  queryFn: () => listProfiles(),
});

export function useProfiles() {
  const list = useQuery(profilesQuery).data ?? [];
  const byId = Object.fromEntries(list.map((p) => [p.id, p]));
  return { list, byId, approved: list.filter((p) => p.approved) };
}

/** All comment threads, plus the actions on them. Every change refreshes the list everywhere. */
export function useComments() {
  const qc = useQueryClient();
  const me = useAdminUser();
  const rows = useQuery(commentsQuery).data;
  const threads = rows ? groupThreads(rows) : [];
  const refresh = () => qc.invalidateQueries({ queryKey: commentsQuery.queryKey });
  /** Runs an action, reports a failure, refreshes; true when it worked. */
  const run = async (p: Promise<unknown>) => {
    let ok = true;
    try {
      await p;
    } catch (e) {
      ok = false;
      toast.error((e as Error).message);
    }
    await refresh();
    return ok;
  };
  return {
    ready: !!rows,
    threads,
    /** Open threads assigned to the signed-in user. */
    forMe: threads.filter((t) => isOpen(t) && t.assignee_id === me.id).length,
    async start(t: {
      anchor: string;
      opened_on: string;
      device: Device;
      body: string;
      assignee_id: string;
      position?: PinPosition | null;
    }) {
      let id: string | null = null;
      try {
        id = (await startThread({ data: t as Parameters<typeof startThread>[0]["data"] })).id;
      } catch (e) {
        toast.error((e as Error).message);
      }
      await refresh();
      return id;
    },
    reply: (root: CommentRow, body: string) =>
      run(replyToThread({ data: { threadId: root.id, body } })),
    resolve: (id: string) => run(setThreadResolved({ data: { id, resolved: true } })),
    reopen: (id: string) => run(setThreadResolved({ data: { id, resolved: false } })),
    reassign: (id: string, assignee_id: string) =>
      run(reassignThread({ data: { id, assignee_id } })),
    remove: (id: string) => run(deleteComment({ data: { id } })),
  };
}
