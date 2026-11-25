/** Feedback comments (spec section 5 → Feedback comments). Studio only; never on the live site. */
import { createServerFn } from "@tanstack/react-start";
import { asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { asEditor } from "./access";
import type { JsonObject } from "./shapes";
import type { comments } from "./schema";

export type CommentRow = {
  id: string;
  thread_id: string | null;
  anchor: string;
  opened_on: string;
  device: string;
  body: string;
  author_id: string;
  assignee_id: string | null;
  position: JsonObject | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

const toRow = (r: typeof comments.$inferSelect): CommentRow => ({
  id: r.id,
  thread_id: r.threadId,
  anchor: r.anchor,
  opened_on: r.openedOn,
  device: r.device,
  body: r.body,
  author_id: r.authorId,
  assignee_id: r.assigneeId,
  position: r.position ?? null,
  resolved_at: r.resolvedAt,
  resolved_by: r.resolvedBy,
  created_at: r.createdAt,
  updated_at: r.updatedAt,
});

const id = z.object({ id: z.string() });
const position = z.record(z.string(), z.any()).nullable().optional();

export const listComments = createServerFn({ method: "GET" })
  .middleware([asEditor])
  .handler(async (): Promise<CommentRow[]> => {
    const { db } = await import("./db.server");
    const { comments } = await import("./schema");
    const rows = await (await db()).select().from(comments).orderBy(asc(comments.createdAt));
    return rows.map(toRow);
  });

/** Starts a thread for someone (`assignee_id` is required: every comment is for a person). */
export const startThread = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(
    z.object({
      anchor: z.string().min(1),
      opened_on: z.string().min(1),
      device: z.string(),
      body: z.string().trim().min(1),
      assignee_id: z.string().min(1),
      position,
    }),
  )
  .handler(async ({ data, context }) => {
    const { db, newId } = await import("./db.server");
    const { comments } = await import("./schema");
    const commentId = newId();
    await (await db()).insert(comments).values({
      id: commentId,
      anchor: data.anchor,
      openedOn: data.opened_on,
      device: data.device,
      body: data.body,
      assigneeId: data.assignee_id,
      position: (data.position ?? null) as JsonObject | null,
      authorId: context.user.id,
    });
    return { id: commentId };
  });

export const replyToThread = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ threadId: z.string(), body: z.string().trim().min(1) }))
  .handler(async ({ data, context }) => {
    const { db, newId } = await import("./db.server");
    const { comments } = await import("./schema");
    const d = await db();
    const [root] = await d.select().from(comments).where(eq(comments.id, data.threadId)).limit(1);
    if (!root || root.threadId) throw new Error("That thread no longer exists.");
    await d.insert(comments).values({
      id: newId(),
      threadId: root.id,
      anchor: root.anchor,
      openedOn: root.openedOn,
      device: root.device,
      body: data.body,
      authorId: context.user.id,
    });
    return { ok: true };
  });

export const setThreadResolved = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string(), resolved: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { db, nowIso } = await import("./db.server");
    const { comments } = await import("./schema");
    const at = nowIso();
    await (
      await db()
    )
      .update(comments)
      .set(
        data.resolved
          ? { resolvedAt: at, resolvedBy: context.user.id, updatedAt: at }
          : { resolvedAt: null, resolvedBy: null, updatedAt: at },
      )
      .where(eq(comments.id, data.id));
    return { ok: true };
  });

export const reassignThread = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(z.object({ id: z.string(), assignee_id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db, nowIso } = await import("./db.server");
    const { comments } = await import("./schema");
    await (
      await db()
    )
      .update(comments)
      .set({ assigneeId: data.assignee_id, updatedAt: nowIso() })
      .where(eq(comments.id, data.id));
    return { ok: true };
  });

/** Deletes a comment; deleting a thread's first comment deletes its replies too. */
export const deleteComment = createServerFn({ method: "POST" })
  .middleware([asEditor])
  .inputValidator(id)
  .handler(async ({ data }) => {
    const { db } = await import("./db.server");
    const { comments } = await import("./schema");
    await (
      await db()
    )
      .delete(comments)
      .where(or(eq(comments.id, data.id), eq(comments.threadId, data.id)));
    return { ok: true };
  });
