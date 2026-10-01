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
import React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { createTable, type VanillaColumn } from "@trapezium/vanilla"
import { columns as fullColumns, customTypes, makeRows, type Row } from "@trapezium/core/testing"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Table } from "./table.js"
import type { Column } from "./types.js"

afterEach(cleanup)

const NOW = new Date("2026-08-13T12:00:00.000Z")
const rows = makeRows(40, 9)

/**
 * Every type the two adapters both render, which is all of them.
 *
 * The two adapters type a cell renderer differently — React nodes on one side,
 * DOM nodes on the other — so the same array cannot satisfy both signatures at
 * once. These columns define no renderer at all, which is why handing the same
 * objects to both is sound; the cast says so at the one place it matters.
 */
const columns = fullColumns as Column<Row>[]
const vanillaColumns = fullColumns as VanillaColumn<Row>[]

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
  createTable(host, { ...options, columns: vanillaColumns, state, export: true, ariaLabel: "Parity" })
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
    wrap: cell.getAttribute("data-wrap"),
  }))
}

describe("the two renderers agree", () => {
  /*
    Row height is settled entirely in CSS, so the only thing the two renderers
    have to agree on is what they say about it — one attribute on the root, one
    per cell, and the element a clamped column wraps its content in. If they
    drift here, one stylesheet stops serving both.
  */
  it("on how they describe a row's height", () => {
    const wrapping = {
      ...options,
      columns: undefined,
      rowHeight: "auto" as const,
    }

    const { container } = render(
      <Table
        {...wrapping}
        columns={[{ key: "name", wrap: false }, { key: "bio", wrap: true }, { key: "email", wrap: 2 }]}
      />,
    )
    const react = container.querySelector<HTMLElement>(".tpz")!

    const host = document.createElement("div")
    document.body.append(host)
    createTable(host, {
      ...wrapping,
      columns: [{ key: "name", wrap: false }, { key: "bio", wrap: true }, { key: "email", wrap: 2 }],
    })
    const vanilla = host.querySelector<HTMLElement>(".tpz")!

    expect(vanilla.dataset["rowHeight"]).toBe(react.dataset["rowHeight"])
    expect(cellShape(vanilla)).toEqual(cellShape(react))
    expect(vanilla.querySelectorAll(".tpz-clamp")).toHaveLength(
      react.querySelectorAll(".tpz-clamp").length,
    )
    expect(
      vanilla.querySelector<HTMLElement>(".tpz-clamp")!.style.getPropertyValue("--tpz-cell-lines"),
    ).toBe(react.querySelector<HTMLElement>(".tpz-clamp")!.style.getPropertyValue("--tpz-cell-lines"))
  })

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

  /*
    The header's controls, element for element. One stylesheet reaches the
    order numeral, the magnifier and the search box in all four adapters only
    if both renderers nest the same elements, with the same classes and the
    same attributes saying the same things.
  */
  describe("on the header's controls", () => {
    /** An element reduced to what a stylesheet or a screen reader could tell apart. */
    function outline(node: Element): unknown {
      const attributes: Record<string, string> = {}
      for (const { name, value } of [...node.attributes]) {
        const told =
          name === "class" ||
          name === "role" ||
          name === "type" ||
          name === "href" ||
          name === "title" ||
          name === "placeholder" ||
          name === "scope" ||
          name.startsWith("aria-") ||
          name.startsWith("data-")
        // React says which menu a trigger controls and whether it is open; the
        // DOM renderer builds its menus on demand and has nothing to point at.
        if (told && name !== "aria-expanded" && name !== "aria-controls") attributes[name] = value
      }

      // An icon is an icon: its path is the core's, checked where icons are drawn.
      if (node.tagName.toLowerCase() === "svg") return { tag: "svg", class: attributes["class"] ?? null }

      return {
        tag: node.tagName.toLowerCase(),
        attributes,
        text: [...node.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent).join(""),
        children: [...node.children].map(outline),
      }
    }

    const headerOutline = (root: HTMLElement) => [...root.querySelectorAll("thead th")].map(outline)

    const toolbarLead = (root: HTMLElement) => {
      const groups = root.querySelectorAll(".tpz-toolbar-group")
      const first = groups[groups.length - 1]?.firstElementChild
      return first ? outline(first) : null
    }

    const searched = {
      sort: [
        { key: "plan", direction: "asc" as const },
        { key: "name", direction: "desc" as const },
        { key: "count", direction: "asc" as const },
      ],
      filters: [{ key: "email", operator: "contains" as const, value: "example" }],
    }

    function pair(extra: Record<string, unknown>, state: Record<string, unknown>) {
      const { container } = render(<Table {...options} {...extra} defaultState={state} aria-label="Parity" />)
      const react = container.querySelector<HTMLElement>(".tpz")!

      const host = document.createElement("div")
      document.body.append(host)
      createTable(host, { ...options, ...extra, columns: vanillaColumns, state, ariaLabel: "Parity" })
      const vanilla = host.querySelector<HTMLElement>(".tpz")!

      return { react, vanilla }
    }

    it("with several sort levels and a search in a column header", () => {
      const { react, vanilla } = pair({ headerSearch: true }, searched)

      expect(headerOutline(vanilla)).toEqual(headerOutline(react))
      // The numerals are there to be compared at all.
      expect(react.querySelectorAll(".tpz-th-order")).toHaveLength(3)
      expect(react.querySelectorAll('.tpz-th-search[data-active="true"]')).toHaveLength(1)
    })

    it("when every control is a link", () => {
      const buildHref = (state: { sort: Array<{ key: string; direction: string }>; page: number }) =>
        `/rows?sort=${state.sort.map((level) => `${level.key}.${level.direction}`).join("-")}&page=${String(state.page)}`

      const { react, vanilla } = pair({ headerSearch: true, buildHref }, searched)

      expect(headerOutline(vanilla)).toEqual(headerOutline(react))
      expect(react.querySelector("thead a.tpz-th-button")).not.toBeNull()
    })

    it("on the reset that leads the toolbar, as a button and as a link", () => {
      const asButton = pair({}, searched)
      expect(toolbarLead(asButton.vanilla)).toEqual(toolbarLead(asButton.react))
      expect(asButton.react.querySelector("button.tpz-sort-reset")).not.toBeNull()

      const asLink = pair({ buildHref: () => "/rows" }, searched)
      expect(toolbarLead(asLink.vanilla)).toEqual(toolbarLead(asLink.react))
      expect(asLink.react.querySelector("a.tpz-sort-reset")).not.toBeNull()
    })

    it("with no reset when the table is in its resting order", () => {
      const { react, vanilla } = pair({}, {})
      expect(vanilla.querySelector(".tpz-sort-reset")).toBeNull()
      expect(react.querySelector(".tpz-sort-reset")).toBeNull()
    })

    it("on the search box, once it is open", () => {
      const { react, vanilla } = pair({ headerSearch: true }, searched)

      const open = (root: HTMLElement) => {
        const trigger = root.querySelector<HTMLElement>('thead th[data-key="email"] .tpz-th-search')!
        act(() => trigger.click())
        return outline(root.querySelector('thead th[data-key="email"]')!)
      }

      const fromVanilla = open(vanilla)
      const fromReact = open(react)

      expect(fromVanilla).toEqual(fromReact)
      expect(react.querySelector(".tpz-th-searchbox .tpz-th-search-input")).not.toBeNull()
      expect(react.querySelector<HTMLInputElement>(".tpz-th-search-input")?.value).toBe("example")
      expect(vanilla.querySelector<HTMLInputElement>(".tpz-th-search-input")?.value).toBe("example")
    })
  })

  it("on the empty state", () => {
    const empty = { ...options, data: [] as Row[] }

    const host = document.createElement("div")
    document.body.append(host)
    createTable(host, { ...empty, columns: vanillaColumns, ariaLabel: "Parity" })

    const { container } = render(<Table {...empty} aria-label="Parity" />)

    expect(host.querySelector(".tpz-state")?.textContent).toEqual(
      container.querySelector(".tpz-state")?.textContent,
    )
  })
})

describe("server rendering, with every type", () => {
  it("renders the finished table as HTML and hydrates it without a mismatch", async () => {
    const { renderToString } = await import("react-dom/server")
    const { hydrateRoot } = await import("react-dom/client")

    const element = (
      <Table
        {...options}
        defaultState={{
          sort: [{ key: "version", direction: "desc" }],
          filters: [{ key: "plan", operator: "in", value: ["pro", "team"] }],
          pageSize: 8,
        }}
        aria-label="Parity"
      />
    )

    const html = renderToString(element)

    // The server sent finished rows, not a shell to be filled in later.
    expect(html).toContain("<table")
    expect(html.match(/<tr/g)?.length ?? 0).toBeGreaterThan(5)

    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)

    const problems: unknown[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => problems.push(args))

    act(() => {
      hydrateRoot(container, element)
    })

    spy.mockRestore()
    container.remove()

    expect(problems).toEqual([])
  })
})

describe("under React's strictness", () => {
  it("renders the same table when everything happens twice", () => {
    const { StrictMode } = React

    const { container } = render(
      <StrictMode>
        <Table {...options} aria-label="Parity" />
      </StrictMode>,
    )

    // Double-invoked renders and effects must not duplicate rows, columns or
    // the sentinel — the usual symptoms of state built during render.
    expect(container.querySelectorAll("tbody tr")).toHaveLength(10)
    expect(container.querySelectorAll("thead tr")).toHaveLength(1)
    expect(container.querySelectorAll(".tpz-table")).toHaveLength(1)
  })
})
