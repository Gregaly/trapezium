/**
 * @vitest-environment jsdom
 *
 * Every type's own filter, through its column menu.
 *
 * The plans come from the core's testing kit: for each column of the
 * full-spectrum dataset, which control the menu should show, what to do with
 * it, the filter that should come out, and exactly which rows should be left.
 * This carries each one out with real clicks and real typing, because the
 * control is where a filter can fail before the engine is ever asked — a box
 * that cannot hold the value, a "No" that is read as a "Yes".
 *
 * Vue and Svelte draw their menus with this renderer, so this is their proof.
 */
import { columns as fullColumns, customTypes, filterPlans, makeRows, type FilterPlan, type Row } from "@trapezium/core/testing"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createTable, type TableInstance, type VanillaColumn } from "./table.js"

const NOW = new Date("2026-08-13T12:00:00.000Z")
const rows = makeRows(120, 13)
const plans = filterPlans(rows)

let host: HTMLElement
let table: TableInstance<Row>

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  table = createTable(host, {
    data: rows,
    columns: fullColumns as VanillaColumn<Row>[],
    types: customTypes,
    getRowId: (row) => row.id,
    format: { now: NOW },
    pagination: false,
  })
})

afterEach(() => {
  table.destroy()
  host.remove()
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

/** The ids of the rows on screen, in order. */
const shown = () =>
  [...host.querySelectorAll<HTMLElement>('tbody td[data-key="id"]')].map((cell) => cell.textContent?.trim() ?? "")

/** Opens a column's menu and returns its filter control, if it has one. */
function filterOf(key: string): HTMLElement | null {
  const trigger = host.querySelector<HTMLElement>(`thead th[data-key="${key}"] .tpz-th-menu`)
  if (!trigger) throw new Error(`no menu for ${key}`)
  trigger.click()
  return document.querySelector<HTMLElement>(".tpz-portal .tpz-filter")
}

function change(element: HTMLSelectElement | HTMLInputElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

/** Does what the plan says, the way a person would. */
function carryOut(plan: FilterPlan) {
  const filter = filterOf(plan.key)

  if (plan.control === "none") {
    expect(filter, "a filter control").toBeNull()
    return
  }
  if (!filter) throw new Error(`${plan.key} has no filter control`)

  if (plan.control === "set") {
    const option = [...filter.querySelectorAll<HTMLElement>(".tpz-filter-option")].find(
      (entry) => entry.querySelector(".tpz-filter-option-label")?.textContent === plan.choice,
    )
    expect(option, `the choice "${String(plan.choice)}"`).toBeDefined()
    option?.querySelector<HTMLInputElement>("input")?.click()
    return
  }

  if (plan.control === "boolean") {
    const select = filter.querySelector<HTMLSelectElement>("select")
    if (!select) throw new Error("no yes/no list")
    change(select, plan.choice ?? "")
    return
  }

  const operators = filter.querySelector<HTMLSelectElement>("select")
  if (!operators) throw new Error("no operator list")
  // Offered, which is the first thing: an operator not in the list cannot be chosen.
  expect([...operators.options].map((option) => option.value)).toContain(plan.operator)
  change(operators, plan.operator ?? "")

  const inputs = [...filter.querySelectorAll<HTMLInputElement>("input")]
  const values = plan.values ?? []
  expect(inputs).toHaveLength(values.length)

  values.forEach((value, index) => {
    const input = inputs[index]
    if (!input) throw new Error("a box is missing")
    // The box can hold the value: a time of day needs a time box.
    expect(input.getAttribute("type")).toBe(plan.input)
    input.value = value
    // A browser refuses what a box cannot hold, and so does jsdom.
    expect(input.value, `a ${String(plan.input)} box holding "${value}"`).toBe(value)
  })

  const apply = [...filter.querySelectorAll<HTMLElement>("button")].find((button) => button.textContent === "Apply")
  apply?.click()
}

describe("every type's own filter, through its column menu", () => {
  for (const plan of plans) {
    it(`${plan.key}: ${plan.name}`, () => {
      carryOut(plan)

      expect(table.getState().filters).toEqual(plan.filter ? [plan.filter] : [])
      expect(shown()).toEqual(plan.expected)
    })
  }
})

describe("what the boxes do with a half-filled range", () => {
  const range = (key: string, low: string, high: string) => {
    const filter = filterOf(key)
    const operators = filter?.querySelector<HTMLSelectElement>("select")
    if (!filter || !operators) throw new Error(`no value filter on ${key}`)
    change(operators, "between")

    const [first, second] = [...filter.querySelectorAll<HTMLInputElement>("input")]
    if (!first || !second) throw new Error("a range needs two boxes")
    first.value = low
    second.value = high
    ;[...filter.querySelectorAll<HTMLElement>("button")].find((button) => button.textContent === "Apply")?.click()
  }

  it("takes only a lower bound as at least", () => {
    range("count", "500", "")
    expect(table.getState().filters).toEqual([{ key: "count", operator: "gte", value: "500" }])
    expect(shown()).toEqual(rows.filter((row) => row.count !== null && row.count >= 500).map((row) => row.id))
  })

  it("takes only an upper bound as at most", () => {
    range("count", "", "0")
    expect(table.getState().filters).toEqual([{ key: "count", operator: "lte", value: "0" }])
    expect(shown()).toEqual(rows.filter((row) => row.count !== null && row.count <= 0).map((row) => row.id))
  })

  it("takes neither as no filter", () => {
    range("count", "", "")
    expect(table.getState().filters).toEqual([])
    expect(shown()).toHaveLength(rows.length)
  })
})

describe("the panel around the boxes", () => {
  it("keeps the operator list focused when the operator changes the boxes", () => {
    // A closed list changes its value on every arrow key, so losing focus on
    // a change would throw a keyboard out of the panel one option in.
    const filter = filterOf("count")
    const operators = filter?.querySelector<HTMLSelectElement>("select")
    if (!filter || !operators) throw new Error("no value filter")

    operators.focus()
    for (const operator of ["between", "notEmpty", "gt", "between", "eq"]) {
      change(operators, operator)
      expect(document.activeElement, operator).toBe(operators)
    }
    expect(filter.querySelectorAll("input")).toHaveLength(1)
  })

  it("closes behind its Clear button", () => {
    table.setState({ filters: [{ key: "count", operator: "gt", value: "100" }] })

    const filter = filterOf("count")
    ;[...(filter?.querySelectorAll<HTMLElement>("button") ?? [])].find((button) => button.textContent === "Clear")?.click()

    expect(table.getState().filters).toEqual([])
    expect(document.querySelector(".tpz-portal")).toBeNull()
  })

  it("shows an operator nobody defined as it was written, rather than as a blank", () => {
    table.setState({ filters: [{ key: "name", operator: "sounds-like" as never, value: "ada" }] })

    const operators = filterOf("name")?.querySelector<HTMLSelectElement>("select")
    const chosen = [...(operators?.options ?? [])].find((option) => option.value === "sounds-like")
    expect(chosen?.textContent).toBe("sounds-like")
  })

  it("reopens a list of values as the list that was typed", () => {
    table.setState({ filters: [{ key: "count", operator: "in" as never, value: ["10", "20"] }] })

    const input = filterOf("count")?.querySelector<HTMLInputElement>("input")
    // A number box cannot hold "10, 20".
    expect(input?.getAttribute("type")).toBe("text")
    expect(input?.value).toBe("10, 20")
  })
})
