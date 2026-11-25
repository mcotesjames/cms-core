/** Shared types for the data layer. */

/** Any JSON value: what server functions may return and what JSON columns hold. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
