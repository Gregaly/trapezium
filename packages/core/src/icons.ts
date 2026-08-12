/**
 * The icon set.
 *
 * Path data only, on a 16×16 grid, drawn as strokes in `currentColor`. Every
 * adapter renders them the same way:
 *
 * ```html
 * <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
 *      stroke-linecap="round" stroke-linejoin="round"><path d="…" /></svg>
 * ```
 *
 * Drawn here rather than pulled from an icon library on purpose. A table
 * library that depends on lucide forces that dependency, and its version, on
 * every consumer — and a Vue user should not be installing a React icon set to
 * get a sort arrow. A round dot is `M8 8h.01` with a round line cap, which is
 * why some of these look shorter than they should.
 */

export const ICONS = {
  // Field types
  text: "M3 4.5h10M8 4.5v7",
  longText: "M3 4h10M3 8h10M3 12h6",
  number: "M6 3v10M10 3v10M3 6h10M3 10h10",
  currency: "M8 3v10M10.5 5.6C10.5 4.6 9.4 4 8 4S5.5 4.7 5.5 5.9 6.9 7.4 8 7.7s2.5.8 2.5 2S9.4 11.5 8 11.5s-2.5-.6-2.5-1.6",
  percent: "M12.5 3.5l-9 9M5.2 3.5h.01M10.8 12.5h.01",
  boolean: "M3 4.5A1.5 1.5 0 014.5 3h7A1.5 1.5 0 0113 4.5v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 11.5zM5.5 8l1.7 1.7L10.5 6.4",
  date: "M2.5 5A1.5 1.5 0 014 3.5h8A1.5 1.5 0 0113.5 5v6.5A1.5 1.5 0 0112 13H4a1.5 1.5 0 01-1.5-1.5zM2.5 6.5h11M5.5 2v3M10.5 2v3",
  datetime: "M2.5 5A1.5 1.5 0 014 3.5h8A1.5 1.5 0 0113.5 5v6.5A1.5 1.5 0 0112 13H4a1.5 1.5 0 01-1.5-1.5zM2.5 6.5h11M5.5 2v3M10.5 2v3M8 8.5v2l1.5 1",
  time: "M8 2.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM8 5v3.2l2.2 1.3",
  relativeTime: "M2.6 8a5.5 5.5 0 105.4-5.5A5.5 5.5 0 003.2 5M2.5 2.5v3h3M8 5.2V8l2 1.2",
  select: "M8 2.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM8 8h.01",
  tags: "M2.5 7.6V4a1.5 1.5 0 011.5-1.5h3.6c.4 0 .8.2 1 .4l4.5 4.5a1.5 1.5 0 010 2.1l-3.6 3.6a1.5 1.5 0 01-2.1 0L2.9 8.6a1.5 1.5 0 01-.4-1zM5.2 5.2h.01",
  email: "M2.5 5A1.5 1.5 0 014 3.5h8A1.5 1.5 0 0113.5 5v6a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 11zM2.8 5.2L8 9l5.2-3.8",
  url: "M6.5 4.5h2a3.5 3.5 0 010 7h-2M9.5 11.5h-2a3.5 3.5 0 010-7h2M5.5 8h5",
  phone: "M4.4 2.5h1.9l1 2.9-1.4 1a8.3 8.3 0 003.7 3.7l1-1.4 2.9 1v1.9c0 .8-.7 1.5-1.5 1.4A11 11 0 013 4.1c-.1-.8.6-1.6 1.4-1.6z",
  image: "M2.5 4.5A1.5 1.5 0 014 3h8a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0112 13H4a1.5 1.5 0 01-1.5-1.5zM2.7 10.6l2.8-2.7 2.4 2.4 2-2 3.4 3.4M6 6.2h.01",
  badge: "M4.5 5h7a3 3 0 010 6h-7a3 3 0 010-6z",
  json: "M6.2 2.5c-1.4 0-2 .7-2 1.9v1.3c0 .9-.5 1.3-1.4 1.3.9 0 1.4.4 1.4 1.3v1.3c0 1.2.6 1.9 2 1.9M9.8 2.5c1.4 0 2 .7 2 1.9v1.3c0 .9.5 1.3 1.4 1.3-.9 0-1.4.4-1.4 1.3v1.3c0 1.2-.6 1.9-2 1.9",
  code: "M6 5L3 8l3 3M10 5l3 3-3 3",
  id: "M2.5 5.5A1.5 1.5 0 014 4h8a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0112 12H4a1.5 1.5 0 01-1.5-1.5zM5 8h6",
  address: "M13 7c0 3.2-5 8-5 8S3 10.2 3 7a5 5 0 0110 0zM8 7h.01",
  file: "M11.6 7.4l-4.1 4.1a2.5 2.5 0 01-3.6-3.6l5-5a1.7 1.7 0 012.4 2.4l-5 5a.8.8 0 01-1.2-1.2l4.4-4.4",

  // Controls
  sortAscending: "M8 12.5v-9M4.5 7L8 3.5 11.5 7",
  sortDescending: "M8 3.5v9M4.5 9L8 12.5 11.5 9",
  chevronDown: "M4 6.5L8 10.5l4-4",
  chevronUp: "M4 9.5L8 5.5l4 4",
  chevronLeft: "M9.5 3.5L5.5 8l4 4.5",
  chevronRight: "M6.5 3.5L10.5 8l-4 4.5",
  chevronsLeft: "M7.5 3.5L3.5 8l4 4.5M12.5 3.5L8.5 8l4 4.5",
  chevronsRight: "M8.5 3.5L12.5 8l-4 4.5M3.5 3.5L7.5 8l-4 4.5",
  check: "M3.5 8.5l3 3 6-7",
  close: "M4 4l8 8M12 4l-8 8",
  filter: "M2.5 4h11l-4.2 5v4.2L6.7 12V9z",
  search: "M7.2 2.5a4.7 4.7 0 110 9.4 4.7 4.7 0 010-9.4zM10.7 10.7l2.8 2.8",
  columns: "M2.5 4A1.5 1.5 0 014 2.5h8A1.5 1.5 0 0113.5 4v8a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 12zM6.5 2.5v11M10 2.5v11",
  eyeOff: "M2 2l12 12M6.5 6.6A2 2 0 008 10a2 2 0 001.4-.6M4 4.7A8.6 8.6 0 001 8s2.6 4 7 4c1.2 0 2.3-.3 3.2-.8M7 4.1A6.5 6.5 0 018 4c4.4 0 7 4 7 4a11 11 0 01-1.9 2.2",
  grip: "M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01",
  pin: "M9.5 2.5l4 4-1.6.5-2.6 2.6-.3 2.5-4.6-4.6 2.5-.3L9.5 3zM5.6 10.4L2.5 13.5",
  download: "M8 2.5v7M5 7l3 3 3-3M3 12.5h10",
  copy: "M5.5 5.5A1.5 1.5 0 017 4h5a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0112 12H7a1.5 1.5 0 01-1.5-1.5zM3.5 10.5A1.5 1.5 0 012.5 9V4A1.5 1.5 0 014 2.5h5a1.5 1.5 0 011.4 1",
  plus: "M8 3.5v9M3.5 8h9",
  minus: "M3.5 8h9",
  arrowLeft: "M12.5 8h-9M7 3.5L3.5 8 7 12.5",
  arrowRight: "M3.5 8h9M9 3.5L12.5 8 9 12.5",
  spinner: "M8 2.5a5.5 5.5 0 015.5 5.5",
  warning: "M8 2.8l5.5 9.7H2.5zM8 6.8v2.4M8 11h.01",
  empty: "M2.5 4.6L8 2l5.5 2.6L8 7.2zM2.5 4.6v6.8L8 14V7.2M13.5 4.6v6.8L8 14",
} as const

/** Every icon this library knows how to draw. */
export type IconName = keyof typeof ICONS

/** Unknown names fall back rather than throwing — an icon is never load-bearing. */
export function iconPath(name: string | false | undefined): string | undefined {
  if (!name) return undefined
  return Object.hasOwn(ICONS, name) ? ICONS[name as IconName] : undefined
}
