import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  EXPORT_COLUMNS,
  EXPORT_PAGE_SIZE,
  EXPORT_ROWS,
  exportScenarios,
  type ExportRow,
  type ExportScenario,
} from "@trapezium/core/testing"

import { Table } from "./table.js"
import type { Column } from "./types.js"

/**
 * What ends up in the file.
 *
 * The failure this guards: an export that hands back the page on screen rather
 * than everything the filters left. Nobody notices until the spreadsheet is
 * wrong, and by then it has been sent to somebody.
 */

const rows = Array.from({ length: 120 }, (_, index) => ({
  id: String(index),
  name: `Person ${String(index).padStart(3, "0")}`,
  plan: index % 3 === 0 ? "pro" : "free",
  amount: index * 10,
}))

/** Catches the file the table hands to the browser. */
let downloaded: string | undefined
let copied: string | undefined

beforeEach(() => {
  downloaded = undefined
  copied = undefined

  // `downloadText` builds a blob and clicks a link; jsdom has neither, so the
  // text is caught on its way past.
  vi.stubGlobal("Blob", class {
    text: string
    constructor(parts: string[]) {
      this.text = parts.join("")
      downloaded = this.text
    }
  })
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:test", revokeObjectURL: () => {} })

})

/**
 * Catches what is put on the clipboard.
 *
 * Installed *after* `userEvent.setup()`, which fits its own clipboard stub to
 * support copy and paste — set one up before it and it is quietly replaced.
 */
function catchClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        copied = text
        return Promise.resolve()
      },
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

async function exportFrom(props: Record<string, unknown> = {}, action = /Download CSV/i) {
  const user = userEvent.setup()
  catchClipboard()
  const { container } = render(
    <Table
      data={rows}
      columns={["name", "plan", "amount"]}
      getRowId={(row) => row.id}
      pagination={{ pageSize: 10 }}
      export
      aria-label="People"
      {...props}
    />,
  )

  await user.click(within(container).getByRole("button", { name: "Export" }))
  await user.click(within(screen.getByRole("group", { name: "Export" })).getByRole("button", { name: action }))
  return { container, user }
}

/** Data rows in the exported text, without the header. */
const lines = (text: string | undefined) => (text ?? "").trim().split("\r\n").slice(1)

describe("what an export contains", () => {
  it("every matching row, not the page on screen", async () => {
    await exportFrom()

    // Ten rows are visible; a hundred and twenty must be in the file.
    expect(lines(downloaded)).toHaveLength(120)
    expect(downloaded).toContain("Person 000")
    expect(downloaded).toContain("Person 119")
  })

  it("only the rows a filter leaves", async () => {
    await exportFrom({ defaultState: { filters: [{ key: "plan", operator: "eq", value: "pro" }] } })

    expect(lines(downloaded)).toHaveLength(40)
    expect(downloaded).not.toContain("free")
  })

  it("only the rows a search leaves", async () => {
    await exportFrom({ defaultState: { search: "Person 01" } })

    // Person 010 through 019, and Person 100 through 119 do not match.
    expect(lines(downloaded)).toHaveLength(10)
  })

  it("in the order the table is sorted", async () => {
    await exportFrom({ defaultState: { sort: [{ key: "amount", direction: "desc" }] } })

    const first = lines(downloaded)[0] ?? ""
    expect(first).toContain("Person 119")
  })

  it("the columns that are shown, in the order they are shown", async () => {
    await exportFrom({ defaultState: { order: ["amount", "name"], hidden: ["plan"] } })

    // The file opens with a byte order mark, which is what makes Excel read
    // it as UTF-8 rather than as the local code page.
    expect((downloaded ?? "").split("\r\n")[0]).toBe("\ufeffAmount,Name")
  })

  it("just the page, when that is what was asked for", async () => {
    await exportFrom({ export: { scope: "page" } })
    expect(lines(downloaded)).toHaveLength(10)
  })
})

describe("what a selection does to an export", () => {
  const selected = (props: Record<string, unknown> = {}) =>
    exportFrom({ selection: true, defaultState: { selection: ["3", "7"] }, ...props })

  it("downloads the selection when there is one", async () => {
    await selected()

    expect(lines(downloaded)).toHaveLength(2)
    expect(downloaded).toContain("Person 003")
    expect(downloaded).toContain("Person 007")
  })

  it("hands the selection to onExport", async () => {
    const onExport = vi.fn()
    await selected({ export: { onExport } })

    expect(onExport.mock.calls[0]?.[1]).toHaveLength(2)
  })

  it("does not ask the caller for rows it already has", async () => {
    const fetchRows = vi.fn(() => rows)
    await selected({ server: true, total: 480, export: { fetchRows } })

    expect(fetchRows).not.toHaveBeenCalled()
    expect(lines(downloaded)).toHaveLength(2)
  })

  it("asks for the rest when the selection reaches past the page it can see", async () => {
    // Row 3 is on the page; row 115 is not, and only the caller can supply it.
    const fetchRows = vi.fn(() => rows)
    await selected({
      server: true,
      total: 480,
      data: rows.slice(0, 10),
      export: { fetchRows },
      defaultState: { selection: ["3", "115"] },
    })

    expect(fetchRows).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(lines(downloaded)).toHaveLength(2))
    expect(downloaded).toContain("Person 115")
  })
})

describe("copying to the clipboard", () => {
  it("copies every matching row when nothing is selected", async () => {
    await exportFrom({}, /Copy to clipboard/i)

    await vi.waitFor(() => expect(copied).toBeDefined())
    expect(lines(copied)).toHaveLength(120)
    expect(copied).toContain("\t")
  })

  it("copies the selection when there is one", async () => {
    const user = userEvent.setup()
    catchClipboard()
    const { container } = render(
      <Table
        data={rows}
        columns={["name", "plan"]}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 10 }}
        selection
        export
        defaultState={{ selection: ["3", "7"] }}
        aria-label="People"
      />,
    )

    await user.click(within(container).getByRole("button", { name: "Export" }))
    await user.click(within(screen.getByRole("group", { name: "Export" })).getByRole("button", { name: /Copy/i }))

    await vi.waitFor(() => expect(copied).toBeDefined())
    expect(lines(copied)).toHaveLength(2)
    expect(copied).toContain("Person 003")
    expect(copied).toContain("Person 007")
  })
})

/**
 * Every combination, through the real buttons.
 *
 * Three sorts, four filters — two of them searches typed into column headers —
 * the toolbar's search, two arrangements of the columns, a selection or none,
 * the page or every page, the file or the clipboard: 384 tables, each put in
 * its state, each asked to export, each compared byte for byte with a
 * reference that shares no code with the table.
 */
describe("every combination of view and export", () => {
  const scenarios = exportScenarios()

  // Kept in a handful of tests rather than 384, so a failure names a group and
  // the first few combinations in it rather than scrolling off the screen.
  const groups = new Map<string, ExportScenario[]>()
  for (const scenario of scenarios) {
    const group = `${scenario.action === "download" ? "the file" : "the clipboard"}, ${scenario.scope === "page" ? "one page" : "every page"}`
    groups.set(group, [...(groups.get(group) ?? []), scenario])
  }

  for (const [group, members] of groups) {
    it(`${group} (${String(members.length)} combinations)`, async () => {
      const disagreements: string[] = []

      for (const scenario of members) {
        downloaded = undefined
        copied = undefined
        catchClipboard()

        const { container, unmount } = render(
          <Table
            data={EXPORT_ROWS}
            columns={EXPORT_COLUMNS as Column<ExportRow>[]}
            getRowId={(row) => row.id}
            pagination={{ pageSize: EXPORT_PAGE_SIZE }}
            selection
            search
            headerSearch
            export={{ scope: scenario.scope }}
            defaultState={scenario.state}
            aria-label="People"
          />,
        )

        fireEvent.click(within(container).getByRole("button", { name: "Export" }))
        fireEvent.click(
          within(screen.getByRole("group", { name: "Export" })).getByRole("button", {
            name: scenario.action === "download" ? /Download CSV/i : /Copy to clipboard/i,
          }),
        )

        const read = () => (scenario.action === "download" ? downloaded : copied)
        await vi.waitFor(() => expect(read()).toBeDefined())

        if (read() !== scenario.expected) {
          disagreements.push(
            `${scenario.name}\n  table:     ${JSON.stringify(read())}\n  reference: ${JSON.stringify(scenario.expected)}`,
          )
        }

        unmount()
      }

      expect(disagreements.slice(0, 3)).toEqual([])
    })
  }
})

describe("an export of what was just sorted and searched by hand", () => {
  it("holds the rows a header search left, in the order a shift-click sorted them", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Table
        data={EXPORT_ROWS}
        columns={EXPORT_COLUMNS as Column<ExportRow>[]}
        getRowId={(row) => row.id}
        pagination={{ pageSize: EXPORT_PAGE_SIZE }}
        headerSearch={{ debounce: 0 }}
        export
        aria-label="People"
      />,
    )

    // Team, then salary within a team — the second with shift held.
    await user.click(within(container).getByRole("button", { name: "Team" }))
    await user.keyboard("{Shift>}")
    await user.click(within(container).getByRole("button", { name: "Salary" }))
    await user.keyboard("{/Shift}")

    // Then only the salaries that read "$1…".
    await user.click(within(container).getByRole("button", { name: "Search Salary" }))
    await user.type(within(container).getByRole("searchbox", { name: "Search Salary" }), "$1{Enter}")

    await user.click(within(container).getByRole("button", { name: "Export" }))
    await user.click(within(screen.getByRole("group", { name: "Export" })).getByRole("button", { name: /Download CSV/i }))

    expect(lines(downloaded).map((line) => line.split(",").slice(0, 3).join(","))).toEqual([
      "Ida,Eng,18000",
      "Ada,Eng,120000",
      "Zoë,Eng,120000",
      "Fay,Eng,135250",
      "Eli,Ops,101500",
      "Hal,Ops,101500",
      "Jo,Sales,112000",
    ])
  })
})

describe("exporting with server-side data", () => {
  it("says that it can only see one page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await exportFrom({ server: true, total: 480 })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("one page"))
    warn.mockRestore()
  })

  it("hands the whole job over when the caller asks to do it", async () => {
    const onExport = vi.fn()
    await exportFrom({ server: true, total: 480, export: { onExport } })

    expect(onExport).toHaveBeenCalledTimes(1)
    const [state, given] = onExport.mock.calls[0]!
    expect(state.pageSize).toBe(10)
    expect(given).toHaveLength(120)
    // Nothing was written: the caller owns the file now.
    expect(downloaded).toBeUndefined()
  })
})
