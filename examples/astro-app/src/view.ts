import type { UrlOptions } from "@trapezium/react"

/**
 * How each island's view travels in the shared URL.
 *
 * A prefix per table keeps three tables' parameters apart in one query string;
 * the default page size is the fifteen each table shows.
 */
export function urlOptions(prefix: string): UrlOptions {
  return { prefix, defaults: { pageSize: 15 } }
}

/** The query string part of the page's URL, which is what the codec reads. */
export function queryOf(url: string): string {
  return url.split("?")[1] ?? ""
}

export const COLUMNS = [
  { key: "name", pin: "start" as const },
  { key: "email" },
  { key: "team", filter: "set" as const },
  { key: "salary", type: "currency", filter: "range" as const },
  { key: "started", type: "date" },
  { key: "remote", type: "boolean" },
]
