/**
 * @vitest-environment jsdom
 *
 * The adapters must agree.
 *
 * Every adapter renders the same DOM with the same class names, which is what
 * lets one stylesheet serve all of them and one fix land everywhere. That is a
 * promise the code cannot keep on its own — it is kept by this file, which
 * renders the same table twice, once through React and once through the DOM
 * renderer, and insists the results are the same table.
 *
 * Vue and Svelte wrap the DOM renderer, so proving these two agree proves all
 * four.
 */
import { act, cleanup, render } from "@testing-library/react"
import { createTable } from "@trapezium/vanilla"
import { columns as fullColumns, customTypes, makeRows, type Row } from "@trapezium/core/testing"
import { afterEach, describe, expect, it } from "vitest"

import { Table } from "./table.js"
import type { Column } from "./types.js"

afterEach(cleanup)

const NOW = new Date("2026-08-13T12:00:00.000Z")
const rows = makeRows(40, 9)

/** Every type the two adapters both render, which is all of them. */
const columns = fullColumns as Column<Row>[]

const options = {
  data: rows,
  columns,
  types: customTypes,
  getRowId: (row: Row) => row.id,
  format: { now: NOW, currency: "AUD", locale: "en" },
  pagination: { pageSize: 10 } as const,
  selection: "multiple" as const,
  search: true as const,
}

function reactTable(state?: Record<string, unknown>) {
  const { container } = render(
    <Table
      {...options}
      defaultState={state}
      export
      // The React adapter names the table; the DOM one takes the same string.
      aria-label="Parity"
    />,
  )
  return container.querySelector<HTMLElement>(".tpz")!
}

function vanillaTable(state?: Record<string, unknown>) {
  const host = document.createElement("div")
  document.body.append(host)
  createTable(host, { ...options, state, export: true, ariaLabel: "Parity" })
  return host.querySelector<HTMLElement>(".tpz")!
}

/** The text of every cell, row by row. */
function cells(root: HTMLElement): string[][] {
  return [...root.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""),
  )
}

/** The structural attributes a stylesheet depends on, per header cell. */
function headerShape(root: HTMLElement): Array<Record<string, string | null>> {
  return [...root.querySelectorAll("thead th")].map((cell) => ({
    class: cell.getAttribute("class"),
    key: cell.getAttribute("data-key"),
    align: cell.getAttribute("data-align"),
    pin: cell.getAttribute("data-pin"),
    sort: cell.getAttribute("aria-sort"),
    scope: cell.getAttribute("scope"),
  }))
}

function cellShape(root: HTMLElement): Array<Record<string, string | null>> {
  return [...root.querySelectorAll("tbody tr:first-child td")].map((cell) => ({
    class: cell.getAttribute("class"),
    key: cell.getAttribute("data-key"),
    align: cell.getAttribute("data-align"),
    mono: cell.getAttribute("data-mono"),
    label: cell.getAttribute("data-label"),
    pin: cell.getAttribute("data-pin"),
  }))
}

describe("the two renderers agree", () => {
  it("on the header", () => {
    expect(headerShape(vanillaTable())).toEqual(headerShape(reactTable()))
  })

  it("on the shape of a row", () => {
    expect(cellShape(vanillaTable())).toEqual(cellShape(reactTable()))
  })

  it("on every value in every cell, for every type", () => {
    expect(cells(vanillaTable())).toEqual(cells(reactTable()))
  })

  it("on the structure of the frame", () => {
    const shape = (root: HTMLElement) =>
      [".tpz-frame", ".tpz-toolbar", ".tpz-scroll", ".tpz-table", ".tpz-thead", ".tpz-tbody", ".tpz-pagination", ".tpz-sentinel"]
        .map((selector) => `${selector}:${String(root.querySelectorAll(selector).length)}`)
        .join(" ")

    expect(shape(vanillaTable())).toEqual(shape(reactTable()))
  })

  it("after sorting, filtering and paging", () => {
    const state = {
      sort: [{ key: "version", direction: "desc" as const }],
      filters: [{ key: "plan", operator: "in" as const, value: ["pro", "team"] }],
      page: 2,
      pageSize: 5,
    }

    expect(cells(vanillaTable(state))).toEqual(cells(reactTable(state)))
  })

  it("on what a set filter offers, including for a custom type", () => {
    const labels = (root: HTMLElement) => {
      const trigger = [...root.querySelectorAll<HTMLButtonElement>(".tpz-th-menu")].find((button) =>
        button.getAttribute("aria-label")?.startsWith("Priority"),
      )!

      // React opens its panel through a state update; the DOM renderer opens
      // its own synchronously. Flushing covers both.
      act(() => trigger.click())

      // The panel each one just opened, rather than one left over.
      const panels = document.querySelectorAll(".tpz-portal")
      const panel = panels[panels.length - 1]!
      const found = [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)

      // Closed the way a user closes it, so React takes its own node away
      // rather than finding it already gone.
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      })

      return found.sort()
    }

    const fromVanilla = labels(vanillaTable())
    const fromReact = labels(reactTable())

    expect(fromVanilla).toEqual(fromReact)
    // And both use the custom type's own formatter, not the stored value.
    expect(fromVanilla).toContain("Blocker")
  })

  it("on the empty state", () => {
    const empty = { ...options, data: [] as Row[] }

    const host = document.createElement("div")
    document.body.append(host)
    createTable(host, { ...empty, ariaLabel: "Parity" })

    const { container } = render(<Table {...empty} aria-label="Parity" />)

    expect(host.querySelector(".tpz-state")?.textContent).toEqual(
      container.querySelector(".tpz-state")?.textContent,
    )
  })
})
