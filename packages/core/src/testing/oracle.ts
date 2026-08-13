/**
 * An independent reference implementation.
 *
 * Written from the documented behaviour rather than from the library's code,
 * deliberately plainly, with a switch per type and no shared machinery. It is
 * slow and repetitive on purpose: the point is that it is obviously right, so
 * that when the two disagree there is something real to look at.
 *
 * Test-only. It is not exported from the package.
 */

import { PRIORITY_ORDER, versionRank, type Row } from "./dataset.js"
import type { FilterOperator, SelectOption } from "../types.js"

export type OracleColumn = {
  key: keyof Row
  type: string
  options?: SelectOption[]
  minorUnits?: boolean
}

/** Case- and accent-insensitive, exactly as the docs promise for text. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (value === "") return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === "number" && Number.isNaN(value)) return true
  return false
}

function labelOf(value: unknown, options: SelectOption[] | undefined): string {
  const text = String(value)
  const match = options?.find((option) => option.value === text)
  return match?.label ?? text
}

/** Epoch milliseconds for the several shapes a date arrives in. */
function instant(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()

  if (typeof value === "number") {
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value
    return Number.isFinite(ms) ? ms : null
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

/** Minutes since midnight, so "9:30" orders before "14:05". */
function clock(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function digits(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value !== "string") return null

  const cleaned = value.replace(/[^\d.\-+eE]/g, "")
  if (!/\d/.test(cleaned)) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The value reduced to something orderable, per the documented rule for its
 * type. `null` means "nothing to compare", which always sorts last.
 */
export function comparable(column: OracleColumn, value: unknown): string | number | boolean | null {
  if (isBlank(value)) return null

  switch (column.type) {
    case "number":
    case "currency":
    case "percent":
    case "semver":
      return column.type === "semver" ? (typeof value === "string" ? versionRank(value) : null) : digits(value)

    case "priority":
      return typeof value === "string" ? (PRIORITY_ORDER.get(value) ?? null) : null

    case "boolean":
      return Boolean(value)

    case "date":
    case "datetime":
    case "relativeTime":
      return instant(value)

    case "time":
      return clock(value)

    case "select":
    case "badge":
      return fold(labelOf(value, column.options))

    case "tags":
      return Array.isArray(value)
        ? value
            .map((entry) => fold(labelOf(entry, column.options)))
            .sort()
            .join(" ")
        : fold(String(value))

    case "address":
      return typeof value === "object" && value !== null
        ? fold(Object.values(value as Record<string, unknown>).filter((part) => typeof part === "string" && part !== "").join(", "))
        : fold(String(value))

    case "file":
      return typeof value === "object" && value !== null
        ? fold(String((value as { name?: unknown }).name ?? ""))
        : fold(String(value))

    case "image":
      // Not sortable, but still comparable as text: "is exactly this URL" is a
      // question with an answer even though "which URL is bigger" is not.
      return fold(String(value))

    case "json":
      return fold(typeof value === "object" ? JSON.stringify(value) : String(value))

    default:
      return fold(String(value))
  }
}

/** The text a cell shows, which is what global search matches against. */
export function displayed(column: OracleColumn, value: unknown, now: Date): string {
  if (isBlank(value)) return ""

  switch (column.type) {
    case "number":
      return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(digits(value) ?? 0)

    case "currency": {
      const raw = digits(value) ?? 0
      return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(
        column.minorUnits ? raw / 100 : raw,
      )
    }

    case "percent":
      return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(digits(value) ?? 0)}%`

    case "boolean":
      return value ? "Yes" : "No"

    case "date":
      return formatDay(instant(value))

    case "datetime":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
        ? formatDay(instant(value))
        : formatMoment(instant(value))

    case "time": {
      const minutes = clock(value)
      if (minutes === null) return String(value)
      const date = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60))
      return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date)
    }

    case "relativeTime": {
      const at = instant(value)
      if (at === null) return String(value)
      return relative(at - now.getTime())
    }

    case "select":
    case "badge":
      return labelOf(value, column.options)

    case "tags":
      return Array.isArray(value) ? value.map((entry) => labelOf(entry, column.options)).join(", ") : String(value)

    case "address":
      return typeof value === "object" && value !== null
        ? Object.values(value as Record<string, unknown>).filter((part) => typeof part === "string" && part !== "").join(", ")
        : String(value)

    case "file":
      return typeof value === "object" && value !== null ? String((value as { name?: unknown }).name ?? "") : String(value)

    case "json":
      return "{…}"

    case "image":
      return ""

    case "priority":
      return typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : ""

    default:
      return String(value)
  }
}

function formatDay(at: number | null): string {
  if (at === null) return ""
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(at)
}

function formatMoment(at: number | null): string {
  if (at === null) return ""
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(at)
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
]

function relative(difference: number): string {
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  for (const [unit, size] of UNITS) {
    if (Math.abs(difference) >= size || unit === "second") {
      return format.format(Math.round(difference / size), unit)
    }
  }
  return format.format(0, "second")
}

/** True for a bare calendar day, which in a filter means the whole day. */
function dayBounds(raw: unknown): { start: number; end: number } | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null
  const start = Date.parse(`${raw.trim()}T00:00:00.000Z`)
  return Number.isNaN(start) ? null : { start, end: start + 86_400_000 - 1 }
}

function isTemporal(type: string): boolean {
  return type === "date" || type === "datetime" || type === "relativeTime"
}

/** One value against one condition. The heart of the reference. */
export function matches(
  column: OracleColumn,
  value: unknown,
  operator: FilterOperator,
  target: unknown,
): boolean {
  if (operator === "empty") return isBlank(value)
  if (operator === "notEmpty") return !isBlank(value)

  // An incomplete filter asks nothing, so it excludes nothing.
  if (target === undefined || target === null || target === "") return true
  if (Array.isArray(target) && target.length === 0) return true

  // A cell with nothing in it cannot satisfy a comparison.
  if (isBlank(value)) return false

  const left = comparable(column, value)

  switch (operator) {
    case "contains":
    case "notContains": {
      const needle = fold(String(target))
      const hit = Array.isArray(value)
        ? value.some((entry) => fold(String(entry)).includes(needle))
        : fold(String(left ?? "")).includes(needle)
      return operator === "contains" ? hit : !hit
    }

    case "startsWith":
      return fold(String(left ?? "")).startsWith(fold(String(target)))

    case "endsWith":
      return fold(String(left ?? "")).endsWith(fold(String(target)))

    case "eq":
      return equals(column, value, target)

    case "ne":
      return !equals(column, value, target)

    case "in":
      return asList(target).some((entry) => equals(column, value, entry))

    case "notIn":
      return !asList(target).some((entry) => equals(column, value, entry))

    case "between": {
      const [low, high] = asList(target)
      return compare(column, value, low, "gte") && compare(column, value, high, "lte")
    }

    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compare(column, value, target, operator)
  }
}

function asList(target: unknown): unknown[] {
  return Array.isArray(target) ? target : [target]
}

function equals(column: OracleColumn, value: unknown, target: unknown): boolean {
  if (isTemporal(column.type)) {
    const bounds = dayBounds(target)
    if (bounds) {
      const at = instant(value)
      return at !== null && at >= bounds.start && at <= bounds.end
    }
  }

  if (Array.isArray(value)) return value.some((entry) => equals(column, entry, target))

  const left = comparable(column, value)
  const right = comparable(column, target)

  if (typeof left === "number" && typeof right === "number") return left === right
  if (typeof left === "boolean" || typeof right === "boolean") return truthy(left) === truthy(right)
  if (left === null || right === null) return left === right

  // The stored value counts as well as the label, so a filter naming an
  // option's key matches even though the column sorts by its label.
  return fold(String(left)) === fold(String(right)) || fold(String(value)) === fold(String(target))
}

function truthy(value: unknown): boolean {
  if (typeof value === "string") return value === "true" || value === "1" || value === "yes"
  return Boolean(value)
}

function compare(
  column: OracleColumn,
  value: unknown,
  target: unknown,
  operator: "gt" | "gte" | "lt" | "lte",
): boolean {
  const left = comparable(column, value)

  let right: string | number | boolean | null
  if (isTemporal(column.type)) {
    const bounds = dayBounds(target)
    // A day is a range: "after 13 Aug" means after all of it, "on or after"
    // means from its start.
    right = bounds ? (operator === "gt" || operator === "lte" ? bounds.end : bounds.start) : instant(target)
  } else {
    right = comparable(column, target)
  }

  if (left === null || right === null) return false

  const difference =
    typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))

  switch (operator) {
    case "gt":
      return difference > 0
    case "gte":
      return difference >= 0
    case "lt":
      return difference < 0
    case "lte":
      return difference <= 0
  }
}

/**
 * Ordering, ascending, with absent values last whichever way the column is
 * sorted — the rule the library documents and the one people expect.
 */
export function order(column: OracleColumn, a: unknown, b: unknown): number {
  const left = comparable(column, a)
  const right = comparable(column, b)

  if (left === null || right === null) {
    if (left === null && right === null) return 0
    return left === null ? 1 : -1
  }

  if (typeof left === "number" && typeof right === "number") return left - right
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right)

  return new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(String(left), String(right))
}

/** Global search: any searchable column, raw value or shown text. */
export function found(columns: OracleColumn[], row: Row, query: string, now: Date): boolean {
  const needle = fold(query.trim())
  if (needle === "") return true

  return columns.some((column) => {
    if (column.type === "boolean" || column.type === "json" || column.type === "image") return false

    const value = row[column.key]
    if (isBlank(value)) return false

    if (Array.isArray(value)) {
      if (value.some((entry) => fold(String(entry)).includes(needle))) return true
    } else if (fold(String(value)).includes(needle)) {
      return true
    }

    const text = displayed(column, value, now)
    return text !== "" && fold(text).includes(needle)
  })
}
