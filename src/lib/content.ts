import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Accordion = { title: string; body: string };

export const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    // Partners are no longer shown on the site; the data is kept but not read.
    const [p, s, h] = await Promise.all([
      supabase.from("pillars").select("*").order("sort"),
      supabase.from("stack_cards").select("*").order("sort"),
      supabase.from("hotspots").select("*").order("sort"),
    ]);
    const err = p.error || s.error || h.error;
    if (err) throw err;
    return {
      pillars: p.data!.map((x) => ({ ...x, accordions: (x.accordions as Accordion[]) ?? [] })),
      cards: s.data!,
      hotspots: h.data!.map((x) => ({ ...x, items: (x.items as string[]) ?? [] })),
    };
  },
});

/** Every live post column except `draft`, which visitors can't read. */
export const PUBLIC_POST_COLUMNS =
  "id, slug, title, excerpt, body, cover_url, published, published_at, created_at, modules, author, seo";

export const postsQuery = queryOptions({
  queryKey: ["posts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(PUBLIC_POST_COLUMNS)
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const investmentsQuery = queryOptions({
  queryKey: ["investments"],
  queryFn: async () => {
    const { data, error } = await supabase.from("investments").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export const publicationsQuery = queryOptions({
  queryKey: ["publications"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("publications")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .order("sort");
    if (error) throw error;
    return data ?? [];
  },
});

export const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(PUBLIC_POST_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
