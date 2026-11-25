import { queryOptions } from "@tanstack/react-query";
import { getListItems, getPostBySlug, getPublishedPosts, getRecords } from "@/data/content";
import type { Post, RecordItem } from "@/data/shapes";

export type Accordion = { title: string; body: string };

export type Pillar = {
  id: string;
  sort: number;
  title: string;
  tagline: string;
  body: string;
  image_url: string;
  accordions: Accordion[];
};
export type StackCard = {
  id: string;
  sort: number;
  title: string;
  body: string;
  image_url: string;
};
export type Hotspot = {
  id: string;
  sort: number;
  label: string;
  body: string;
  items: string[];
  link_url: string;
  x: number;
  y: number;
};
export type Investment = {
  id: string;
  name: string;
  description: string;
  sector: string;
  stage: string;
  logo_url: string;
  website_url: string;
  is_placeholder: boolean;
};
export type PublicationRow = {
  id: string;
  title: string;
  kind: string;
  year: string;
  month: string | null;
  outlet: string | null;
  coauthors: string | null;
  summary: string;
  url: string;
  pdf: string | null;
  featured: boolean;
  sort: number;
  is_placeholder: boolean;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The section lists shown on pages (pillars, stacking cards, biography hotspots). */
export const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const lists = await getListItems();
    return {
      pillars: (lists["pillars"] ?? []).map((x) => ({
        ...x,
        accordions: (x["accordions"] as Accordion[]) ?? [],
      })) as unknown as Pillar[],
      cards: (lists["cards"] ?? []) as unknown as StackCard[],
      hotspots: (lists["hotspots"] ?? []).map((x) => ({
        ...x,
        items: (x["items"] as string[]) ?? [],
      })) as unknown as Hotspot[],
    };
  },
});

export const postsQuery = queryOptions({
  queryKey: ["posts"],
  queryFn: (): Promise<Post[]> => getPublishedPosts(),
});

export const investmentsQuery = queryOptions({
  queryKey: ["investments"],
  queryFn: async () => {
    const rows = await getRecords({ data: { table: "investments" } });
    return (rows as unknown as Investment[]).sort((a, b) => str(a.name).localeCompare(str(b.name)));
  },
});

/** Newest first (year, then month), then by manual order. */
export const sortPublications = (rows: RecordItem[]) =>
  (rows as unknown as PublicationRow[]).sort(
    (a, b) =>
      str(b.year).localeCompare(str(a.year)) ||
      str(b.month).localeCompare(str(a.month)) ||
      (a.sort ?? 0) - (b.sort ?? 0),
  );

export const publicationsQuery = queryOptions({
  queryKey: ["publications"],
  queryFn: async () => sortPublications(await getRecords({ data: { table: "publications" } })),
});

export const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: (): Promise<Post | null> => getPostBySlug({ data: { slug } }),
  });
