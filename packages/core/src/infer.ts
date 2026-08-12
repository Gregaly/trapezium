/**
 * Working out what a column is, when nobody said.
 *
 * This is what makes `<Table data={rows} />` produce something worth looking at
 * rather than a wall of left-aligned strings. It is also the part most likely
 * to be wrong occasionally, so two rules govern it: never guess where being
 * wrong is expensive, and make every guess a one-word override.
 *
 * Pure and deterministic. The same rows always produce the same columns, on a
 * server and in a browser, which is what keeps an inferred table hydrating
 * cleanly.
 */

import type { AnyRow, ColumnDef } from "./types.js"
import { isEmpty } from "./util.js"

/** How many rows are examined. Enough to be representative, cheap enough to be free. */
const SAMPLE_SIZE = 50

/** Keys that name their own type unambiguously, whatever the values look like. */
const KEY_HINTS: Array<[RegExp, string]> = [
  [/^(id|uuid|guid)$|_id$|_uuid$|Id$/i, "id"],
  [/e-?mail/i, "email"],
  // Before the url hint, deliberately: `avatar_url` is an image that happens to
  // be addressed by a URL, and rendering it as a link would be the less useful
  // reading of a column whose name says what it holds.
  [/avatar|photo|picture|image|thumbnail|logo/i, "image"],
  [/^(url|link|href|website|homepage)$|_url$|Url$/i, "url"],
  [/phone|mobile|^tel$|_tel$|fax/i, "phone"],
  [/^(status|state)$|_status$|Status$/i, "badge"],
  [/^(notes?|description|summary|comment|body|content|bio|message)$/i, "longText"],
  [/percent|_pct$|Pct$/i, "percent"],
  // Only where the unit is stated. Guessing that `amount` is money is right
  // often enough to be tempting and wrong often enough to be a bug — a column
  // of quantities suddenly formatted as dollars is worse than plain numbers.
  [/(_cents|_minor|_minor_units)$/i, "currency"],
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/
const CLOCK_TIME = /^\d{1,2}:\d{2}(:\d{2})?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL = /^https?:\/\/\S+$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The type of a column, from its key and a sample of its values.
 *
 * The key is consulted first for the handful of names that mean exactly one
 * thing, then the values decide. A column whose values are all absent is
 * `text`, because an empty column formatted as a date would start lying the
 * moment real data arrived.
 */
export function inferType(key: string, values: unknown[]): string {
  const present = values.filter((value) => !isEmpty(value))

  for (const [pattern, type] of KEY_HINTS) {
    if (pattern.test(key)) {
      // A key hint still has to survive the data. `image` on a column of
      // numbers, or `id` on a column of objects, is a coincidence of naming.
      if (present.length === 0) return type
      if (type === "image" && !present.every((value) => typeof value === "string")) break
      if (type === "currency" && !present.every((value) => typeof value === "number")) break
      if (type === "percent" && !present.every((value) => typeof value === "number")) break
      if (type === "id" && present.some((value) => typeof value === "object")) break
      return type
    }
  }

  if (present.length === 0) return "text"

  if (present.every((value) => typeof value === "boolean")) return "boolean"
  if (present.every((value) => value instanceof Date)) return "datetime"
  if (present.every((value) => typeof value === "number")) return "number"
  if (present.every((value) => Array.isArray(value))) return "tags"

  if (present.every((value) => typeof value === "string")) {
    const strings = present as string[]

    if (strings.every((value) => ISO_DATE.test(value))) return "date"
    if (strings.every((value) => ISO_DATETIME.test(value))) return "datetime"
    if (strings.every((value) => CLOCK_TIME.test(value))) return "time"
    if (strings.every((value) => EMAIL.test(value))) return "email"
    if (strings.every((value) => URL.test(value))) return "url"
    if (strings.every((value) => UUID.test(value))) return "id"

    // Prose needs room to breathe and should never sit in a truncated cell of
    // the same width as a name.
    const longest = strings.reduce((max, value) => Math.max(max, value.length), 0)
    if (longest > 120) return "longText"

    /*
      A short string column with only a handful of distinct values is a
      category, not free text — a state, a plan, a role. Rendering it as a chip
      is what makes an inferred table look designed rather than dumped. The
      thresholds are deliberately conservative: with fewer than twenty rows,
      "few distinct values" is just as likely to be coincidence.
    */
    const distinct = new Set(strings)
    if (strings.length >= 20 && distinct.size <= 6 && longest <= 24) return "badge"

    return "text"
  }

  if (present.every((value) => typeof value === "object" && value !== null)) {
    return present.every((value) => looksLikeAddress(value)) ? "address" : "json"
  }

  // Mixed types. Text is the only honest answer.
  return "text"
}

const ADDRESS_KEYS = ["line1", "street", "city", "suburb", "postcode", "postalCode", "zip", "state", "region", "country"]

function looksLikeAddress(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.some((key) => ADDRESS_KEYS.includes(key))
}

export type InferColumnsOptions = {
  /** Keys to leave out, on top of the ones ignored by default. */
  exclude?: string[]
  /** Keys to include and order explicitly. Everything else is dropped. */
  include?: string[]
}

/**
 * Builds a column per key found in the data.
 *
 * Order follows the first row's own key order, which is the order the API or
 * the database returned — a better default than alphabetical, because it is
 * usually the order somebody already thought about.
 *
 * Keys starting with an underscore are skipped: by convention they are internal
 * (`__typename`, `_links`, `_count`) and nobody wants a column of them.
 */
export function inferColumns<TRow extends AnyRow>(
  rows: readonly TRow[],
  options: InferColumnsOptions = {},
): ColumnDef<TRow>[] {
  const sample = rows.slice(0, SAMPLE_SIZE)
  const exclude = new Set(options.exclude ?? [])

  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of sample) {
    if (row === null || typeof row !== "object") continue
    for (const key of Object.keys(row)) {
      if (seen.has(key) || key.startsWith("_") || exclude.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
  }

  const ordered = options.include ? options.include.filter((key) => seen.has(key)) : keys

  return ordered.map((key) => ({
    key,
    type: inferType(
      key,
      sample.map((row) => (row as AnyRow)[key]),
    ),
  }))
}

/**
 * Distinct values in a column, for a set filter.
 *
 * Ordered by how often each appears, so the values a user is most likely to
 * want are at the top of the list rather than wherever the alphabet put them.
 * Capped, because a set filter over ten thousand distinct values is a search
 * box wearing a costume.
 */
export function distinctValues(
  values: readonly unknown[],
  limit = 200,
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()

  for (const value of values) {
    // A tags column holds several values per row, and each of them is a
    // separate thing to filter by.
    const entries = Array.isArray(value) ? value : [value]
    for (const entry of entries) {
      if (isEmpty(entry)) continue
      const key = String(entry)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
}
