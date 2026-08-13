import { describe, expect, it } from "vitest"

import { resolveColumns } from "./columns.js"
import { toCsv, toDelimitedText } from "./csv.js"
import { DEFAULT_FORMAT } from "./format.js"
import { createTypeRegistry, defaultTypeRegistry } from "./registry.js"
import { createState } from "./state.js"
import type { AnyRow, ColumnDef } from "./types.js"

/**
 * What ends up in the file.
 *
 * A spreadsheet is not a page. "$4,790.50" is right in a cell and useless in a
 * column somebody wants to add up, and "Aug 13, 2026" cannot be sorted as a
 * date by anything that opens the file — so money and dates go in as a number
 * and an ISO date, while a select column still goes in as its label.
 */

const types = defaultTypeRegistry
const format = DEFAULT_FORMAT

function csv<TRow extends AnyRow>(rows: TRow[], columns: ColumnDef<TRow>[]): string[] {
  const visible = resolveColumns<TRow, unknown>({ columns, rows, state: createState(), types }).visible
  return toCsv(rows, { columns: visible, types, format, bom: false }).split("\r\n")
}

describe("values a spreadsheet can work with", () => {
  it("writes numbers as numbers, without grouping", () => {
    const [, row] = csv([{ n: 1_234_567.5 }], [{ key: "n", type: "number" }])
    expect(row).toBe("1234567.5")
  })

  it("writes money as a number in major units, with no symbol", () => {
    const [, minor] = csv([{ amount: 479_050 }], [
      { key: "amount", type: "currency", formatOptions: { currencyInMinorUnits: true } },
    ])
    expect(minor).toBe("4790.5")

    const [, major] = csv([{ amount: 4790.5 }], [{ key: "amount", type: "currency" }])
    expect(major).toBe("4790.5")
  })

  it("writes dates as ISO, so they sort wherever the file lands", () => {
    const [, row] = csv([{ due: "2026-08-13", when: "2026-08-13T22:30:00Z" }], [
      { key: "due", type: "date" },
      { key: "when", type: "datetime" },
    ])
    expect(row).toBe("2026-08-13,2026-08-13T22:30:00.000Z")
  })

  it("writes a relative time as the instant it refers to", () => {
    // "3 days ago" means nothing in a file read next week.
    const [, row] = csv([{ seen: "2026-08-10T12:00:00Z" }], [{ key: "seen", type: "relativeTime" }])
    expect(row).toBe("2026-08-10T12:00:00.000Z")
  })

  it("leaves an empty value empty rather than writing a placeholder", () => {
    const [, row] = csv([{ n: null, d: null }], [
      { key: "n", type: "number" },
      { key: "d", type: "date" },
    ])
    expect(row).toBe(",")
  })
})

describe("values a person needs to read", () => {
  it("writes the label of a choice, not the value stored underneath", () => {
    const [, row] = csv([{ plan: "pro" }], [
      { key: "plan", type: "select", formatOptions: { options: [{ value: "pro", label: "Professional" }] } },
    ])
    expect(row).toBe("Professional")
  })

  it("writes a checkbox as a word", () => {
    const [, row] = csv([{ ok: true, no: false }], [
      { key: "ok", type: "boolean" },
      { key: "no", type: "boolean" },
    ])
    expect(row).toBe("Yes,No")
  })

  it("writes tags as a readable list", () => {
    const [, row] = csv([{ tags: ["urgent", "new"] }], [{ key: "tags", type: "tags" }])
    expect(row).toBe('"urgent, new"')
  })
})

describe("what the caller says goes", () => {
  it("prefers the column's own export value", () => {
    const [, row] = csv([{ amount: 4790.5 }], [
      { key: "amount", type: "currency", exportValue: ({ value }) => `AUD ${String(value)}` },
    ])
    expect(row).toBe("AUD 4790.5")
  })

  it("then the column's own formatter", () => {
    const [, row] = csv([{ amount: 4790.5 }], [
      { key: "amount", type: "currency", format: ({ value }) => `about ${Math.round(Number(value))}` },
    ])
    expect(row).toBe("about 4791")
  })

  it("and a custom type can say how it belongs in a file", () => {
    const registry = createTypeRegistry({
      duration: {
        name: "duration",
        format: (value) => `${String(value)} minutes`,
        exportValue: (value) => String(Number(value) * 60),
      },
    })

    const rows = [{ length: 90 }]
    const visible = resolveColumns<AnyRow, unknown>({
      columns: [{ key: "length", type: "duration" }],
      rows,
      state: createState(),
      types: registry,
    }).visible

    const [, row] = toCsv(rows, { columns: visible, types: registry, format, bom: false }).split("\r\n")
    expect(row).toBe("5400")
  })

  it("leaves a column out when it is not exportable", () => {
    const [header] = csv([{ name: "Ada", actions: "x" }], [
      { key: "name" },
      { key: "actions", header: "", exportable: false },
    ])
    expect(header).toBe("Name")
  })
})

describe("the shape of the file", () => {
  it("separates with tabs when asked, for pasting into a spreadsheet", () => {
    const rows = [{ a: "one", b: "two" }]
    const visible = resolveColumns<AnyRow, unknown>({ rows, state: createState(), types }).visible

    // CRLF throughout, which is what the CSV specification asks for and what
    // Excel handles without complaint on every platform.
    expect(toDelimitedText(rows, { columns: visible, types, format, delimiter: "\t" })).toBe("A\tB\r\none\ttwo")
  })

  it("starts with a byte order mark, which is what makes Excel read it as UTF-8", () => {
    const rows = [{ name: "José" }]
    const visible = resolveColumns<AnyRow, unknown>({ rows, state: createState(), types }).visible

    expect(toCsv(rows, { columns: visible, types, format }).startsWith("﻿")).toBe(true)
    expect(toCsv(rows, { columns: visible, types, format, bom: false }).startsWith("﻿")).toBe(false)
  })
})
