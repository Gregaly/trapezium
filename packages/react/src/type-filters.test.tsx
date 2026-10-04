import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TableState } from "@trapezium/core"
import { columns as fullColumns, customTypes, filterPlans, makeRows, type FilterPlan, type Row } from "@trapezium/core/testing"

import { Table } from "./table.js"
import type { Column } from "./types.js"

/**
 * Every type's own filter, through its column menu.
 *
 * The plans come from the core's testing kit: for each column of the
 * full-spectrum dataset, which control the menu should show, what to do with
 * it, the filter that should come out, and exactly which rows should be left.
 * This carries each one out through the real panel, because the control is
 * where a filter can fail before the engine is ever asked — a box that cannot
 * hold the value, a "No" that is read as a "Yes".
 */

afterEach(cleanup)

const NOW = new Date("2026-08-13T12:00:00.000Z")
const rows = makeRows(120, 13)
const plans = filterPlans(rows)

function mount(state?: Partial<TableState>) {
  const onStateChange = vi.fn<(state: TableState) => void>()
  const { container } = render(
    <Table
      data={rows}
      columns={fullColumns as Column<Row>[]}
      types={customTypes}
      getRowId={(row) => row.id}
      format={{ now: NOW }}
      pagination={false}
      defaultState={state}
      onStateChange={onStateChange}
      aria-label="Everything"
    />,
  )

  return {
    container,
    filters: () => onStateChange.mock.calls.at(-1)?.[0].filters ?? state?.filters ?? [],
    shown: () =>
      [...container.querySelectorAll<HTMLElement>('tbody td[data-key="id"]')].map((cell) => cell.textContent?.trim() ?? ""),
  }
}

/** Opens a column's menu and returns its filter control, if it has one. */
function filterOf(container: HTMLElement, key: string): HTMLElement | null {
  const trigger = container.querySelector<HTMLElement>(`thead th[data-key="${key}"] .tpz-th-menu`)
  if (!trigger) throw new Error(`no menu for ${key}`)
  fireEvent.click(trigger)
  return document.querySelector<HTMLElement>(".tpz-portal .tpz-filter")
}

const press = (filter: HTMLElement, label: string) => {
  const button = [...filter.querySelectorAll<HTMLElement>("button")].find((entry) => entry.textContent === label)
  if (!button) throw new Error(`no "${label}" button`)
  fireEvent.click(button)
}

/** Does what the plan says, the way a person would. */
function carryOut(container: HTMLElement, plan: FilterPlan) {
  const filter = filterOf(container, plan.key)

  if (plan.control === "none") {
    expect(filter, "a filter control").toBeNull()
    return
  }
  if (!filter) throw new Error(`${plan.key} has no filter control`)

  if (plan.control === "set") {
    const option = [...filter.querySelectorAll<HTMLElement>(".tpz-filter-option")].find(
      (entry) => entry.querySelector(".tpz-filter-option-label")?.textContent === plan.choice,
    )
    const box = option?.querySelector<HTMLInputElement>("input")
    expect(box, `the choice "${String(plan.choice)}"`).toBeTruthy()
    if (box) fireEvent.click(box)
    return
  }

  if (plan.control === "boolean") {
    const select = filter.querySelector<HTMLSelectElement>("select")
    if (!select) throw new Error("no yes/no list")
    fireEvent.change(select, { target: { value: plan.choice } })
    return
  }

  const operators = filter.querySelector<HTMLSelectElement>("select")
  if (!operators) throw new Error("no operator list")
  // Offered, which is the first thing: an operator not in the list cannot be chosen.
  expect([...operators.options].map((option) => option.value)).toContain(plan.operator)
  fireEvent.change(operators, { target: { value: plan.operator } })

  const inputs = [...filter.querySelectorAll<HTMLInputElement>("input")]
  const values = plan.values ?? []
  expect(inputs).toHaveLength(values.length)

  values.forEach((value, index) => {
    const input = inputs[index]
    if (!input) throw new Error("a box is missing")
    // The box can hold the value: a time of day needs a time box.
    expect(input.getAttribute("type")).toBe(plan.input)
    fireEvent.change(input, { target: { value } })
    // A browser refuses what a box cannot hold, and so does jsdom.
    expect(input.value, `a ${String(plan.input)} box holding "${value}"`).toBe(value)
  })

  press(filter, "Apply")
}

describe("every type's own filter, through its column menu", () => {
  for (const plan of plans) {
    it(`${plan.key}: ${plan.name}`, () => {
      const table = mount()
      carryOut(table.container, plan)

      expect(table.filters()).toEqual(plan.filter ? [plan.filter] : [])
      expect(table.shown()).toEqual(plan.expected)
    })
  }
})

describe("what the boxes do with a half-filled range", () => {
  const range = (container: HTMLElement, key: string, low: string, high: string) => {
    const filter = filterOf(container, key)
    const operators = filter?.querySelector<HTMLSelectElement>("select")
    if (!filter || !operators) throw new Error(`no value filter on ${key}`)
    fireEvent.change(operators, { target: { value: "between" } })

    const [first, second] = [...filter.querySelectorAll<HTMLInputElement>("input")]
    if (!first || !second) throw new Error("a range needs two boxes")
    fireEvent.change(first, { target: { value: low } })
    fireEvent.change(second, { target: { value: high } })
    press(filter, "Apply")
  }

  it("takes only a lower bound as at least", () => {
    const table = mount()
    range(table.container, "count", "500", "")

    expect(table.filters()).toEqual([{ key: "count", operator: "gte", value: "500" }])
    expect(table.shown()).toEqual(rows.filter((row) => row.count !== null && row.count >= 500).map((row) => row.id))
  })

  it("takes only an upper bound as at most", () => {
    const table = mount()
    range(table.container, "count", "", "0")

    expect(table.filters()).toEqual([{ key: "count", operator: "lte", value: "0" }])
    expect(table.shown()).toEqual(rows.filter((row) => row.count !== null && row.count <= 0).map((row) => row.id))
  })

  it("takes neither as no filter", () => {
    const table = mount()
    range(table.container, "count", "", "")

    expect(table.filters()).toEqual([])
    expect(table.shown()).toHaveLength(rows.length)
  })
})

describe("the panel around the boxes", () => {
  it("closes behind its Clear button", () => {
    const table = mount({ filters: [{ key: "count", operator: "gt", value: "100" }] })

    const filter = filterOf(table.container, "count")
    if (!filter) throw new Error("no filter")
    press(filter, "Clear")

    expect(table.filters()).toEqual([])
    expect(document.querySelector(".tpz-portal")).toBeNull()
  })

  it("stays open when the last box of a set filter is unticked, which is not somebody finishing", () => {
    const table = mount({ filters: [{ key: "status", operator: "eq", value: "active" }] })

    const filter = filterOf(table.container, "status")
    const ticked = filter?.querySelector<HTMLInputElement>("input:checked")
    expect(ticked).toBeTruthy()
    if (ticked) fireEvent.click(ticked)

    expect(table.filters()).toEqual([])
    expect(document.querySelector(".tpz-portal .tpz-filter")).not.toBeNull()
  })

  it("shows an operator nobody defined as it was written, rather than as a blank", () => {
    const table = mount({ filters: [{ key: "name", operator: "sounds-like" as never, value: "ada" }] })

    const operators = filterOf(table.container, "name")?.querySelector<HTMLSelectElement>("select")
    const chosen = [...(operators?.options ?? [])].find((option) => option.value === "sounds-like")
    expect(chosen?.textContent).toBe("sounds-like")
  })

  it("reopens a list of values as the list that was typed", () => {
    const table = mount({ filters: [{ key: "count", operator: "in" as never, value: ["10", "20"] }] })

    const input = filterOf(table.container, "count")?.querySelector<HTMLInputElement>("input")
    // A number box cannot hold "10, 20".
    expect(input?.getAttribute("type")).toBe("text")
    expect(input?.value).toBe("10, 20")
  })
})
