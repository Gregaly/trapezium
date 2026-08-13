/**
 * The full-spectrum dataset.
 *
 * One row shape carrying every built-in type, two custom types, and every
 * awkward value that turns up in real data: nulls, empty strings, empty arrays,
 * zero, false, numbers stored as text, dates in four different shapes, accents,
 * emoji, and strings long enough to be prose.
 *
 * Deterministic, so a failing case is reproducible from its seed alone. Used by
 * the conformance suite, the integrity suite and the benchmarks, so all three
 * are arguing about the same data.
 */

import type { ColumnDef, SelectOption, TypeDef } from "../index.js"
import { defineType } from "../index.js"

export type Row = {
  id: string
  name: string
  bio: string | null
  count: number | null
  amountCents: number
  ratio: number
  active: boolean | null
  birthday: string | null
  seenAt: string | Date | number | null
  startsAt: string | null
  updatedAt: string
  plan: string
  status: string
  tags: string[]
  email: string | null
  website: string | null
  phone: string | null
  avatar: string
  reference: string
  snippet: string
  home: { line1: string; city: string; postcode: string } | null
  attachment: { name: string; size: number } | null
  payload: Record<string, unknown> | null
  /** Custom type: a version string that must sort numerically per segment. */
  version: string
  /** Custom type: a priority whose order is neither alphabetical nor numeric. */
  priority: string
  /** No type at all — sorted by a comparator on the column itself. */
  seat: string
}

export const PLANS: SelectOption[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Professional" },
  { value: "team", label: "Team" },
  { value: "enterprise", label: "Enterprise" },
]

export const STATUSES: SelectOption[] = [
  { value: "active", label: "Active", colour: "#3f6b4a" },
  { value: "paused", label: "Paused", colour: "#9a6b1f" },
  { value: "closed", label: "Closed", colour: "#97362b" },
]

export const TAG_POOL = ["urgent", "new", "renewal", "referred", "vip"]

const NAMES = [
  "Ada Lovelace", "Tom Kerrigan", "Zoë Marchetti", "bea whitlock", "Idris Nasser",
  "JUNE OKAFOR", "Marcus Bell", "Priya Raman", "Sven Halvorsen", "Wren Ashby",
  "Émile Rousseau", "Ólafur Jónsson", "陳大文", "Ann-Marie O'Neill", "José García",
  "Иван Петров", "🎉 Party Planner", "  Padded Name  ", "", "Ada Lovelace",
]

const PRIORITIES = ["blocker", "high", "normal", "low", "someday"]

/** The order a priority column must sort in, which no default rule would guess. */
export const PRIORITY_ORDER = new Map(PRIORITIES.map((value, index) => [value, index]))

/**
 * A deterministic generator.
 *
 * `Math.random` would make a failure impossible to reproduce, and a test that
 * cannot be reproduced is a rumour.
 */
export function pseudoRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return value / 4_294_967_296
  }
}

/**
 * Builds `count` rows.
 *
 * Roughly one value in eight is missing, in whichever way that type can be
 * missing — null, an empty string, an empty array — because the handling of
 * absent values is where table libraries usually go wrong.
 */
export function makeRows(count: number, seed = 1): Row[] {
  const random = pseudoRandom(seed)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!
  const maybe = (probability = 0.12) => random() < probability

  const startOfYear = Date.UTC(2026, 0, 1)

  return Array.from({ length: count }, (_, index) => {
    const name = pick(NAMES)
    const seen = new Date(startOfYear + Math.floor(random() * 300) * 86_400_000 + Math.floor(random() * 86_400_000))

    /* The same instant, delivered four different ways, because APIs do. */
    const seenAt: Row["seenAt"] = maybe(0.08)
      ? null
      : index % 4 === 0
        ? seen.toISOString()
        : index % 4 === 1
          ? seen
          : index % 4 === 2
            ? seen.getTime()
            : Math.floor(seen.getTime() / 1000)

    return {
      id: `row_${String(index).padStart(5, "0")}`,
      name,
      bio: maybe() ? null : maybe(0.2) ? "" : "A biography long enough to be prose. ".repeat(1 + Math.floor(random() * 6)),
      count: maybe() ? null : Math.floor(random() * 1000) - 200,
      amountCents: Math.floor(random() * 5_000_00) - 50_00,
      ratio: Math.round(random() * 10_000) / 100,
      active: maybe() ? null : random() > 0.5,
      birthday: maybe()
        ? null
        : new Date(Date.UTC(1970 + Math.floor(random() * 50), Math.floor(random() * 12), 1 + Math.floor(random() * 28)))
            .toISOString()
            .slice(0, 10),
      seenAt,
      startsAt: maybe() ? null : `${String(Math.floor(random() * 24)).padStart(2, "0")}:${String(Math.floor(random() * 60)).padStart(2, "0")}`,
      updatedAt: new Date(startOfYear + Math.floor(random() * 300) * 86_400_000).toISOString(),
      plan: pick(PLANS).value,
      status: pick(STATUSES).value,
      tags: maybe(0.18) ? [] : TAG_POOL.filter(() => random() > 0.7),
      email: maybe() ? null : `${name.split(" ")[0]?.toLowerCase().replace(/[^a-z]/g, "") || "x"}${index}@example.com`,
      website: maybe() ? null : `https://example.com/${index}`,
      phone: maybe() ? null : `+61 4${String(Math.floor(random() * 100_000_000)).padStart(8, "0")}`,
      avatar: `https://example.com/avatar/${index}.png`,
      reference: `REF-${String(2026_000 + index)}`,
      snippet: `const value = ${index}`,
      home: maybe()
        ? null
        : { line1: `${1 + Math.floor(random() * 200)} Test Street`, city: pick(["Sydney", "Melbourne", "Perth"]), postcode: String(2000 + Math.floor(random() * 800)) },
      attachment: maybe() ? null : { name: `document-${index}.pdf`, size: Math.floor(random() * 5_000_000) },
      payload: maybe(0.5) ? null : { nested: { index }, flag: random() > 0.5 },
      version: `${Math.floor(random() * 12)}.${Math.floor(random() * 20)}.${Math.floor(random() * 100)}`,
      priority: pick(PRIORITIES),
      seat: `${pick(["A", "B", "C"])}${1 + Math.floor(random() * 30)}`,
    }
  })
}

/* ── Custom types, declared through the public API ───────────────────────── */

/**
 * A version number.
 *
 * Sorts by each segment numerically, which no built-in rule would get right:
 * as text, "10.0.0" comes before "9.0.0".
 */
export const semver: TypeDef = defineType({
  name: "semver",
  mono: true,
  filter: "text",
  operators: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "contains", "empty", "notEmpty"],
  icon: "code",
  // Packed into one number so the whole ordering — and every comparison a
  // filter makes — falls out of a single value.
  normalise: (value) => (typeof value === "string" ? versionRank(value) : null),
  format: (value) => String(value),
})

export function versionRank(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number(part) || 0)
  return major * 1_000_000 + minor * 1_000 + patch
}

/**
 * A priority.
 *
 * Ordered by importance rather than by the alphabet, and filtered by the label
 * the user can see.
 */
export const priority: TypeDef = defineType({
  name: "priority",
  filter: "set",
  operators: ["eq", "ne", "in", "notIn", "lt", "lte", "gt", "gte", "empty", "notEmpty"],
  icon: "select",
  normalise: (value) => (typeof value === "string" ? (PRIORITY_ORDER.get(value) ?? null) : null),
  format: (value) => (typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : ""),
})

export const customTypes: Record<string, TypeDef> = { semver, priority }

/**
 * A seat number, sorted by a comparator on the column itself rather than by a
 * type — the other half of the customisation surface.
 *
 * "B2" must come before "B10", which no text comparison gives you.
 */
export function compareSeats(a: unknown, b: unknown): number {
  const parse = (value: unknown) => {
    const match = /^([A-Z]+)(\d+)$/.exec(String(value ?? ""))
    return match ? { row: match[1]!, number: Number(match[2]) } : { row: "", number: 0 }
  }

  const left = parse(a)
  const right = parse(b)
  return left.row.localeCompare(right.row) || left.number - right.number
}

/** Every column, one per type, as a caller would write them. */
export const columns: ColumnDef<Row>[] = [
  { key: "id", type: "id" },
  { key: "name", type: "text" },
  { key: "bio", type: "longText" },
  { key: "count", type: "number" },
  { key: "amountCents", type: "currency", formatOptions: { currencyInMinorUnits: true } },
  { key: "ratio", type: "percent" },
  { key: "active", type: "boolean" },
  { key: "birthday", type: "date" },
  { key: "seenAt", type: "datetime" },
  { key: "startsAt", type: "time" },
  { key: "updatedAt", type: "relativeTime" },
  { key: "plan", type: "select", formatOptions: { options: PLANS } },
  { key: "status", type: "badge", formatOptions: { options: STATUSES } },
  { key: "tags", type: "tags" },
  { key: "email", type: "email" },
  { key: "website", type: "url" },
  { key: "phone", type: "phone" },
  { key: "avatar", type: "image" },
  { key: "reference", type: "text" },
  { key: "snippet", type: "code" },
  { key: "home", type: "address" },
  { key: "attachment", type: "file" },
  { key: "payload", type: "json" },
  { key: "version", type: "semver" },
  { key: "priority", type: "priority" },
  { key: "seat", compare: compareSeats },
]
