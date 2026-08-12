/**
 * Filtering.
 *
 * One vocabulary of operators for every type, with each type declaring which of
 * them apply to it. A filter UI built from that list can only ever offer a
 * question the data can answer.
 *
 * Values arrive as text — from a URL, an input, a saved view — and are
 * normalised through the column's type before they are compared, which is why
 * `"100"` filters a number column numerically and `"2026-08-13"` filters a
 * datetime column by that whole day rather than by an exact instant.
 */

import type { TypeDef } from "./registry.js"
import type {
  ColumnFilter,
  FilterOperator,
  FilterValue,
  FormatContext,
  FormatOptions,
  ResolvedColumn,
} from "./types.js"
import { isEmpty, textEndsWith, textEquals, textIncludes, textStartsWith } from "./util.js"

/** Operators that take no value: the field's presence is the whole condition. */
export const VALUELESS_OPERATORS: readonly FilterOperator[] = ["empty", "notEmpty"]

/** Operators whose value is a list. */
export const LIST_OPERATORS: readonly FilterOperator[] = ["in", "notIn"]

/** Operators whose value is a pair of bounds. */
export const RANGE_OPERATORS: readonly FilterOperator[] = ["between"]

/** Read as "<column> <operator> <value>", so a filter chip completes the sentence. */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "is",
  ne: "is not",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  between: "is between",
  in: "is any of",
  notIn: "is none of",
  empty: "is empty",
  notEmpty: "is not empty",
}

export function needsValue(operator: FilterOperator): boolean {
  return !VALUELESS_OPERATORS.includes(operator)
}

export function isListOperator(operator: FilterOperator): boolean {
  return LIST_OPERATORS.includes(operator)
}

/** Whether a filter is complete enough to be worth applying. */
export function isFilterUsable(filter: ColumnFilter): boolean {
  if (!needsValue(filter.operator)) return true
  if (filter.value === undefined || filter.value === null || filter.value === "") return false
  if (Array.isArray(filter.value)) return filter.value.length > 0
  return true
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MILLISECONDS_PER_DAY = 86_400_000

/**
 * The instants a bare calendar day covers.
 *
 * Without this, "created is 13 Aug" matches only a timestamp at exactly
 * midnight — technically defensible and completely useless. A day in a filter
 * means the day.
 */
function dayBounds(value: unknown): { start: number; end: number } | undefined {
  if (typeof value !== "string" || !ISO_DATE.test(value.trim())) return undefined
  const start = Date.parse(`${value.trim()}T00:00:00.000Z`)
  if (Number.isNaN(start)) return undefined
  return { start, end: start + MILLISECONDS_PER_DAY - 1 }
}

function isTemporal(type: TypeDef): boolean {
  return type.name === "date" || type.name === "datetime" || type.name === "relativeTime"
}

/**
 * Applies one condition to one value.
 *
 * Exported because a caller filtering on the server wants the same semantics as
 * the client, and reimplementing them is how the two drift apart.
 */
export function matchesFilter(
  value: unknown,
  filter: ColumnFilter,
  type: TypeDef,
  context: FormatContext & FormatOptions,
): boolean {
  if (filter.operator === "empty") return isEmpty(value)
  if (filter.operator === "notEmpty") return !isEmpty(value)
  if (!isFilterUsable(filter)) return true

  // A row with nothing in the column cannot satisfy a comparison. Returning
  // false rather than treating it as zero or "" is what stops an empty cell
  // matching "is less than 10".
  if (isEmpty(value)) return false

  const normalise = (input: unknown) => (type.normalise ? type.normalise(input, context) : input)

  switch (filter.operator) {
    case "contains":
    case "notContains": {
      const needle = String(filter.value)
      const hit = Array.isArray(value)
        ? value.some((entry) => textIncludes(String(entry), needle))
        : textIncludes(String(normalise(value) ?? ""), needle)
      return filter.operator === "contains" ? hit : !hit
    }

    case "startsWith":
      return textStartsWith(String(normalise(value) ?? ""), String(filter.value))

    case "endsWith":
      return textEndsWith(String(normalise(value) ?? ""), String(filter.value))

    case "eq":
    case "ne": {
      const hit = equals(value, filter.value, type, context)
      return filter.operator === "eq" ? hit : !hit
    }

    case "in":
    case "notIn": {
      const list = toArray(filter.value)
      const hit = list.some((entry) => equals(value, entry, type, context))
      return filter.operator === "in" ? hit : !hit
    }

    case "between": {
      const [low, high] = toArray(filter.value)
      const left = compareAgainst(value, low, type, context, "gte")
      const right = compareAgainst(value, high, type, context, "lte")
      return left && right
    }

    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compareAgainst(value, filter.value, type, context, filter.operator)

    default:
      return true
  }
}

/**
 * Equality, with a calendar day matching any instant within it.
 *
 * A `select` column compares by label as well as by stored value, so a filter
 * built from what the user can see works as well as one built from the id.
 */
function equals(
  value: unknown,
  target: unknown,
  type: TypeDef,
  context: FormatContext & FormatOptions,
): boolean {
  if (target === undefined || target === null) return isEmpty(value)

  if (isTemporal(type)) {
    const bounds = dayBounds(target)
    if (bounds) {
      const time = type.normalise?.(value, context)
      return typeof time === "number" && time >= bounds.start && time <= bounds.end
    }
  }

  // Arrays hold several values and any of them may be the one asked for.
  if (Array.isArray(value)) {
    return value.some((entry) => equals(entry, target, type, context))
  }

  const left = type.normalise ? type.normalise(value, context) : value
  const right = type.normalise ? type.normalise(target, context) : target

  if (typeof left === "number" && typeof right === "number") return left === right
  if (typeof left === "boolean" || typeof right === "boolean") return toBoolean(left) === toBoolean(right)
  if (left === null || right === null) return left === right

  // The stored value is compared too, because `normalise` on a select column
  // returns its label — and a filter naming the option's key must still match.
  return textEquals(String(left), String(right)) || textEquals(String(value), String(target))
}

function compareAgainst(
  value: unknown,
  target: unknown,
  type: TypeDef,
  context: FormatContext & FormatOptions,
  operator: "gt" | "gte" | "lt" | "lte",
): boolean {
  const left = type.normalise ? type.normalise(value, context) : value

  /*
    A day is a range, so "after 13 Aug" means after the end of that day while
    "on or after 13 Aug" means from its start. Getting this wrong by twelve
    hours is the bug every date filter ships with at least once.
  */
  let right: unknown = target
  if (isTemporal(type)) {
    const bounds = dayBounds(target)
    if (bounds) right = operator === "gt" || operator === "lte" ? bounds.end : bounds.start
    else right = type.normalise?.(target, context) ?? target
  } else {
    right = type.normalise ? type.normalise(target, context) : target
  }

  if (left === null || left === undefined || right === null || right === undefined) return false

  const difference =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right))

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

function toBoolean(value: unknown): boolean {
  if (typeof value === "string") return value === "true" || value === "1" || value === "yes"
  return Boolean(value)
}

function toArray(value: FilterValue | undefined): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Applies a whole filter set to a set of rows.
 *
 * Filters naming a column that does not exist are ignored rather than treated
 * as unsatisfiable: a saved view outliving a renamed column should show more
 * than nothing.
 */
export function filterRows<TRow>(
  rows: readonly TRow[],
  columns: readonly ResolvedColumn<TRow>[],
  filters: readonly ColumnFilter[],
  match: "all" | "any",
  types: (name: string) => TypeDef,
  context: FormatContext,
): TRow[] {
  const usable = filters
    .filter(isFilterUsable)
    .map((filter) => {
      const column = columns.find((candidate) => candidate.key === filter.key)
      return column ? { filter, column, type: types(column.type) } : undefined
    })
    .filter((entry): entry is { filter: ColumnFilter; column: ResolvedColumn<TRow>; type: TypeDef } =>
      entry !== undefined,
    )

  if (usable.length === 0) return rows as TRow[]

  return rows.filter((row) => {
    const results = usable.map(({ filter, column, type }) =>
      matchesFilter(column.accessor(row), filter, type, { ...context, ...column.formatOptions }),
    )
    return match === "any" ? results.some(Boolean) : results.every(Boolean)
  })
}

/** Adds or replaces the filter on a column, which is what a column menu does. */
export function withFilter(filters: readonly ColumnFilter[], filter: ColumnFilter): ColumnFilter[] {
  const others = filters.filter((entry) => entry.key !== filter.key)
  return [...others, filter]
}

export function withoutFilter(filters: readonly ColumnFilter[], key: string): ColumnFilter[] {
  return filters.filter((entry) => entry.key !== key)
}
