// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pauseTransitionScroll,
  prepareTransitionPage,
  registerTransitionScroller,
  resumeTransitionScroll,
} from "@/lib/transition-scroll";

afterEach(() => {
  resumeTransitionScroll();
  vi.useRealTimers();
});

describe("page transition scroll", () => {
  it("resets a reused article scroller to zero before the incoming snapshot, not after the swipe", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const scrollTo = vi.fn(() => events.push("reset"));
    const unregister = registerTransitionScroller({
      stop: () => events.push("stop"),
      start: () => events.push("resume"),
      scrollTo,
    });
    pauseTransitionScroll();
    const ready = prepareTransitionPage(async () => {
      events.push("loaded");
    }, "").then(() => events.push("snapshot"));
    await vi.runAllTimersAsync();
    await ready;
    expect(scrollTo).toHaveBeenCalledWith(0, { immediate: true, force: true });
    expect(events).toEqual(["stop", "loaded", "reset", "snapshot"]);
    resumeTransitionScroll();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    unregister();
  });
});
