/**
 * Every type's own filter, as a person would use it.
 *
 * The conformance suite proves the engine: every operator against every type.
 * This is about the step before the engine — the control. Each type is given a
 * control in its column's menu, and that control has to be able to *hold* the
 * value the type compares by. A time of day cannot be typed into a number box
 * and a month cannot be typed into a date picker, and when that goes wrong the
 * engine is never even asked.
 *
 * So for the full-spectrum dataset this says, column by column: which control
 * the menu should show, what to do with it, the filter that should come out,
 * and exactly which rows should be left — worked out here by plain predicates
 * over the rows, sharing nothing with the pipeline. An adapter opens each
 * column's menu, does what the plan says, and compares what is on screen.
 */

import type { ColumnFilter, FilterOperator } from "../types.js"
import { PLANS, STATUSES, versionRank, type Row } from "./dataset.js"

export type FilterPlan = {
  /** The column, by key. */
  key: string
  /** What is being tried, to name the test. */
  name: string
  /**
   * The control the column's menu should show: none at all, a list of
   * checkboxes, a yes/no/any list, or an operator and a value.
   */
  control: "none" | "set" | "boolean" | "value"
  /** `set`: the label of the box to tick. `boolean`: `"true"` or `"false"`. */
  choice?: string
  /** `value`: the operator to choose, and what kind of box its value goes in. */
  operator?: FilterOperator
  input?: "text" | "number" | "date" | "time"
  /** `value`: what to type — one value, or two for a range. */
  values?: string[]
  /** The filter the control should produce. */
  filter?: ColumnFilter
  /** The ids of exactly the rows that should be left, in the order they arrived. */
  expected: string[]
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** Epoch milliseconds for the several shapes a date arrives in. */
function instant(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return Math.abs(value) < 1e11 ? value * 1000 : value
  if (typeof value === "string") return Date.parse(value)
  return null
}

const dayOf = (value: unknown): string | null => {
  const at = instant(value)
  return at === null || Number.isNaN(at) ? null : new Date(at).toISOString().slice(0, 10)
}

const minutes = (clock: string) => {
  const [hours = "0", rest = "0"] = clock.split(":")
  return Number(hours) * 60 + Number(rest)
}

/**
 * The plans for a set of rows from `makeRows`.
 *
 * Values are read off the rows themselves, so the plans hold for any seed: the
 * first row with something in a column says what to look for in it.
 */
export function filterPlans(rows: readonly Row[]): FilterPlan[] {
  const leaving = (keep: (row: Row) => boolean) => rows.filter(keep).map((row) => row.id)

  const first = <T>(read: (row: Row) => T | null | undefined | ""): { row: Row; value: T } => {
    for (const row of rows) {
      const value = read(row)
      if (value !== null && value !== undefined && value !== "") return { row, value }
    }
    throw new Error("the dataset has no row with a value to filter by")
  }

  const plans: FilterPlan[] = []

  /** An operator and a value. */
  const value = (
    key: string,
    name: string,
    operator: FilterOperator,
    input: FilterPlan["input"],
    values: string[],
    keep: (row: Row) => boolean,
  ) => {
    const [only = "", second] = values
    plans.push({
      key,
      name,
      control: "value",
      operator,
      input,
      values,
      filter: { key, operator, value: second === undefined ? only : [only, second] },
      expected: leaving(keep),
    })
  }

  const contains = (key: string, typed: string, said: (row: Row) => string | null | undefined) =>
    value(key, `contains "${typed}"`, "contains", "text", [typed], (row) => fold(said(row) ?? "").includes(fold(typed)) && (said(row) ?? "") !== "")

  /* ── Identifiers and text ────────────────────────────────────────────── */

  const id = first((row) => row.id)
  value("id", "is one id", "eq", "text", [id.value], (row) => row.id === id.value)

  // A plain name: the awkward ones — padded, blank, an emoji — have their own tests.
  const name = first((row) => (/^[A-Za-z]+ [A-Za-z]+$/.test(row.name) ? row.name : null))
  contains("name", name.value.slice(0, 3), (row) => row.name)

  contains("bio", "prose", (row) => row.bio)
  contains("email", first((row) => row.email).value.split("@")[0] ?? "", (row) => row.email)
  contains("website", ".com/1", (row) => row.website)
  contains("phone", first((row) => row.phone).value.slice(0, 7), (row) => row.phone)
  contains("reference", first((row) => row.reference).value.slice(-3), (row) => row.reference)
  contains("snippet", "= 1", (row) => row.snippet)
  contains("seat", first((row) => row.seat).value, (row) => row.seat)

  /* ── Structured values, by what the cell shows ───────────────────────── */

  const home = first((row) => row.home)
  contains("home", home.value.city, (row) => (row.home ? `${row.home.line1}, ${row.home.city}, ${row.home.postcode}` : null))

  const attachment = first((row) => row.attachment)
  contains("attachment", attachment.value.name.slice(0, -4), (row) => row.attachment?.name)

  /* ── Numbers ─────────────────────────────────────────────────────────── */

  const count = first((row) => row.count)
  value("count", "is a number", "eq", "number", [String(count.value)], (row) => row.count === count.value)
  value("count", "is at least a number", "gte", "number", ["500"], (row) => row.count !== null && row.count >= 500)
  value("count", "is between two numbers", "between", "number", ["-50", "50"], (row) => row.count !== null && row.count >= -50 && row.count <= 50)

  // Compared as stored, which here is in cents.
  value("amountCents", "is at most an amount", "lte", "number", ["100000"], (row) => row.amountCents <= 100_000)
  value("ratio", "is more than a percentage", "gt", "number", ["75.5"], (row) => row.ratio > 75.5)

  /* ── Yes and no ──────────────────────────────────────────────────────── */

  plans.push({
    key: "active",
    name: "is yes",
    control: "boolean",
    choice: "true",
    filter: { key: "active", operator: "eq", value: "true" },
    expected: leaving((row) => row.active === true),
  })
  plans.push({
    key: "active",
    name: "is no",
    control: "boolean",
    choice: "false",
    filter: { key: "active", operator: "eq", value: "false" },
    expected: leaving((row) => row.active === false),
  })

  /* ── Dates and times ─────────────────────────────────────────────────── */

  const birthday = first((row) => row.birthday)
  value("birthday", "is a day", "eq", "date", [birthday.value], (row) => row.birthday === birthday.value)
  value("birthday", "is before a day", "lt", "date", ["1985-06-15"], (row) => row.birthday !== null && row.birthday < "1985-06-15")

  // A day means the whole day, whichever of four shapes the instant arrived in.
  const seen = first((row) => dayOf(row.seenAt))
  value("seenAt", "is on a day", "eq", "date", [seen.value], (row) => dayOf(row.seenAt) === seen.value)
  value("seenAt", "is on or after a day", "gte", "date", ["2026-06-01"], (row) => {
    const day = dayOf(row.seenAt)
    return day !== null && day >= "2026-06-01"
  })

  const updated = first((row) => dayOf(row.updatedAt))
  value("updatedAt", "is on a day", "eq", "date", [updated.value], (row) => dayOf(row.updatedAt) === updated.value)

  // A time of day, which only a time box can hold.
  const starts = first((row) => row.startsAt)
  value("startsAt", "is a time of day", "eq", "time", [starts.value], (row) => row.startsAt === starts.value)
  value("startsAt", "is between two times", "between", "time", ["09:00", "17:30"], (row) => {
    if (row.startsAt === null) return false
    const at = minutes(row.startsAt)
    return at >= minutes("09:00") && at <= minutes("17:30")
  })

  /* ── Choices ─────────────────────────────────────────────────────────── */

  const label = (options: Array<{ value: string; label?: string }>, stored: string) =>
    options.find((option) => option.value === stored)?.label ?? stored

  const plan = first((row) => row.plan)
  plans.push({
    key: "plan",
    name: "is one choice",
    control: "set",
    choice: label(PLANS, plan.value),
    filter: { key: "plan", operator: "eq", value: plan.value },
    expected: leaving((row) => row.plan === plan.value),
  })

  const status = first((row) => row.status)
  plans.push({
    key: "status",
    name: "is one choice",
    control: "set",
    choice: label(STATUSES, status.value),
    filter: { key: "status", operator: "eq", value: status.value },
    expected: leaving((row) => row.status === status.value),
  })

  const tag = first((row) => row.tags[0])
  plans.push({
    key: "tags",
    name: "has one tag",
    control: "set",
    choice: tag.value,
    filter: { key: "tags", operator: "eq", value: tag.value },
    expected: leaving((row) => row.tags.includes(tag.value)),
  })

  /* ── Custom types ────────────────────────────────────────────────────── */

  const version = first((row) => row.version)
  value("version", "is one version", "eq", "text", [version.value], (row) => versionRank(row.version) === versionRank(version.value))
  value("version", "is at least a version", "gte", "text", ["6.0.0"], (row) => versionRank(row.version) >= versionRank("6.0.0"))

  const priority = first((row) => row.priority)
  plans.push({
    key: "priority",
    name: "is one choice, by the label its type writes",
    control: "set",
    choice: priority.value.charAt(0).toUpperCase() + priority.value.slice(1),
    filter: { key: "priority", operator: "eq", value: priority.value },
    expected: leaving((row) => row.priority === priority.value),
  })

  /* ── Types with nothing to filter by ─────────────────────────────────── */

  for (const key of ["avatar", "payload"]) {
    plans.push({ key, name: "has no filter", control: "none", expected: leaving(() => true) })
  }

  return plans
}
