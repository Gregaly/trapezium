/**
 * @vitest-environment jsdom
 *
 * A server render is the client render, byte for byte.
 *
 * That is the promise that lets Vue and Svelte put the table in server HTML
 * and swap the live one in without anything moving. It is kept here by
 * rendering the same options both ways — once through the in-memory document,
 * once through jsdom — and comparing the strings.
 */
import { columns as fullColumns, customTypes, makeRows, type Row } from "@trapezium/core/testing"
import { afterEach, describe, expect, it } from "vitest"

import { renderToString } from "./render-to-string.js"
import { createTable, type TableOptions, type VanillaColumn } from "./table.js"

const NOW = new Date("2026-08-13T12:00:00.000Z")
const rows = makeRows(40, 9)
const columns = fullColumns as VanillaColumn<Row>[]

const base: TableOptions<Row> = {
  data: rows,
  columns,
  types: customTypes,
  getRowId: (row) => row.id,
  format: { now: NOW, currency: "AUD", locale: "en" },
  pagination: { pageSize: 10, pageSizeOptions: [10, 25] },
  selection: { isSelectable: (row) => row.active !== false },
  search: true,
  export: true,
  densityControl: true,
  ariaLabel: "Parity",
  caption: "Rows",
  footer: "Forty rows",
  appendRow: "Add another",
  maxHeight: 480,
}

afterEach(() => {
  document.body.replaceChildren()
})

/** What the live table renders into an empty host, as HTML. */
function clientHtml(options: TableOptions<Row>): string {
  const host = document.createElement("div")
  document.body.append(host)
  const table = createTable(host, options)
  const html = host.innerHTML
  table.destroy()
  return html
}

describe("renderToString", () => {
  it("writes a real table", () => {
    const html = renderToString(base)
    expect(html.startsWith('<div class="tpz"')).toBe(true)
    expect(html).toContain('<table class="tpz-table" aria-label="Parity">')
    expect(html).toContain("<caption")
    // The header row, ten rows of data and the appended row.
    expect((html.match(/<tr class="tpz-tr"/g) ?? []).length).toBe(12)
  })

  it("is byte for byte what the client renders", () => {
    expect(renderToString(base)).toBe(clientHtml(base))
  })

  it("agrees after sorting, filtering, paging and selecting", () => {
    const options: TableOptions<Row> = {
      ...base,
      state: {
        sort: [{ key: "version", direction: "desc" }],
        filters: [{ key: "plan", operator: "in", value: ["pro", "team"] }, { key: "name", operator: "contains", value: "a" }],
        page: 2,
        pageSize: 5,
        selection: [rows[3]!.id, rows[7]!.id],
        hidden: ["notes"],
        pinned: { name: "start" },
        widths: { name: 240 },
      },
    }
    expect(renderToString(options)).toBe(clientHtml(options))
  })

  it("agrees on the states with no rows", () => {
    const empty: TableOptions<Row> = { ...base, data: [], footer: undefined, appendRow: undefined }
    expect(renderToString(empty)).toBe(clientHtml(empty))
    expect(renderToString({ ...empty, loading: true })).toBe(clientHtml({ ...empty, loading: true }))
    expect(renderToString({ ...empty, error: "Broken" })).toBe(clientHtml({ ...empty, error: "Broken" }))
  })

  it("agrees on the card layout, a dark theme, exact row heights and class overrides", () => {
    const options: TableOptions<Row> = {
      ...base,
      responsive: "cards",
      theme: "dark",
      rowHeight: 48,
      density: "compact",
      className: "mine",
      classNames: { row: "hover", cell: "mono" },
      rowHref: (row) => `/rows/${row.id}`,
      rowClassName: (row) => (row.active ? undefined : "inactive"),
    }
    expect(renderToString(options)).toBe(clientHtml(options))
  })

  it("agrees in the append modes", () => {
    const more: TableOptions<Row> = { ...base, pagination: { mode: "loadMore", pageSize: 10 } }
    expect(renderToString(more)).toBe(clientHtml(more))
    const infinite: TableOptions<Row> = { ...base, pagination: { mode: "infinite", pageSize: 10 } }
    expect(renderToString(infinite)).toBe(clientHtml(infinite))
  })

  it("escapes what the rows contain", () => {
    const html = renderToString({
      data: [{ id: "1", name: '<img src=x onerror="alert(1)"> & "quotes"' }],
      columns: ["name"],
      pagination: false,
    })
    expect(html).not.toContain("<img")
    // Text escapes the three characters HTML text needs escaped, and no more.
    expect(html).toContain('&lt;img src=x onerror="alert(1)"&gt; &amp; "quotes"')
  })

  it("leaves out a slot it cannot write, and keeps one it can", () => {
    const node = { nodeType: 1 } as unknown as Node
    const html = renderToString({ data: rows.slice(0, 2), columns: ["name"], toolbar: node, footer: "Two" })
    expect(html).toContain('<div class="tpz-footer">Two</div>')
    expect(html).not.toContain("[object")
  })
})

describe("createTable over server markup", () => {
  it("replaces the markup in place rather than adding a second table", () => {
    const host = document.createElement("div")
    host.innerHTML = renderToString(base)
    document.body.append(host)

    const table = createTable(host, base)

    expect(host.querySelectorAll(".tpz")).toHaveLength(1)
    expect(host.firstElementChild).toBe(table.element)
    table.destroy()
  })
})
