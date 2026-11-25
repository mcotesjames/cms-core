import type Player from "video.js/dist/types/player";

/**
 * Upgrades any native <video> tags inside article body copy to video.js
 * players with the site theme. Runs client-only (called from useEffect);
 * video.js and its stylesheet are dynamically imported so nothing touches
 * the DOM during SSR. Returns a cleanup that disposes every player.
 */
export async function enhanceVideos(root: ParentNode): Promise<() => void> {
  const videos = Array.from(
    root.querySelectorAll<HTMLVideoElement>(".site-prose video:not(.vjs-tech)"),
  );
  if (videos.length === 0) return () => {};

  const [{ default: videojs }] = await Promise.all([
    import("video.js"),
    import("video.js/dist/video-js.css"),
  ]);

  const players: Player[] = [];
  for (const el of videos) {
    if (!el.classList.contains("video-js")) el.classList.add("video-js", "vjs-site");
    const player = videojs(el, {
      controls: true,
      fluid: true,
      preload: el.getAttribute("preload") ?? "metadata",
      playsinline: true,
    });
    players.push(player);
  }
  return () => {
    for (const player of players) {
      if (!player.isDisposed()) player.dispose();
    }
  };
}
