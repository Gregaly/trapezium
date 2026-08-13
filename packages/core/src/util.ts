/**
 * Small shared helpers. No dependencies, no DOM, no surprises.
 */

/**
 * Whether a value counts as absent.
 *
 * An empty string and an empty array are absent, because a user reading a table
 * cannot tell them apart from null and does not want to. `0` and `false` are
 * emphatically present — treating them as empty is the classic bug that makes a
 * table show "—" for a real zero.
 */
export function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "number" && Number.isNaN(value))
  )
}

/**
 * A key turned into a header a person would write.
 *
 * `created_at` → "Created at", `firstName` → "First name", `id` → "ID",
 * `org.name` → "Name". Acronyms stay upper case because "Id" and "Url" look
 * like mistakes.
 */
export function humanise(key: string): string {
  const last = key.split(".").pop() ?? key
  const spaced = last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()

  if (spaced === "") return key

  const words = spaced.split(/\s+/).map((word, index) => {
    const upper = word.toUpperCase()
    if (ACRONYMS.has(upper)) return upper
    if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    return word.toLowerCase()
  })

  return words.join(" ")
}

const ACRONYMS = new Set(["ID", "URL", "URI", "API", "UUID", "SKU", "VAT", "GST", "PDF", "CSV", "IP", "UI"])

/**
 * Reads a dotted path off a row.
 *
 * Stops at the first missing link rather than throwing, because a table renders
 * whatever it is handed and half-populated data is normal.
 */
export function getPath(row: unknown, path: string): unknown {
  if (row === null || row === undefined) return undefined
  if (!path.includes(".")) return (row as Record<string, unknown>)[path]

  let current: unknown = row
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * Compares two values of unknown type, for sorting.
 *
 * Empty values always sort last regardless of direction — a column of dates
 * with a few blanks should not put the blanks first when reversed, because the
 * user asked to see the newest, not the missing.
 */
export function compareUnknown(a: unknown, b: unknown): number {
  const aEmpty = isEmpty(a)
  const bEmpty = isEmpty(b)
  if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1

  if (typeof a === "number" && typeof b === "number") return a - b
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()

  return collator().compare(String(a), String(b))
}

/**
 * Locale-aware string comparison, so "item 10" sorts after "item 9" and
 * accented names land where a reader expects.
 *
 * Built once: constructing an `Intl.Collator` per comparison is the single
 * slowest thing a naive sort implementation does.
 */
let cachedCollator: Intl.Collator | undefined
function collator(): Intl.Collator {
  cachedCollator ??= new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
  return cachedCollator
}

/** Case- and accent-insensitive containment, for search and text filters. */
export function textIncludes(haystack: string, needle: string): boolean {
  return createTextMatcher(needle)(haystack)
}

/**
 * A reusable test for one query.
 *
 * Folding a string — decomposing it, stripping the accents, lower-casing it —
 * costs far more than the comparison it prepares for, and search does it once
 * per cell. This prepares the query once and takes a fast path for text that
 * has no accents to strip, which is nearly all of it: for pure ASCII, folding
 * *is* lower-casing, so the cheap comparison is not an approximation but the
 * same answer arrived at sooner.
 */
export function createTextMatcher(query: string): (text: string) => boolean {
  const lower = query.toLowerCase()
  const folded = fold(query)
  const plainQuery = isAscii(query)

  return (text: string) => {
    if (plainQuery && isAscii(text)) return text.toLowerCase().includes(lower)
    return fold(text).includes(folded)
  }
}

const NON_ASCII = /[^\u0000-\u007f]/

function isAscii(value: string): boolean {
  return !NON_ASCII.test(value)
}

export function textEquals(a: string, b: string): boolean {
  return fold(a) === fold(b)
}

export function textStartsWith(haystack: string, needle: string): boolean {
  return fold(haystack).startsWith(fold(needle))
}

export function textEndsWith(haystack: string, needle: string): boolean {
  return fold(haystack).endsWith(fold(needle))
}

/**
 * Normalises text for comparison: lower case, and accents stripped.
 *
 * Searching "jose" must find "José". `normalize("NFD")` splits a letter from its
 * accent so the accent can be removed on its own.
 */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/** Clamps a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** A shallow-equality check used to skip no-op state updates. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false

  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) return false

  return aKeys.every((key) =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}
