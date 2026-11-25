import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isStudioFrame, type StudioMessage } from "@/lib/studio-mode";
import type { PinPosition } from "@/lib/comments";
import { siteContentQuery } from "@/lib/site-content";
import { homeQuery } from "@/lib/content";
import { parseItem, placeInBox } from "@/lib/list-drafts";

/**
 * Runs inside the Content Studio canvas iframe only. Shows draft content from
 * the editor, makes every [data-cms] element editable in place, reports edits
 * and section selection back to the editor, and shows ↑/↓ on reorderable
 * [data-cms-section] elements. Shows draft list items (pillars, cards, hotspots), highlights the
 * selected [data-cms-item], and places a selected hotspot where the biography is clicked.
 * In comment mode, clicks start a comment on the innermost addressable element instead of
 * editing, and open threads show as numbered pins (only in comment mode).
 */
export function StudioBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!isStudioFrame()) return;
    const post = (m: StudioMessage) => window.parent.postMessage(m, window.location.origin);
    document.documentElement.classList.add("studio-live");
    qc.setQueryDefaults(siteContentQuery.queryKey, {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });
    qc.setQueryDefaults(homeQuery.queryKey, { staleTime: Infinity, refetchOnWindowFocus: false });

    // A quick, fading overlay in the selection colour over what was just selected.
    let lastInnerFlash = 0;
    const flash = (el: Element | null, level: "section" | "inner" | "comment") => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (level === "inner") lastInnerFlash = Date.now();
      const d = document.createElement("div");
      d.className = "studio-flash";
      Object.assign(d.style, {
        top: `${r.top}px`,
        left: `${r.left}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        background: `var(--studio-${level})`,
      });
      d.addEventListener("animationend", () => d.remove());
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 1000);
    };

    // ---- Comment mode: anything addressable can carry a comment.
    const ANCHOR =
      "[data-cms],[data-cms-image],[data-cms-record],[data-cms-item],[data-cms-section]";
    const ATTRS = [
      "data-cms",
      "data-cms-image",
      "data-cms-record",
      "data-cms-item",
      "data-cms-section",
    ];
    const anchorOf = (el: HTMLElement) =>
      el.dataset["cms"] ??
      el.dataset["cmsImage"] ??
      el.dataset["cmsRecord"] ??
      el.dataset["cmsItem"] ??
      el.dataset["cmsSection"] ??
      "";
    const findAnchor = (a: string) =>
      document.querySelector<HTMLElement>(ATTRS.map((k) => `[${k}="${CSS.escape(a)}"]`).join(","));
    const kindOf = (el: HTMLElement) => {
      const rec = el.dataset["cmsRecord"];
      if (rec)
        return rec.startsWith("record:investments")
          ? "Investment"
          : rec.startsWith("record:publications")
            ? "Publication"
            : "Insight";
      if (el.dataset["cmsImage"] !== undefined) return "Image";
      if (el.dataset["cms"] !== undefined) return "Text";
      if (el.dataset["cmsItem"]?.startsWith("menu")) return "Menu";
      if (el.dataset["cmsItem"] !== undefined) return "Item";
      return "Section";
    };
    const labelOf = (el: HTMLElement) => {
      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      return text
        ? `${kindOf(el)}: “${text.slice(0, 48)}${text.length > 48 ? "…" : ""}”`
        : kindOf(el);
    };
    let commenting = false;
    let pins: Array<{
      id: string;
      anchor: string;
      n: number;
      active: boolean;
      position: PinPosition | null;
    }> = [];
    let check: string[] = [];
    let lastFound = "";
    let pinLabels: Record<string, string> = {};
    let hiddenPins: string[] = [];
    let pendingPinScroll: { id: string; anchor: string; position: PinPosition | null } | null =
      null;
    let lastScrolled: string | null = null;
    let hoverEl: HTMLElement | null = null;
    // Pins sit outside <body> so drawing them doesn't trigger the page observer below.
    const pinLayer = document.createElement("div");
    pinLayer.className = "studio-pins";
    document.documentElement.appendChild(pinLayer);
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const textOf = (el: HTMLElement) => (el.innerText || "").replace(/\s+/g, " ").trim();
    const snippet = (t: string) => `“${t.slice(0, 48)}${t.length > 48 ? "…" : ""}”`;

    /** Child positions from `root` down to `el` (empty when they're the same). */
    const pathTo = (root: HTMLElement, el: HTMLElement) => {
      const path: number[] = [];
      for (let n: HTMLElement | null = el; n && n !== root; n = n.parentElement) {
        const parent: HTMLElement | null = n.parentElement;
        if (!parent) return [];
        path.unshift(Array.prototype.indexOf.call(parent.children, n));
      }
      return path;
    };
    /** The elements along a stored path, outermost first; stops where the page no longer matches. */
    const walk = (root: HTMLElement, path: number[]) => {
      const chain: HTMLElement[] = [root];
      for (const i of path) {
        const next = chain[chain.length - 1]!.children[i];
        if (!(next instanceof HTMLElement)) break;
        chain.push(next);
      }
      return chain;
    };
    /** Where an element shows on screen, or null when it's hidden or clipped away (closed accordion, card back…). */
    const visibleRect = (el: HTMLElement, root: HTMLElement): DOMRect | null => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      if (
        el.checkVisibility &&
        !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      )
        return null;
      if (el.closest("[aria-hidden='true']") && root.contains(el.closest("[aria-hidden='true']")))
        return null;
      for (let a = el.parentElement; a && a !== root.parentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow === "visible" && cs.overflowY === "visible" && cs.overflowX === "visible")
          continue;
        const ar = a.getBoundingClientRect();
        const w = Math.min(r.right, ar.right) - Math.max(r.left, ar.left);
        const h = Math.min(r.bottom, ar.bottom) - Math.max(r.top, ar.top);
        if (w < 1 || h < 1) return null;
      }
      return r;
    };
    type Placed = { x: number; y: number; target: HTMLElement; hidden: boolean; exact: boolean };
    /** Where a pin goes: the exact spot if its element shows, else hollow on the nearest visible part. */
    const placePin = (root: HTMLElement, pos: PinPosition | null): Placed | null => {
      const rootRect = visibleRect(root, root) ?? root.getBoundingClientRect();
      if (!pos)
        return {
          x: rootRect.right - 4,
          y: rootRect.top + 4,
          target: root,
          hidden: false,
          exact: false,
        };
      const chain = walk(root, pos.path);
      const complete = chain.length === pos.path.length + 1;
      const inner = chain[chain.length - 1]!;
      if (complete) {
        const r = visibleRect(inner, root);
        if (r)
          return {
            x: r.left + pos.x * r.width,
            y: r.top + pos.y * r.height,
            target: inner,
            hidden: false,
            exact: true,
          };
        // Hidden: fall back to the nearest visible element on the way down.
        for (let i = chain.length - 2; i >= 0; i--) {
          const vr = visibleRect(chain[i]!, root);
          if (vr)
            return {
              x: vr.right - 4,
              y: vr.top + 4,
              target: chain[i]!,
              hidden: true,
              exact: false,
            };
        }
        return null;
      }
      // The inner element has gone: the same relative spot on the pinned element.
      return {
        x: rootRect.left + pos.ax * rootRect.width,
        y: rootRect.top + pos.ay * rootRect.height,
        target: root,
        hidden: false,
        exact: true,
      };
    };
    // Pins are kept and moved rather than rebuilt, so a pin under the pointer is never swapped
    // for a new element mid-click (which would swallow the click).
    const pinEls = new Map<string, HTMLButtonElement>();
    const drawPins = () => {
      const keep = new Set<string>();
      document
        .querySelectorAll("[data-comment-active]")
        .forEach((el) => el.removeAttribute("data-comment-active"));
      pinLabels = {};
      hiddenPins = [];
      if (!commenting) {
        pinEls.forEach((b) => b.remove());
        pinEls.clear();
        return;
      }
      const stacked = new Map<HTMLElement, number>();
      for (const p of pins) {
        const root = findAnchor(p.anchor);
        if (!root) continue;
        const at = placePin(root, p.position);
        if (!at) {
          hiddenPins.push(p.id);
          continue;
        }
        if (p.position) {
          const inner = walk(root, p.position.path).pop()!;
          const t = textOf(inner);
          if (inner !== root && t) pinLabels[p.id] = `${kindOf(root)}: ${snippet(t)}`;
        }
        if (at.hidden) hiddenPins.push(p.id);
        // Corner pins on the same element sit side by side; exact pins go where they were placed.
        const k = at.exact ? 0 : (stacked.get(at.target) ?? 0);
        if (!at.exact) stacked.set(at.target, k + 1);
        let b = pinEls.get(p.id);
        if (!b) {
          b = document.createElement("button");
          b.type = "button";
          b.className = "studio-pin";
          b.dataset["pin"] = p.id;
          pinEls.set(p.id, b);
          pinLayer.appendChild(b);
        }
        keep.add(p.id);
        if (b.textContent !== String(p.n)) b.textContent = String(p.n);
        b.setAttribute(
          "aria-label",
          `Comment ${p.n}${at.hidden ? " (inside something closed)" : ""}`,
        );
        if (at.hidden) b.dataset["hidden"] = "true";
        else delete b.dataset["hidden"];
        if (p.active) {
          b.dataset["active"] = "true";
          at.target.setAttribute("data-comment-active", "");
        } else delete b.dataset["active"];
        // The pin's pointed corner (bottom left) marks the spot.
        b.style.left = `${clamp(at.x - (at.exact ? 2 : 24) - k * 30, 4, window.innerWidth - 32)}px`;
        b.style.top = `${clamp(at.y - (at.exact ? 26 : 12), 4, window.innerHeight - 32)}px`;
      }
      for (const [id, b] of pinEls)
        if (!keep.has(id)) {
          b.remove();
          pinEls.delete(id);
        }
    };
    /**
     * Brings the requested thread into view once its element is on the page (the page may still
     * be loading when asked), then tells the editor. Scrolls again shortly after in case images
     * above it load and push it down. Works for resolved threads too (they have no pin).
     */
    const tryScroll = () => {
      const want = pendingPinScroll;
      if (!want) return;
      const root = findAnchor(want.anchor);
      if (!root) return;
      const at = placePin(root, want.position);
      const target = at?.target ?? root;
      pendingPinScroll = null;
      lastScrolled = want.id;
      const go = () => target.scrollIntoView({ block: "center" });
      go();
      setTimeout(go, 600);
      post({ type: "studio-scrolled", id: want.id });
    };
    const reportFound = () => {
      const found: Record<string, string> = {};
      for (const a of check) {
        const el = findAnchor(a);
        if (el) found[a] = labelOf(el);
      }
      const msg = { found, pinLabels, hidden: hiddenPins };
      const key = JSON.stringify(msg);
      if (key !== lastFound) {
        lastFound = key;
        post({ type: "studio-anchors", ...msg });
      }
    };
    // Holding Alt/Option in comment mode: the page behaves normally (see onClick).
    const onAlt = (e: KeyboardEvent) =>
      document.documentElement.classList.toggle("studio-alt", e.altKey);
    const clearAlt = () => document.documentElement.classList.remove("studio-alt");
    let frameReq = 0;
    const refreshComments = () => {
      if (frameReq) return;
      frameReq = requestAnimationFrame(() => {
        frameReq = 0;
        drawPins();
        tryScroll();
        reportFound();
      });
    };
    const setCommenting = (on: boolean) => {
      if (on === commenting) return;
      commenting = on;
      document.documentElement.classList.toggle("studio-commenting", on);
      if (on) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
          el.contentEditable = "false";
        });
        bar.hidden = true;
      } else {
        hoverEl?.removeAttribute("data-comment-hover");
        hoverEl = null;
        mark();
      }
    };

    // The selected list item ("pillars:<id>") and one waiting to be scrolled into view once it renders.
    let selectedItem: string | null = null;
    let selectedSection: string | null = null;
    let pendingFlash: string | null = null;
    let pendingScroll: string | null = null;
    const applyItem = () => {
      document.querySelectorAll<HTMLElement>("[data-cms-item]").forEach((el) => {
        if (el.dataset["cmsItem"] === selectedItem) el.dataset["selected"] = "true";
        else delete el.dataset["selected"];
      });
      if (pendingScroll) {
        const el = document.querySelector<HTMLElement>(
          `[data-cms-item="${CSS.escape(pendingScroll)}"]`,
        );
        if (el) {
          el.scrollIntoView({ block: "center" });
          pendingScroll = null;
        }
      }
      if (pendingFlash) {
        const item = document.querySelector(`[data-cms-item="${CSS.escape(pendingFlash)}"]`);
        if (item) {
          pendingFlash = null;
          requestAnimationFrame(() => flash(item, "inner"));
        }
      }
    };

    // One floating toolbar, placed at the bottom of the hovered section.
    const bar = document.createElement("div");
    bar.className = "studio-section-bar";
    bar.innerHTML = `<button type="button" data-dir="-1" aria-label="Move up">↑</button><button type="button" data-dir="1" aria-label="Move down">↓</button><button type="button" data-add aria-label="Add below">+</button>`;
    bar.hidden = true;
    document.body.appendChild(bar);
    let hovered: HTMLElement | null = null;
    const HOVERABLE = "[data-cms-section][data-cms-reorder], [data-cms-section][data-cms-insert]";
    const sections = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-cms-section][data-cms-reorder]"));
    const place = () => {
      if (commenting || !hovered || !hovered.isConnected) {
        bar.hidden = true;
        return;
      }
      const r = hovered.getBoundingClientRect();
      const visibleBottom = Math.min(r.bottom, window.innerHeight) - 12;
      bar.hidden = r.bottom < 0 || r.top > window.innerHeight;
      bar.style.top = `${Math.max(r.top + 12, visibleBottom - 36)}px`;
      bar.style.left = `${r.left + r.width / 2}px`;
      const reorder = "cmsReorder" in hovered.dataset;
      const [up, down, add] = Array.from(bar.children) as HTMLButtonElement[];
      up!.hidden = down!.hidden = !reorder;
      add!.hidden = !("cmsInsert" in hovered.dataset);
      const all = sections();
      const i = all.indexOf(hovered);
      up!.disabled = i <= 0;
      down!.disabled = i === all.length - 1;
    };
    const onOver = (e: MouseEvent) => {
      if (commenting) {
        const el = (e.target as HTMLElement).closest?.<HTMLElement>(ANCHOR) ?? null;
        if (el !== hoverEl) {
          hoverEl?.removeAttribute("data-comment-hover");
          hoverEl = el;
          el?.setAttribute("data-comment-hover", "");
        }
        return;
      }
      if (bar.contains(e.target as Node)) return;
      const s = (e.target as HTMLElement).closest<HTMLElement>(HOVERABLE);
      if (s !== hovered) {
        hovered = s;
        place();
      }
    };

    // The latest drafts from the editor. The page reloads its live content in the background
    // (e.g. just after it loads), which would replace a draft already shown; re-apply the drafts
    // whenever that happens, so the canvas always shows the draft.
    let draftContent: Record<string, unknown> | null = null;
    let draftLists: Record<string, unknown[]> | null = null;
    const applyDrafts = () => {
      if (draftContent) {
        const content = draftContent;
        qc.setQueryData(
          siteContentQuery.queryKey,
          (old) => ({ ...(old ?? {}), ...content }) as never,
        );
      }
      if (draftLists) {
        const lists = draftLists;
        qc.setQueryData(homeQuery.queryKey, (old) => ({ ...(old ?? {}), ...lists }) as never);
      }
    };
    const watched = [siteContentQuery.queryKey[0], homeQuery.queryKey[0]];
    const unsubscribeCache = qc.getQueryCache().subscribe((event) => {
      // Only real fetches: our own setQueryData calls are "manual" and would otherwise loop.
      if (
        event.type === "updated" &&
        event.action.type === "success" &&
        !(event.action as { manual?: boolean }).manual &&
        watched.includes(event.query.queryKey[0] as never)
      )
        applyDrafts();
    });

    const onMessage = (e: MessageEvent<StudioMessage>) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "studio-content") {
        draftContent = e.data.content;
        if (e.data.lists) draftLists = e.data.lists;
        applyDrafts();
        requestAnimationFrame(() => {
          place();
          applyItem();
        });
      }
      if (e.data?.type === "studio-comments") {
        setCommenting(e.data.on);
        pins = e.data.pins;
        check = e.data.check;
        // Each thread is scrolled to once per request, however often the editor re-sends it.
        if (!e.data.scrollTo) lastScrolled = null;
        else if (e.data.scrollTo.id !== lastScrolled) pendingPinScroll = e.data.scrollTo;
        refreshComments();
      }
      if (e.data?.type === "studio-selected") {
        const want = e.data.section;
        const item = e.data.item ?? null;
        // Flash the most specific thing that is newly selected: the item, else the section
        // (unless an inner element was just flashed by the click itself).
        if (item && item !== selectedItem) pendingFlash = item;
        else if (want && want !== selectedSection && Date.now() - lastInnerFlash > 400) {
          flash(document.querySelector(`[data-cms-section="${CSS.escape(want)}"]`), "section");
        }
        selectedSection = want;
        document.querySelectorAll<HTMLElement>("[data-cms-section]").forEach((el) => {
          if (el.dataset["cmsSection"] === want) el.dataset["selected"] = "true";
          else delete el.dataset["selected"];
        });
        selectedItem = item;
        if (e.data.scroll && selectedItem) pendingScroll = selectedItem;
        requestAnimationFrame(applyItem);
      }
    };
    const mark = () => {
      if (commenting) return;
      document.querySelectorAll<HTMLElement>("[data-cms]").forEach((el) => {
        if (el.contentEditable !== "plaintext-only" && el.contentEditable !== "true") {
          try {
            el.contentEditable = "plaintext-only";
          } catch {
            el.contentEditable = "true";
          }
          el.spellcheck = true;
        }
      });
    };
    // Only text actually typed on the canvas is reported back. A field that was merely clicked
    // (to open it in the panel) and then edited in the panel must not send its old text on blur,
    // or it would undo the panel edit.
    const typed = new WeakSet<HTMLElement>();
    const onInput = (e: Event) => {
      const el = (e.target as HTMLElement).closest?.<HTMLElement>("[data-cms]");
      if (el) typed.add(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cms]");
      if (!el || !typed.has(el)) return;
      typed.delete(el);
      post({
        type: "studio-edit",
        field: el.dataset["cms"]!,
        value: el.innerText.replace(/\u00a0/g, " ").trim(),
      });
    };
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K opens the editor's page switcher, even while the canvas has focus.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        post({ type: "studio-shortcut", key: "switcher" });
        return;
      }
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-cms]");
      if (el && e.key === "Enter" && !("cmsMultiline" in el.dataset)) {
        e.preventDefault();
        el.blur();
      }
      if (el && e.key === "Escape") el.blur();
      else if (e.key === "Escape") post({ type: "studio-select", section: null });
    };
    // Links don't navigate while editing; images ask the editor for an upload; clicks select their section.
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (commenting && e.altKey) {
        // Alt/Option-click uses the page as normal (open an accordion, flip a card) without
        // leaving comment mode. Links still don't navigate.
        if (t.closest("a")) e.preventDefault();
        return;
      }
      if (commenting) {
        // Nothing on the page reacts to clicks while commenting: links, buttons and editing all pause.
        e.preventDefault();
        e.stopPropagation();
        const pin = t.closest<HTMLElement>(".studio-pin");
        if (pin) {
          post({ type: "studio-pin", id: pin.dataset["pin"]! });
          return;
        }
        const el = t.closest<HTMLElement>(ANCHOR);
        if (!el) return;
        // Remember the exact spot: the element under the pointer (inside the pinned element) and
        // where in it, plus the same point on the pinned element in case the inner one goes.
        const inner = t instanceof HTMLElement && el.contains(t) ? t : el;
        const ir = inner.getBoundingClientRect();
        const ar = el.getBoundingClientRect();
        const f = (v: number) => Math.round(clamp(v, 0, 1) * 1000) / 1000;
        const position: PinPosition = {
          path: pathTo(el, inner),
          x: f((e.clientX - ir.left) / (ir.width || 1)),
          y: f((e.clientY - ir.top) / (ir.height || 1)),
          ax: f((e.clientX - ar.left) / (ar.width || 1)),
          ay: f((e.clientY - ar.top) / (ar.height || 1)),
        };
        const innerText = inner !== el ? textOf(inner) : "";
        flash(inner, "comment");
        post({
          type: "studio-comment-at",
          anchor: anchorOf(el),
          label: innerText ? `${kindOf(el)}: ${snippet(innerText)}` : labelOf(el),
          position,
        });
        return;
      }
      const arrow = t.closest<HTMLButtonElement>(".studio-section-bar button");
      if (arrow) {
        e.preventDefault();
        e.stopPropagation();
        if (!hovered) return;
        const section = hovered.dataset["cmsSection"]!;
        if ("add" in arrow.dataset) post({ type: "studio-insert", section });
        else post({ type: "studio-move", section, dir: Number(arrow.dataset["dir"]) as -1 | 1 });
        return;
      }
      // With a hotspot selected, a click in the biography moves that hotspot there.
      const bio = t.closest<HTMLElement>(".site-bio-inner");
      if (bio && parseItem(selectedItem)?.list === "hotspots" && !t.closest(".site-bio-point")) {
        e.preventDefault();
        e.stopPropagation();
        const { x, y } = placeInBox(bio.getBoundingClientRect(), e.clientX, e.clientY);
        post({ type: "studio-place", item: selectedItem!, x, y });
        return;
      }
      const section = t.closest<HTMLElement>("[data-cms-section]")?.dataset["cmsSection"] ?? null;
      const field =
        t.closest<HTMLElement>("[data-cms]")?.dataset["cms"] ??
        t.closest<HTMLElement>("[data-cms-image]")?.dataset["cmsImage"];
      const item = t.closest<HTMLElement>("[data-cms-item]")?.dataset["cmsItem"];
      post({ type: "studio-select", section, field, item });
      const img = t.closest<HTMLElement>("[data-cms-image]");
      const text = t.closest<HTMLElement>("[data-cms]");
      if (img || text) flash(img ?? text, "inner");
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        post({ type: "studio-image", field: img.dataset["cmsImage"]! });
        return;
      }
      const a = t.closest("a");
      if (a) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    mark();
    // Re-apply the item selection whenever the page re-renders (e.g. a just-added item appears).
    const obs = new MutationObserver(() => {
      mark();
      applyItem();
      refreshComments();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("message", onMessage);
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    // Pins also follow things opening and closing (accordions, card backs, hotspot panels):
    // their state attributes, and the end of their transitions.
    const stateObs = new MutationObserver(refreshComments);
    stateObs.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-open", "aria-hidden", "aria-expanded", "hidden", "open"],
    });
    // (Ignoring the pins' own hover animation, which would otherwise redraw them in a loop.)
    const onTransitionEnd = (e: TransitionEvent) => {
      if (!pinLayer.contains(e.target as Node)) refreshComments();
    };
    document.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("keydown", onAlt);
    window.addEventListener("keyup", onAlt);
    window.addEventListener("blur", clearAlt);
    window.addEventListener("scroll", refreshComments, { passive: true });
    window.addEventListener("resize", refreshComments);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKey);
    post({ type: "studio-ready" });
    return () => {
      obs.disconnect();
      unsubscribeCache();
      bar.remove();
      pinLayer.remove();
      cancelAnimationFrame(frameReq);
      stateObs.disconnect();
      document.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("keydown", onAlt);
      window.removeEventListener("keyup", onAlt);
      window.removeEventListener("blur", clearAlt);
      window.removeEventListener("scroll", refreshComments);
      window.removeEventListener("resize", refreshComments);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("input", onInput);
      document.removeEventListener("keydown", onKey);
    };
  }, [qc]);
  return null;
}
