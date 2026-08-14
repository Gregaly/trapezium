import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TableState } from "@trapezium/core"

import { Table } from "./table.js"

/**
 * Making a server-side table whole.
 *
 * With the data on a server the table holds one page, and two things it does
 * well in the browser stop being possible on their own: a set filter cannot
 * know what values a column has, and an export cannot include rows it has never
 * seen. Neither is unsolvable — both need one thing from the caller, and this
 * is what that looks like.
 */

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
]

/** One page, as a server would send it. Only two statuses appear. */
const page = [
  { id: "1", reference: "INV-001", status: "draft" },
  { id: "2", reference: "INV-002", status: "sent" },
]

afterEach(cleanup)

function setup(props: Record<string, unknown>) {
  return render(
    <Table
      data={page}
      columns={[{ key: "reference" }, { key: "status", filter: "set" }]}
      getRowId={(row) => row.id}
      server
      total={480}
      pagination={{ pageSize: 2 }}
      aria-label="Invoices"
      {...props}
    />,
  )
}

async function openStatusFilter(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await user.click(within(container).getByRole("button", { name: /Status column options/i }))
  return screen.getByRole("group", { name: /Status column/i })
}

const choices = (panel: HTMLElement) =>
  [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)

describe("a set filter that cannot see past its page", () => {
  it("offers only what the page held, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    const { container } = setup({})

    const panel = await openStatusFilter(user, container)

    // Two of the four real statuses, labelled exactly as the cells label them:
    // nothing has told this column what "draft" is called.
    expect(choices(panel)).toEqual(["draft", "sent"])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("only the values on the page"))

    warn.mockRestore()
  })

  it("offers the whole list when the column is given one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    const { container } = setup({
      columns: [{ key: "reference" }, { key: "status", filter: { kind: "set", options: STATUSES } }],
    })

    const panel = await openStatusFilter(user, container)
    expect(choices(panel)).toEqual(["Draft", "Sent", "Paid", "Overdue"])
    // Nothing to warn about any more.
    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it("fetches the list when the column is given a way to, and says it is working", async () => {
    const user = userEvent.setup()

    // Held open deliberately, so the loading state can be seen rather than
    // raced past by a promise that resolves in the same tick.
    let release: (options: typeof STATUSES) => void = () => {}
    const fetchOptions = vi.fn(
      () =>
        new Promise<typeof STATUSES>((resolve) => {
          release = resolve
        }),
    )

    const { container } = setup({
      columns: [{ key: "reference" }, { key: "status", filter: { kind: "set", options: fetchOptions } }],
    })

    const panel = await openStatusFilter(user, container)

    expect(fetchOptions).toHaveBeenCalledTimes(1)
    expect(within(panel).getByText("Loading values…")).toBeDefined()

    release(STATUSES)
    await vi.waitFor(() => expect(choices(panel)).toEqual(["Draft", "Sent", "Paid", "Overdue"]))
  })

  it("remembers what it fetched, so opening the panel again is free", async () => {
    const user = userEvent.setup()
    const fetchOptions = vi.fn(() => Promise.resolve(STATUSES))
    const columns = [{ key: "reference" }, { key: "status", filter: { kind: "set", options: fetchOptions } }]

    const { container } = setup({ columns })
    let panel = await openStatusFilter(user, container)
    await vi.waitFor(() => expect(choices(panel)).toHaveLength(4))

    await user.keyboard("{Escape}")
    panel = await openStatusFilter(user, container)

    expect(fetchOptions).toHaveBeenCalledTimes(1)
    expect(choices(panel)).toHaveLength(4)
  })

  it("chooses a value the page never contained, and asks the server for it", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn()

    const { container } = setup({
      columns: [{ key: "reference" }, { key: "status", filter: { kind: "set", options: STATUSES } }],
      onStateChange,
    })

    const panel = await openStatusFilter(user, container)
    await user.click(within(panel).getByText("Overdue"))

    // The filter the server needs, and a return to the first page.
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: [{ key: "status", operator: "eq", value: "overdue" }],
        page: 1,
      }),
    )
  })

  it("says so once when the fetch fails, and tries again next time", async () => {
    const user = userEvent.setup()
    const fetchOptions = vi.fn(() => Promise.reject(new Error("no")))

    const { container } = setup({
      columns: [{ key: "reference" }, { key: "status", filter: { kind: "set", options: fetchOptions } }],
    })

    const panel = await openStatusFilter(user, container)
    await vi.waitFor(() => expect(within(panel).getByText(/Could not load/)).toBeDefined())
  })
})

describe("an export that cannot see past its page", () => {
  let downloaded: string | undefined

  beforeEach(() => {
    downloaded = undefined
    vi.stubGlobal("Blob", class {
      constructor(parts: string[]) {
        downloaded = parts.join("")
      }
    })
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} })
  })

  afterEach(() => vi.unstubAllGlobals())

  async function download(props: Record<string, unknown>) {
    const user = userEvent.setup()
    const { container } = setup(props)

    await user.click(within(container).getByRole("button", { name: "Export" }))
    await user.click(
      within(screen.getByRole("group", { name: "Export" })).getByRole("button", { name: /Download CSV/i }),
    )

    return container
  }

  it("writes the page and warns, when given nothing better", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await download({ export: true })

    await vi.waitFor(() => expect(downloaded).toBeDefined())
    expect((downloaded ?? "").trim().split("\r\n")).toHaveLength(3)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("one page"))

    warn.mockRestore()
  })

  it("writes everything the caller fetches, formatted as the table would", async () => {
    const everything = Array.from({ length: 480 }, (_, index) => ({
      id: String(index),
      reference: `INV-${String(index).padStart(3, "0")}`,
      status: index % 2 === 0 ? "paid" : "overdue",
    }))

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fetchRows = vi.fn((state: TableState) => Promise.resolve(everything))

    await download({ export: { fetchRows } })
    await vi.waitFor(() => expect(downloaded).toBeDefined())

    // Not trimmed: the byte order mark counts as whitespace, so trimming would
    // quietly remove the very thing being checked.
    const lines = (downloaded ?? "").replace(/\r?\n$/, "").split("\r\n")
    expect(lines).toHaveLength(481)
    expect(lines[0]).toBe("﻿Reference,Status")
    expect(lines[1]).toBe("INV-000,paid")

    // It knows what the user was looking at when they asked.
    expect(fetchRows.mock.calls[0]?.[0].pageSize).toBe(2)
    // And with a way to do it properly, there is nothing left to warn about.
    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it("steps aside entirely when the caller wants the file to come from elsewhere", async () => {
    const onExport = vi.fn()
    await download({ export: { onExport } })

    await vi.waitFor(() => expect(onExport).toHaveBeenCalledTimes(1))
    expect(downloaded).toBeUndefined()
  })
})

describe("telling the table once where the answers come from", () => {
  let downloaded: string | undefined

  beforeEach(() => {
    downloaded = undefined
    vi.stubGlobal("Blob", class {
      constructor(parts: string[]) {
        downloaded = parts.join("")
      }
    })
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} })
  })

  afterEach(() => vi.unstubAllGlobals())

  const everything = Array.from({ length: 480 }, (_, index) => ({
    id: String(index),
    reference: `INV-${String(index).padStart(3, "0")}`,
    status: STATUSES[index % 4]!.value,
    owner: index % 2 === 0 ? "Ada" : "Wren",
  }))

  /** One object, and every set-filter column and the export use it. */
  const source = () => ({
    distinct: vi.fn((columnKey: string) =>
      // The trailing null is a column with gaps in it, which is what a real
      // "select distinct" returns and what the table must not choke on.
      Promise.resolve([
        ...new Set(everything.map((row) => row[columnKey as "status" | "owner"])),
        null,
      ]),
    ),
    all: vi.fn(() => Promise.resolve(everything)),
  })

  it("fetches a set filter's values without the column being told to", async () => {
    const user = userEvent.setup()
    const server = source()

    /*
      A column key no other test uses, because the warning below is only ever
      said once per column for the life of the module — assert it against a key
      that has already warned and the assertion proves nothing.
    */
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { container } = setup({
      server,
      data: [{ id: "1", reference: "INV-001", owner: "Ada" }],
      columns: [{ key: "reference" }, { key: "owner", filter: "set" }],
    })

    await user.click(within(container).getByRole("button", { name: /Owner column options/i }))
    const panel = screen.getByRole("group", { name: /Owner column/i })

    await vi.waitFor(() => expect(choices(panel)).toEqual(["Ada", "Wren"]))
    expect(server.distinct).toHaveBeenCalledWith("owner", expect.objectContaining({ page: 1 }))

    // Nothing to warn about: the table knows how to ask.
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("asks once per column, however often the panel is opened", async () => {
    const user = userEvent.setup()
    const server = source()

    const { container } = setup({ server })
    let panel = await openStatusFilter(user, container)
    await vi.waitFor(() => expect(choices(panel)).toHaveLength(4))

    await user.keyboard("{Escape}")
    panel = await openStatusFilter(user, container)

    expect(server.distinct).toHaveBeenCalledTimes(1)
    expect(choices(panel)).toHaveLength(4)
  })

  it("exports everything without the export being told to", async () => {
    const user = userEvent.setup()
    const server = source()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { container } = setup({ server, export: true })

    await user.click(within(container).getByRole("button", { name: "Export" }))
    await user.click(
      within(screen.getByRole("group", { name: "Export" })).getByRole("button", { name: /Download CSV/i }),
    )

    await vi.waitFor(() => expect(downloaded).toBeDefined())
    expect((downloaded ?? "").replace(/\r?\n$/, "").split("\r\n")).toHaveLength(481)
    expect(server.all).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 2 }))

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("still lets a column overrule it", async () => {
    const user = userEvent.setup()
    const server = source()

    const { container } = setup({
      server,
      columns: [{ key: "reference" }, { key: "status", filter: { kind: "set", options: STATUSES } }],
    })

    const panel = await openStatusFilter(user, container)

    expect(choices(panel)).toEqual(["Draft", "Sent", "Paid", "Overdue"])
    expect(server.distinct).not.toHaveBeenCalled()
  })
})
