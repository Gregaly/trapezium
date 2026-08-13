import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Table } from "./table.js"

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
