import { describe, expect, it } from "vitest";
import {
  canvasThreads,
  commentSearch,
  daysUntilRemoved,
  groupThreads,
  isSharedAnchor,
  parsePlace,
  parsePosition,
  profileName,
  timeAgo,
  type CommentRow,
} from "@/lib/comments";

const ID = "93abb102-b909-4dc6-a6ce-550b20c6bd6f";
let n = 0;
const row = (p: Partial<CommentRow>): CommentRow => ({
  id: `c${++n}`,
  thread_id: null,
  anchor: "home:intro.title",
  opened_on: "page:home",
  device: "desktop",
  body: "x",
  author_id: "a",
  assignee_id: "b",
  resolved_at: null,
  resolved_by: null,
  created_at: `2026-10-26T10:0${n % 10}:00Z`,
  updated_at: "2026-10-26T10:00:00Z",
  position: null,
  ...p,
});

describe("comments", () => {
  it("groups replies under their thread, oldest reply first, newest thread first", () => {
    const a = row({ created_at: "2026-10-01T00:00:00Z" });
    const b = row({ created_at: "2026-10-02T00:00:00Z" });
    const r2 = row({ thread_id: a.id, assignee_id: null, created_at: "2026-10-03T00:00:00Z" });
    const r1 = row({ thread_id: a.id, assignee_id: null, created_at: "2026-10-02T12:00:00Z" });
    const t = groupThreads([a, b, r2, r1]);
    expect(t.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(t[1]!.replies.map((x) => x.id)).toEqual([r1.id, r2.id]);
  });

  it("knows which anchors appear on every page", () => {
    expect(isSharedAnchor("menu:m-home")).toBe(true);
    expect(isSharedAnchor("menucol:c-contact")).toBe(true);
    expect(isSharedAnchor("menus:footer")).toBe(true);
    expect(isSharedAnchor("settings:footer_tagline")).toBe(true);
    expect(isSharedAnchor("home:intro.title")).toBe(false);
    expect(isSharedAnchor("page:home")).toBe(false);
    expect(isSharedAnchor(`post:${ID}`)).toBe(false);
  });

  it("shows threads left here plus shared ones on this canvas, numbered by age", () => {
    const here = row({ anchor: "home:intro.title", created_at: "2026-10-01T00:00:00Z" });
    const gone = row({
      anchor: "home:section_data.old.heading",
      created_at: "2026-10-02T00:00:00Z",
    });
    const menu = row({
      anchor: "menu:m-home",
      opened_on: "page:page_about",
      created_at: "2026-10-03T00:00:00Z",
    });
    const elsewhere = row({ anchor: "page_about:intro.title", opened_on: "page:page_about" });
    const page = row({ anchor: "page:home", created_at: "2026-10-04T00:00:00Z" });
    const done = row({ resolved_at: "2026-10-05T00:00:00Z" });
    const found = { "home:intro.title": "Title", "menu:m-home": "Home" };
    const list = canvasThreads(
      groupThreads([here, gone, menu, elsewhere, page, done]),
      "page:home",
      found,
    );
    expect(list.map((t) => [t.id, t.n, t.removed])).toEqual([
      [here.id, 1, false],
      [gone.id, 2, true],
      [menu.id, 3, false],
      [page.id, 4, false],
    ]);
    // A shared thread isn't shown on a canvas where its element doesn't appear.
    expect(canvasThreads(groupThreads([menu]), "page:home", {}).length).toBe(0);
  });

  it("names and links the place a thread was left", () => {
    expect(parsePlace("page:home")).toEqual({ kind: "page", key: "home", label: "Homepage" });
    expect(parsePlace("page:page_about", { pages: { page_about: "About" } })).toEqual({
      kind: "page",
      key: "page_about",
      label: "About",
    });
    expect(parsePlace("page:page_gone")).toMatchObject({ label: "A page that was deleted" });
    expect(parsePlace("page:Not-A-Key")).toBeNull();
    expect(parsePlace(`post:${ID}`)).toBeNull();
    expect(parsePlace("nowhere")).toBeNull();
  });

  it("formats names, ages and the 30-day countdown", () => {
    expect(profileName({ first_name: "Sam", last_name: "Rivera", email: "a@x" })).toBe(
      "Sam Rivera",
    );
    expect(profileName({ first_name: "", last_name: "", email: "a@x" })).toBe("a@x");
    const now = Date.parse("2026-10-26T12:00:00Z");
    expect(timeAgo("2026-10-26T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-26T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-25T12:00:00Z", now)).toBe("1 day ago");
    expect(daysUntilRemoved("2026-10-16T12:00:00Z", now)).toBe(20);
    expect(daysUntilRemoved("2026-09-01T12:00:00Z", now)).toBe(0);
  });

  it("reads the open-in-place search params", () => {
    expect(
      commentSearch({ comment: "c1", device: "mobile", mode: "comment", record: "r1" }),
    ).toEqual({ comment: "c1", device: "mobile", mode: "comment" });
    expect(commentSearch({ comment: 5, device: "watch", mode: "edit" })).toEqual({
      comment: undefined,
      device: undefined,
      mode: undefined,
    });
  });

  it("reads stored pin positions and ignores malformed ones", () => {
    expect(parsePosition({ path: [2, 0], x: 0.4, y: 0.6, ax: 0.1, ay: 0.9 })).toEqual({
      path: [2, 0],
      x: 0.4,
      y: 0.6,
      ax: 0.1,
      ay: 0.9,
    });
    // Older positions without the fallback point use the inner point; values are clamped to 0–1.
    expect(parsePosition({ path: [], x: 1.4, y: -1 })).toEqual({
      path: [],
      x: 1,
      y: 0,
      ax: 1,
      ay: 0,
    });
    for (const bad of [
      null,
      undefined,
      "x",
      [],
      { path: [-1], x: 0, y: 0 },
      { path: [0], x: "a", y: 0 },
      { x: 0, y: 0 },
    ])
      expect(parsePosition(bad)).toBeNull();
  });
});
