import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  groupThreads,
  isOpen,
  type CommentRow,
  type Device,
  type PinPosition,
  type Profile,
} from "@/lib/comments";
import { useAdminUser } from "./adminUser";

export const commentsQuery = queryOptions({
  queryKey: ["admin", "comments"],
  queryFn: async () => {
    const { data, error } = await supabase.from("comments").select("*").order("created_at");
    if (error) throw error;
    return data as CommentRow[];
  },
  // Keeps the "for you" counts current without a reload.
  refetchInterval: 60_000,
});

/** Everyone who has signed up, with whether an admin has approved them. */
export const profilesQuery = queryOptions({
  queryKey: ["admin", "profiles"],
  queryFn: async () => {
    const [p, r] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email, created_at")
        .order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (p.error) throw p.error;
    if (r.error) throw r.error;
    const admins = new Set((r.data ?? []).filter((x) => x.role === "admin").map((x) => x.user_id));
    return (p.data ?? []).map((x) => ({ ...x, approved: admins.has(x.id) })) as Array<
      Profile & { created_at: string }
    >;
  },
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
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) toast.error(error.message);
    await refresh();
    return !error;
  };
  const now = () => new Date().toISOString();
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
      const { data, error } = await supabase
        .from("comments")
        .insert({ ...t, author_id: me.id })
        .select("id")
        .single();
      if (error) toast.error(error.message);
      await refresh();
      return data?.id ?? null;
    },
    reply: (root: CommentRow, body: string) =>
      run(
        supabase.from("comments").insert({
          thread_id: root.id,
          anchor: root.anchor,
          opened_on: root.opened_on,
          device: root.device,
          body,
          author_id: me.id,
        }),
      ),
    resolve: (id: string) =>
      run(
        supabase
          .from("comments")
          .update({ resolved_at: now(), resolved_by: me.id, updated_at: now() })
          .eq("id", id),
      ),
    reopen: (id: string) =>
      run(
        supabase
          .from("comments")
          .update({ resolved_at: null, resolved_by: null, updated_at: now() })
          .eq("id", id),
      ),
    reassign: (id: string, assignee_id: string) =>
      run(supabase.from("comments").update({ assignee_id, updated_at: now() }).eq("id", id)),
    remove: (id: string) => run(supabase.from("comments").delete().eq("id", id)),
  };
}
