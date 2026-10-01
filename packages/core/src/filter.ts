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

import { cachedText, textCacheKey } from "./cell-text.js"
import { toText } from "./format.js"
import type { TypeDef } from "./registry.js"
import type {
  ColumnFilter,
  FilterOperator,
  FilterValue,
  FormatContext,
  FormatOptions,
  ResolvedColumn,
} from "./types.js"
import { createTextTest, isEmpty, textEquals } from "./util.js"

/** Operators that take no value: the field's presence is the whole condition. */
export const VALUELESS_OPERATORS: readonly FilterOperator[] = ["empty", "notEmpty"]

/**
 * Operators that compare text.
 *
 * They ask about what a cell *says*, so they are answered from the value
 * written out and from the text the column displays — which is what lets
 * "contains Aug" find a date and "contains 1,2" find $1,240.00.
 */
export const TEXT_OPERATORS: readonly FilterOperator[] = ["contains", "notContains", "startsWith", "endsWith"]

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

/**
 * Whether an operator compares text, whatever the column's type.
 *
 * A filter control uses it to offer a plain text box for "contains" on a date
 * or a number, where the type's own input could not hold what is being typed.
 */
export function isTextOperator(operator: FilterOperator): boolean {
  return TEXT_OPERATORS.includes(operator)
}

/**
 * Puts a filter's value into the shape its operator implies.
 *
 * List operators take a list; everything else takes a single value. Without
 * this, a set filter that emits `eq` with a one-element array produces state
 * that no longer round-trips through a URL — `["pro"]` goes out and `"pro"`
 * comes back — and a saved view stops matching the link that would recreate it.
 *
 * Applied wherever a filter enters the state, so everything downstream can rely
 * on it.
 */
export function normaliseFilter(filter: ColumnFilter): ColumnFilter {
  // "Is empty" takes no value, and one left over from a previous operator is
  // dropped rather than carried — the URL does not encode it either, so keeping
  // it would make the state and its link disagree.
  if (!needsValue(filter.operator)) {
    return filter.value === undefined ? filter : { key: filter.key, operator: filter.operator }
  }

  const wantsList = LIST_OPERATORS.includes(filter.operator) || RANGE_OPERATORS.includes(filter.operator)

  if (wantsList) {
    if (filter.value === undefined) return filter
    return Array.isArray(filter.value) ? filter : { ...filter, value: [filter.value] }
  }

  if (!Array.isArray(filter.value)) return filter

  // A single value is that value; several were never meaningful here, and the
  // first is the only one this operator could have used anyway.
  const [first] = filter.value
  return first === undefined ? { key: filter.key, operator: filter.operator } : { ...filter, value: first }
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
 *
 * An incomplete filter — an operator that needs a value, with none yet typed —
 * answers `true`: it asks nothing, so it excludes nothing. **Drop those with
 * `isFilterUsable` before combining conditions with OR**, exactly as
 * `filterRows` does, or a half-typed filter will widen the result to
 * everything instead of being ignored.
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

  if (isTextOperator(filter.operator)) return matchesText(value, textQuery(filter), type, context)

  switch (filter.operator) {
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

/** One text condition, prepared once so that applying it to a row is only the comparison. */
type TextQuery = {
  test: (text: string) => boolean
  /** True for "does not contain", which is the same question with the answer turned over. */
  negated: boolean
  /** Where the column's formatted text is remembered, when it has a formatter to remember for. */
  cacheKey?: string
}

function textQuery(filter: ColumnFilter): TextQuery {
  const mode =
    filter.operator === "startsWith" ? "startsWith" : filter.operator === "endsWith" ? "endsWith" : "includes"

  return { test: createTextTest(mode, String(filter.value)), negated: filter.operator === "notContains" }
}

/**
 * A text condition against everything a cell says.
 *
 * Two things count: the value written out, and the text the column shows for
 * it. A date stored as `2026-08-13` and shown as "Aug 13, 2026" is found by
 * either; so is an amount by its digits or by "$1,240.00", and a choice by its
 * key or its label. The same rule global search follows, one column wide —
 * the words on the screen are the words a person will type.
 *
 * `row` is only for remembering formatted text against, and may be left out.
 */
function matchesText(
  value: unknown,
  query: TextQuery,
  type: TypeDef,
  context: FormatContext & FormatOptions,
  row?: unknown,
): boolean {
  let hit = valueSays(value, query.test)

  if (!hit) {
    const shown =
      query.cacheKey !== undefined && typeof row === "object" && row !== null
        ? cachedText(row, query.cacheKey, type, value, context)
        : shownText(value, type, context)

    hit = shown !== "" && query.test(shown)
  }

  return query.negated ? !hit : hit
}

/**
 * The value itself, as text.
 *
 * Only what is already text-like is compared as it stands. `String({…})` is
 * "[object Object]", which would make "contains object" true of every address,
 * every file and every blob of JSON — and a `Date` writes itself out in the
 * runtime's own zone and language, which is nobody's idea of what the cell
 * says. Those are answered by the text the column shows instead.
 */
function valueSays(value: unknown, test: (text: string) => boolean): boolean {
  if (Array.isArray(value)) return value.some((entry) => typeof entry !== "object" && test(String(entry)))
  return typeof value !== "object" && test(String(value))
}

/**
 * The text a column shows for a value, when that differs from the value
 * written out. A plain value in a column with no formatter shows as itself,
 * which `valueSays` has already compared.
 */
function shownText(value: unknown, type: TypeDef, context: FormatContext & FormatOptions): string {
  if (type.format) return type.format(value, context)
  return typeof value === "object" && !Array.isArray(value) ? toText(value, context) : ""
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
export function filterRows<TRow, TNode = unknown>(
  rows: readonly TRow[],
  columns: readonly ResolvedColumn<TRow, TNode>[],
  filters: readonly ColumnFilter[],
  match: "all" | "any",
  types: (name: string) => TypeDef,
  context: FormatContext,
): TRow[] {
  /*
    Everything that does not depend on the row is worked out once. Spreading a
    context object per row per filter costs more than the comparison it was
    built for, and over a hundred thousand rows it is most of the work.
  */
  const usable = filters
    .filter(isFilterUsable)
    .map((filter) => {
      const column = columns.find((candidate) => candidate.key === filter.key)
      if (!column) return undefined

      const type = types(column.type)
      const columnContext = column.formatOptions ? { ...context, ...column.formatOptions } : context

      /*
        A text condition is prepared here: its query folded once rather than
        once a row, and the key its column's formatted text is remembered
        under — the same one global search uses, so a table searched both ways
        formats each cell once.
      */
      let text: TextQuery | undefined
      if (isTextOperator(filter.operator)) {
        text = textQuery(filter)
        if (type.format) text.cacheKey = textCacheKey(column.key, type, columnContext)
      }

      return { filter, accessor: column.accessor, type, context: columnContext, text }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)

  if (usable.length === 0) return rows as TRow[]

  const passes = (entry: (typeof usable)[number], row: TRow): boolean => {
    const value = entry.accessor(row)
    if (!entry.text) return matchesFilter(value, entry.filter, entry.type, entry.context)
    // The same answer `matchesFilter` gives an empty cell: it cannot satisfy a
    // comparison, in either direction.
    if (isEmpty(value)) return false
    return matchesText(value, entry.text, entry.type, entry.context, row)
  }

  // Short-circuited rather than collected: "all" stops at the first refusal and
  // "any" at the first acceptance, which for several conditions is most of the
  // comparisons never made.
  if (match === "any") return rows.filter((row) => usable.some((entry) => passes(entry, row)))

  return rows.filter((row) => usable.every((entry) => passes(entry, row)))
}

/** Adds or replaces the filter on a column, which is what a column menu does. */
export function withFilter(filters: readonly ColumnFilter[], filter: ColumnFilter): ColumnFilter[] {
  const others = filters.filter((entry) => entry.key !== filter.key)
  return [...others, normaliseFilter(filter)]
}

export function withoutFilter(filters: readonly ColumnFilter[], key: string): ColumnFilter[] {
  return filters.filter((entry) => entry.key !== key)
}
