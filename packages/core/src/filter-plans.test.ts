import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { DEFAULT_FORMAT } from "./format.js"
import { filterInputType, filterRows } from "./filter.js"
import { createTypeRegistry } from "./registry.js"
import { createState } from "./state.js"
import { columns, customTypes, makeRows, type Row } from "./testing/dataset.js"
import { filterPlans } from "./testing/filter-plans.js"
import type { FilterOperator } from "./types.js"

/**
 * Every type's own filter, checked against plain predicates.
 *
 * The plans say which control each column's menu should show, what to put in
 * it, and exactly which rows should be left. Here they are held against the
 * engine and against the rule that picks the box; the adapters then carry the
 * same plans out through their real menus.
 */

const NOW = new Date("2026-08-13T12:00:00.000Z")
const FORMAT = { ...DEFAULT_FORMAT, now: NOW }

const rows = makeRows(300, 13)
const types = createTypeRegistry(customTypes)
const resolved = resolveColumns<Row, unknown>({ columns, rows, state: createState(), types }).visible
const plans = filterPlans(rows)

const columnOf = (key: string) => {
  const column = resolved.find((entry) => entry.key === key)
  if (!column) throw new Error(`no column ${key}`)
  return column
}

describe("the plans cover the dataset", () => {
  it("has one for every column", () => {
    const planned = new Set(plans.map((plan) => plan.key))
    expect(resolved.map((column) => column.key).filter((key) => !planned.has(key))).toEqual([])
  })

  it("is not vacuous: every plan leaves some rows and takes some away", () => {
    for (const plan of plans) {
      if (plan.control === "none") continue
      expect(plan.expected.length, `${plan.key}: ${plan.name}`).toBeGreaterThan(0)
      expect(plan.expected.length, `${plan.key}: ${plan.name}`).toBeLessThan(rows.length)
    }
  })
})

describe("each type is given a control that can hold its values", () => {
  for (const plan of plans) {
    it(`${plan.key}: ${plan.name}`, () => {
      const column = columnOf(plan.key)

      const control =
        column.filterKind === "none"
          ? "none"
          : column.filterKind === "set"
            ? "set"
            : column.filterKind === "boolean"
              ? "boolean"
              : "value"
      expect(control).toBe(plan.control)

      if (plan.control === "value" && plan.operator) {
        // The operator is one the column offers, and the box suits the value.
        expect(column.operators).toContain(plan.operator)
        expect(filterInputType(column, plan.operator)).toBe(plan.input)
      }
    })
  }

  it("gives a time of day a time box, not a number box", () => {
    const starts = columnOf("startsAt")
    for (const operator of ["eq", "gt", "between"] as FilterOperator[]) {
      expect(filterInputType(starts, operator)).toBe("time")
    }
  })

  it("gives the text operators and the list operators a plain text box, whatever the column", () => {
    expect(filterInputType(columnOf("birthday"), "contains")).toBe("text")
    expect(filterInputType(columnOf("count"), "startsWith")).toBe("text")
    expect(filterInputType(columnOf("count"), "in")).toBe("text")
    expect(filterInputType(columnOf("id"), "in")).toBe("text")
  })

  it("gives dates a date picker and numbers a number box", () => {
    for (const key of ["birthday", "seenAt", "updatedAt"]) expect(filterInputType(columnOf(key), "gte")).toBe("date")
    for (const key of ["count", "amountCents", "ratio"]) expect(filterInputType(columnOf(key), "gte")).toBe("number")
  })
})

describe("each plan's filter leaves exactly the rows it should", () => {
  for (const plan of plans) {
    if (!plan.filter) continue
    const filter = plan.filter

    it(`${plan.key}: ${plan.name}`, () => {
      const left = filterRows(rows, resolved, [filter], "all", types.get, FORMAT)
      expect(left.map((row) => row.id)).toEqual(plan.expected)
    })
  }
})
