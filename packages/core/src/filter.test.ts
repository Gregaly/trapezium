import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { filterRows, matchesFilter, normaliseFilter, rangeFilter } from "./filter.js"
import { BUILT_IN_TYPES, defaultTypeRegistry } from "./registry.js"
import { createState, setFilter } from "./state.js"
import { stateFromUrl, stateToQueryString } from "./url.js"
import type { ColumnFilter } from "./types.js"

const format = DEFAULT_FORMAT
const type = (name: string) => BUILT_IN_TYPES[name]!

function check(value: unknown, filter: ColumnFilter, typeName = "text"): boolean {
  return matchesFilter(value, filter, type(typeName), format)
}

describe("text operators", () => {
  it("contains ignores case and accents", () => {
    expect(check("José García", { key: "n", operator: "contains", value: "jose" })).toBe(true)
    expect(check("Ada", { key: "n", operator: "notContains", value: "z" })).toBe(true)
  })

  it("startsWith and endsWith", () => {
    expect(check("Adelaide", { key: "n", operator: "startsWith", value: "ade" })).toBe(true)
    expect(check("Adelaide", { key: "n", operator: "endsWith", value: "AIDE" })).toBe(true)
  })

  it("eq is exact but case-insensitive", () => {
    expect(check("Ada", { key: "n", operator: "eq", value: "ada" })).toBe(true)
    expect(check("Adam", { key: "n", operator: "eq", value: "ada" })).toBe(false)
  })
})

/**
 * The text operators ask what a cell *says*, so each type is asked in the
 * words a person reading its column would type — and, where the stored value
 * reads differently from the screen, in those words too.
 */
describe("text operators answer from what the cell shows, for every type", () => {
  const now = new Date("2026-08-13T12:00:00.000Z")
  const context = { ...format, now }

  const contains = (
    value: unknown,
    typeName: string,
    query: string,
    options: Partial<typeof context> & { options?: Array<{ value: string; label?: string }> } = {},
  ) => matchesFilter(value, { key: "c", operator: "contains", value: query }, type(typeName), { ...context, ...options })

  it("text and long text", () => {
    expect(contains("Ada Lovelace", "text", "love")).toBe(true)
    expect(contains("A biography long enough to be prose.", "longText", "PROSE")).toBe(true)
    expect(contains("Ada Lovelace", "text", "byron")).toBe(false)
  })

  it("a number, by its digits or the way it is grouped on screen", () => {
    expect(contains(1_234_567.5, "number", "1234567")).toBe(true)
    expect(contains(1_234_567.5, "number", "1,234")).toBe(true)
    expect(contains(1_234_567.5, "number", "999")).toBe(false)
    // Stored as text, as numbers out of a CSV import usually are.
    expect(contains("42", "number", "42")).toBe(true)
  })

  it("money, by the amount or the formatted figure", () => {
    expect(contains(1240.5, "currency", "$1,240.50")).toBe(true)
    expect(contains(1240.5, "currency", "1,240")).toBe(true)
    expect(contains(1240.5, "currency", "1240.5")).toBe(true)
    expect(contains(1240.5, "currency", "€")).toBe(false)
  })

  it("money held in minor units, by what it is shown as", () => {
    const cents = { currencyInMinorUnits: true }
    expect(contains(124_050, "currency", "$1,240.50", cents)).toBe(true)
    expect(contains(124_050, "currency", "124050", cents)).toBe(true)
  })

  it("money in a locale that groups with a space nobody can type", () => {
    // French writes this as "1 240,50 €" with a narrow no-break space and a
    // no-break one. A person types ordinary spaces.
    const french = { locale: "fr", currency: "EUR" }
    expect(contains(1240.5, "currency", "1 240,50 €", french)).toBe(true)
    expect(contains(1240.5, "currency", "240,50", french)).toBe(true)
  })

  it("a percentage, sign and all", () => {
    expect(contains(12.5, "percent", "12.5%")).toBe(true)
    expect(contains(12.5, "percent", "%")).toBe(true)
    expect(contains(12.5, "percent", "13")).toBe(false)
  })

  it("a checkbox, by the word it is read as", () => {
    expect(contains(true, "boolean", "yes")).toBe(true)
    expect(contains(false, "boolean", "no")).toBe(true)
    expect(contains(true, "boolean", "no")).toBe(false)
    // And by the stored value, for anyone who thinks in those.
    expect(contains(false, "boolean", "false")).toBe(true)
  })

  it("a date, by the month it shows or the ISO day underneath", () => {
    expect(contains("2026-08-13", "date", "aug")).toBe(true)
    expect(contains("2026-08-13", "date", "Aug 13, 2026")).toBe(true)
    expect(contains("2026-08-13", "date", "2026-08")).toBe(true)
    expect(contains("2026-08-13", "date", "sep")).toBe(false)
  })

  it("a date and time, by the time of day", () => {
    expect(contains("2026-08-13T09:30:00.000Z", "datetime", "9:30")).toBe(true)
    expect(contains("2026-08-13T09:30:00.000Z", "datetime", "aug 13")).toBe(true)
    // In the column's own zone, because that is the time on the screen.
    expect(contains("2026-08-13T09:30:00.000Z", "datetime", "7:30", { timeZone: "Australia/Sydney" })).toBe(true)
  })

  it("a date held as a Date, by what it shows and never by how the runtime prints it", () => {
    const instant = new Date("2026-08-13T09:30:00.000Z")
    expect(contains(instant, "datetime", "aug 13")).toBe(true)
    expect(contains(instant, "datetime", "GMT")).toBe(false)
    expect(contains(instant, "datetime", "Thu")).toBe(false)
  })

  it("a date held as epoch milliseconds or seconds", () => {
    expect(contains(Date.parse("2026-08-13T09:30:00.000Z"), "datetime", "aug 13")).toBe(true)
    expect(contains(Date.parse("2026-08-13T09:30:00.000Z") / 1000, "datetime", "aug 13")).toBe(true)
  })

  it("a time of day, as the clock shows it", () => {
    expect(contains("14:05", "time", "2:05 pm")).toBe(true)
    expect(contains("14:05", "time", "14:05")).toBe(true)
    expect(contains("14:05", "time", "3:05")).toBe(false)
  })

  it("a relative time, by its wording", () => {
    expect(contains("2026-08-10T12:00:00.000Z", "relativeTime", "3 days ago")).toBe(true)
    expect(contains("2026-08-10T12:00:00.000Z", "relativeTime", "ago")).toBe(true)
    expect(contains("2026-08-10T12:00:00.000Z", "relativeTime", "in 3 days")).toBe(false)
  })

  it("a choice, by its label or the key stored for it", () => {
    const options = { options: [{ value: "pro", label: "Professional" }] }
    expect(contains("pro", "select", "fession", options)).toBe(true)
    expect(contains("pro", "select", "pro", options)).toBe(true)
    expect(contains("pro", "badge", "PROFESSIONAL", options)).toBe(true)
    expect(contains("pro", "select", "team", options)).toBe(false)
  })

  it("tags, by any one of them, and by a label that differs from its key", () => {
    expect(contains(["urgent", "new"], "tags", "urg")).toBe(true)
    expect(contains(["urgent", "new"], "tags", "vip")).toBe(false)

    const options = { options: [{ value: "p1", label: "Urgent" }] }
    expect(contains(["p1"], "tags", "urgent", options)).toBe(true)
    expect(contains(["p1"], "tags", "p1", options)).toBe(true)
  })

  it("an email address, a link and a phone number", () => {
    expect(contains("ada@example.com", "email", "@example")).toBe(true)
    expect(contains("https://example.com/docs", "url", "example.com/d")).toBe(true)
    expect(contains("+61 400 123 456", "phone", "400 123")).toBe(true)
  })

  it("an identifier and a snippet of code", () => {
    expect(contains("row_00042", "id", "0042")).toBe(true)
    expect(contains("const value = 1", "code", "value =")).toBe(true)
  })

  it("an address, by any line of it and never by its shape", () => {
    const home = { line1: "12 Test Street", city: "Sydney", postcode: "2000" }
    expect(contains(home, "address", "sydney")).toBe(true)
    expect(contains(home, "address", "2000")).toBe(true)
    expect(contains(home, "address", "object")).toBe(false)
  })

  it("a file, by its name", () => {
    expect(contains({ name: "report-2026.pdf", size: 1024 }, "file", "report")).toBe(true)
    expect(contains("uploads/2026/report.pdf", "file", "report.pdf")).toBe(true)
    expect(contains({ name: "report-2026.pdf", size: 1024 }, "file", "1024")).toBe(false)
  })

  it("a picture, by its address, since it shows no text at all", () => {
    expect(contains("https://example.com/avatar/7.png", "image", "avatar/7")).toBe(true)
  })

  it("never by the contents of a column that shows none of them", () => {
    expect(contains({ secret: "hunter2" }, "json", "hunter2")).toBe(false)
    expect(contains({ secret: "hunter2" }, "json", "object")).toBe(false)
  })

  it("does not contain is the same question turned over", () => {
    const notContains = (value: unknown, typeName: string, query: string) =>
      matchesFilter(value, { key: "c", operator: "notContains", value: query }, type(typeName), context)

    expect(notContains("2026-08-13", "date", "aug")).toBe(false)
    expect(notContains("2026-08-13", "date", "sep")).toBe(true)
    expect(notContains(1240.5, "currency", "$1,240")).toBe(false)
    // An empty cell says nothing, so it satisfies neither side.
    expect(notContains(null, "date", "aug")).toBe(false)
    expect(contains(null, "date", "aug")).toBe(false)
  })

  it("starts with and ends with look at the same text", () => {
    const starts = (value: unknown, typeName: string, query: string) =>
      matchesFilter(value, { key: "c", operator: "startsWith", value: query }, type(typeName), context)
    const ends = (value: unknown, typeName: string, query: string) =>
      matchesFilter(value, { key: "c", operator: "endsWith", value: query }, type(typeName), context)

    expect(starts(1240.5, "currency", "$1")).toBe(true)
    expect(starts(1240.5, "currency", "12")).toBe(true)
    expect(starts(1240.5, "currency", "40")).toBe(false)
    expect(ends("14:05", "time", "pm")).toBe(true)
    expect(ends("2026-08-13", "date", "2026")).toBe(true)
    expect(starts(["urgent", "new"], "tags", "ne")).toBe(true)
  })

  it("a custom type is asked through its own formatter", () => {
    const stars = { name: "rating", format: (value: unknown) => "★".repeat(Number(value) || 0) }
    const check = (query: string) =>
      matchesFilter(3, { key: "c", operator: "contains", value: query }, stars, context)

    expect(check("★★★")).toBe(true)
    expect(check("★★★★")).toBe(false)
    expect(check("3")).toBe(true)
  })
})

describe("presence", () => {
  it("treats null, empty string and empty array as empty, but never zero or false", () => {
    expect(check(null, { key: "n", operator: "empty" })).toBe(true)
    expect(check("", { key: "n", operator: "empty" })).toBe(true)
    expect(check([], { key: "n", operator: "empty" })).toBe(true)
    expect(check(0, { key: "n", operator: "empty" }, "number")).toBe(false)
    expect(check(false, { key: "n", operator: "empty" }, "boolean")).toBe(false)
  })

  it("an empty value satisfies no comparison", () => {
    expect(check(null, { key: "n", operator: "lt", value: "10" }, "number")).toBe(false)
  })
})

describe("numbers", () => {
  it("compares numerically, even when the filter value is text from a URL", () => {
    expect(check(100, { key: "n", operator: "gt", value: "20" }, "number")).toBe(true)
    // The string comparison this guards against: "100" < "20".
    expect(check(100, { key: "n", operator: "lt", value: "20" }, "number")).toBe(false)
  })

  it("between is inclusive", () => {
    expect(check(20, { key: "n", operator: "between", value: ["20", "30"] }, "number")).toBe(true)
    expect(check(31, { key: "n", operator: "between", value: ["20", "30"] }, "number")).toBe(false)
  })
})

describe("dates", () => {
  const stamp = "2026-08-13T22:30:00Z"

  it("a day means the whole day, not midnight", () => {
    expect(check(stamp, { key: "d", operator: "eq", value: "2026-08-13" }, "datetime")).toBe(true)
  })

  it("after a day means after all of it", () => {
    expect(check(stamp, { key: "d", operator: "gt", value: "2026-08-13" }, "datetime")).toBe(false)
    expect(check(stamp, { key: "d", operator: "gte", value: "2026-08-13" }, "datetime")).toBe(true)
    expect(check(stamp, { key: "d", operator: "lte", value: "2026-08-13" }, "datetime")).toBe(true)
    expect(check(stamp, { key: "d", operator: "lt", value: "2026-08-13" }, "datetime")).toBe(false)
  })

  it("compares two instants precisely", () => {
    expect(check(stamp, { key: "d", operator: "gt", value: "2026-08-13T10:00:00Z" }, "datetime")).toBe(true)
  })
})

describe("yes and no", () => {
  it("reads a filter's value as the word it is, not as text that happens to be truthy", () => {
    // A filter's value always arrives as text — chosen from a list, or read
    // out of a URL — and `Boolean("false")` is true.
    expect(check(false, { key: "b", operator: "eq", value: "false" }, "boolean")).toBe(true)
    expect(check(true, { key: "b", operator: "eq", value: "false" }, "boolean")).toBe(false)
    expect(check(true, { key: "b", operator: "eq", value: "true" }, "boolean")).toBe(true)
    expect(check(false, { key: "b", operator: "eq", value: "true" }, "boolean")).toBe(false)
  })

  it("takes the other ways of writing it", () => {
    for (const no of ["0", "no", "No", "FALSE", "off"]) {
      expect(check(false, { key: "b", operator: "eq", value: no }, "boolean"), no).toBe(true)
      expect(check(true, { key: "b", operator: "eq", value: no }, "boolean"), no).toBe(false)
    }
    for (const yes of ["1", "yes", "TRUE", "on"]) {
      expect(check(true, { key: "b", operator: "eq", value: yes }, "boolean"), yes).toBe(true)
    }
  })

  it("reads a stored word the same way, and never matches a blank", () => {
    expect(check("false", { key: "b", operator: "eq", value: "false" }, "boolean")).toBe(true)
    expect(check(0, { key: "b", operator: "eq", value: "false" }, "boolean")).toBe(true)
    expect(check(null, { key: "b", operator: "eq", value: "false" }, "boolean")).toBe(false)
  })
})

describe("a range with one end", () => {
  it("is between when both ends are given", () => {
    expect(rangeFilter("n", " 10 ", "20")).toEqual({ key: "n", operator: "between", value: ["10", "20"] })
  })

  it("is at least, or at most, when only one is", () => {
    // A range with an empty end matches nothing; the half that was typed is
    // taken for what it plainly says.
    expect(rangeFilter("n", "10", "")).toEqual({ key: "n", operator: "gte", value: "10" })
    expect(rangeFilter("n", "", "20")).toEqual({ key: "n", operator: "lte", value: "20" })
  })

  it("is no filter at all when neither is", () => {
    expect(rangeFilter("n", "", "  ")).toBeUndefined()
  })
})

describe("lists and tags", () => {
  it("in matches any member", () => {
    expect(check("pro", { key: "p", operator: "in", value: ["free", "pro"] }, "select")).toBe(true)
    expect(check("team", { key: "p", operator: "notIn", value: ["free", "pro"] }, "select")).toBe(true)
  })

  it("a tags column matches when any of its values does", () => {
    expect(check(["a", "b"], { key: "t", operator: "in", value: ["b"] }, "tags")).toBe(true)
    expect(check(["a", "b"], { key: "t", operator: "contains", value: "B" }, "tags")).toBe(true)
    expect(check(["a"], { key: "t", operator: "in", value: ["z"] }, "tags")).toBe(false)
  })
})

describe("select columns", () => {
  const options = [{ value: "pro", label: "Professional" }]
  const context = { ...format, options }

  it("matches the stored value and the label a user can see", () => {
    expect(matchesFilter("pro", { key: "p", operator: "eq", value: "pro" }, type("select"), context)).toBe(true)
    expect(
      matchesFilter("pro", { key: "p", operator: "eq", value: "Professional" }, type("select"), context),
    ).toBe(true)
  })
})

describe("filterRows", () => {
  type Row = { name: string; age: number; plan: string }
  const rows: Row[] = [
    { name: "Ada", age: 36, plan: "pro" },
    { name: "Tom", age: 28, plan: "free" },
    { name: "Zoe", age: 44, plan: "pro" },
  ]

  const columns = resolveColumns<Row, unknown>({
    rows,
    state: createState(),
    types: defaultTypeRegistry,
  }).visible

  const run = (filters: ColumnFilter[], match: "all" | "any" = "all") =>
    filterRows(rows, columns, filters, match, defaultTypeRegistry.get, format).map((row) => row.name)

  it("requires every filter by default", () => {
    expect(run([
      { key: "plan", operator: "eq", value: "pro" },
      { key: "age", operator: "gt", value: "40" },
    ])).toEqual(["Zoe"])
  })

  it("accepts any of them when asked", () => {
    expect(run(
      [
        { key: "plan", operator: "eq", value: "free" },
        { key: "age", operator: "gt", value: "40" },
      ],
      "any",
    )).toEqual(["Tom", "Zoe"])
  })

  it("ignores a filter on a column that no longer exists", () => {
    // A saved view outliving a renamed column should show more than nothing.
    expect(run([{ key: "gone", operator: "eq", value: "x" }])).toHaveLength(3)
  })

  it("ignores an incomplete filter rather than matching nothing", () => {
    expect(run([{ key: "plan", operator: "eq", value: "" }])).toHaveLength(3)
  })
})

describe("normaliseFilter", () => {
  it("gives list operators a list", () => {
    expect(normaliseFilter({ key: "a", operator: "in", value: "x" })).toEqual({ key: "a", operator: "in", value: ["x"] })
    expect(normaliseFilter({ key: "a", operator: "between", value: "1" })).toEqual({
      key: "a",
      operator: "between",
      value: ["1"],
    })
  })

  it("gives everything else a single value", () => {
    // A set filter with one value ticked emits `eq` with a one-element array;
    // left alone, that state no longer round-trips through a URL.
    expect(normaliseFilter({ key: "a", operator: "eq", value: ["pro"] })).toEqual({
      key: "a",
      operator: "eq",
      value: "pro",
    })
  })

  it("drops a value an operator cannot use", () => {
    expect(normaliseFilter({ key: "a", operator: "notEmpty", value: "left over" })).toEqual({
      key: "a",
      operator: "notEmpty",
    })
  })

  it("leaves a filter that is already canonical exactly as it is", () => {
    const filter = { key: "a", operator: "in" as const, value: ["x", "y"] }
    expect(normaliseFilter(filter)).toBe(filter)
  })
})

describe("what the state does with filters", () => {
  it("normalises whatever a caller hands it", () => {
    const state = setFilter(createState(), { key: "plan", operator: "eq", value: ["pro"] })
    expect(state.filters).toEqual([{ key: "plan", operator: "eq", value: "pro" }])
  })

  it("round-trips through a URL unchanged", () => {
    const state = setFilter(createState(), { key: "plan", operator: "eq", value: ["pro"] })
    expect(stateFromUrl(stateToQueryString(state)).filters).toEqual(state.filters)
  })
})
