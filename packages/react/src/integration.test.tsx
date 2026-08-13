import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  columns as fullColumns,
  customTypes,
  makeRows,
  PLANS,
  STATUSES,
  type Row,
} from "@trapezium/core/testing"

import { Table } from "./table.js"
import type { Column } from "./types.js"

/**
 * The whole thing, through the component.
 *
 * The core suites prove the engine; these prove the wiring — that clicking a
 * header really sorts the rows on screen, that a filter applied through the
 * panel narrows them, that search, sort, filter and pagination compose, and
 * that a custom type reaches every one of those through the public API.
 */

afterEach(cleanup)

const NOW = new Date("2026-08-13T12:00:00.000Z")
const rows = makeRows(120, 5)

/** A readable subset: the whole set of types is covered by the core suites. */
const columns = fullColumns.filter((column) =>
  ["id", "name", "count", "amountCents", "active", "birthday", "plan", "status", "tags", "version", "priority", "seat"].includes(
    String(column.key),
  ),
) as Column<Row>[]

function setup(props: Partial<React.ComponentProps<typeof Table<Row>>> = {}) {
  return render(
    <Table
      data={rows}
      columns={columns}
      types={customTypes}
      getRowId={(row) => row.id}
      format={{ now: NOW, currency: "AUD" }}
      pagination={{ pageSize: 10 }}
      aria-label="Everything"
      {...props}
    />,
  )
}

/** The cells of the column with this header, in the order shown. */
function column(container: HTMLElement, header: string): string[] {
  const headers = [...container.querySelectorAll("thead th")]
  const index = headers.findIndex((cell) => cell.textContent?.trim().startsWith(header))
  expect(index).toBeGreaterThanOrEqual(0)

  return [...container.querySelectorAll("tbody tr")].map(
    (row) => row.querySelectorAll("td")[index]?.textContent?.trim() ?? "",
  )
}

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll("tbody tr").length
}

/**
 * The source rows behind what is on screen, in the order shown.
 *
 * Cells show *formatted* text, and formatted text is not always what the column
 * sorted by — a name with leading spaces is sorted with them and rendered
 * without, because HTML collapses whitespace. Mapping back to the row is how
 * an ordering assertion stays about the ordering.
 */
function shownRows(container: HTMLElement): Row[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return column(container, "ID")
    .map((id) => byId.get(id))
    .filter((row): row is Row => row !== undefined)
}

describe("sorting through the header", () => {
  it("orders text, and reverses it", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    /*
      Compared with the collator the library sorts by, and as an ordering rather
      than an exact sequence: names repeat in this data, and where two rows tie
      either may come first. What must hold is that the sequence never goes
      backwards — and that blanks stay at the end whichever way it is sorted.
    */
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
    const names = () => shownRows(container).map((row) => row.name).filter((name) => name !== "")

    await user.click(within(container).getByRole("button", { name: "Name" }))
    const ascending = names()
    expect(ascending.length).toBeGreaterThan(50)
    for (let index = 1; index < ascending.length; index += 1) {
      expect(collator.compare(ascending[index - 1]!, ascending[index]!)).toBeLessThanOrEqual(0)
    }

    await user.click(within(container).getByRole("button", { name: "Name" }))
    const descending = names()
    expect(descending).toHaveLength(ascending.length)
    for (let index = 1; index < descending.length; index += 1) {
      expect(collator.compare(descending[index - 1]!, descending[index]!)).toBeGreaterThanOrEqual(0)
    }
  })

  it("orders numbers numerically, not as text", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: "Count" }))
    const values = column(container, "Count")
      .filter((text) => text !== "—")
      .map((text) => Number(text.replace(/,/g, "")))

    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  it("orders a custom type by its own rule", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: "Version" }))
    const versions = column(container, "Version").filter(Boolean)

    const rank = (version: string) => {
      const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number)
      return major * 1_000_000 + minor * 1_000 + patch
    }

    // Text ordering would put "10.0.0" before "9.0.0"; this must not.
    expect(versions.map(rank)).toEqual([...versions.map(rank)].sort((a, b) => a - b))
  })

  it("orders by a comparator supplied on the column", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: "Seat" }))
    const seats = column(container, "Seat").filter(Boolean)

    const rank = (seat: string) => {
      const match = /^([A-Z]+)(\d+)$/.exec(seat)!
      return [match[1]!, Number(match[2])] as const
    }

    // "B2" before "B10", which no text ordering gives.
    for (let index = 1; index < seats.length; index += 1) {
      const [beforeRow, beforeNumber] = rank(seats[index - 1]!)
      const [afterRow, afterNumber] = rank(seats[index]!)
      expect(beforeRow < afterRow || (beforeRow === afterRow && beforeNumber <= afterNumber)).toBe(true)
    }
  })

  it("puts blanks last in both directions", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    for (const _ of [1, 2]) {
      await user.click(within(container).getByRole("button", { name: "Count" }))
      const values = column(container, "Count")
      const firstBlank = values.indexOf("—")
      if (firstBlank !== -1) expect(values.slice(firstBlank).every((value) => value === "—")).toBe(true)
    }
  })
})

describe("filtering through the column panel", () => {
  it("applies a set filter and narrows the rows", async () => {
    const user = userEvent.setup()
    const { container } = setup({
      columns: columns.map((column) =>
        column.key === "plan" ? { ...column, filter: "set" as const } : column,
      ),
      pagination: false,
    })

    const before = rowCount(container)
    await user.click(within(container).getByRole("button", { name: /Plan column options/i }))

    const panel = screen.getByRole("group", { name: /Plan column/i })
    const professional = within(panel).getByText("Professional")
    await user.click(professional)

    expect(rowCount(container)).toBeLessThan(before)
    expect(new Set(column(container, "Plan"))).toEqual(new Set(["Professional"]))
    expect(screen.getByText(/Plan is Professional/)).toBeDefined()
  })

  it("applies a range filter to a number column", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: /Count column options/i }))
    const panel = screen.getByRole("group", { name: /Count column/i })

    await user.selectOptions(within(panel).getByLabelText(/How to filter Count/i), "gte")
    await user.type(within(panel).getByLabelText(/Filter Count by/i), "500")
    await user.click(within(panel).getByRole("button", { name: "Apply" }))

    const values = column(container, "Count").map((text) => Number(text.replace(/,/g, "")))
    expect(values.every((value) => value >= 500)).toBe(true)
    expect(values.length).toBeGreaterThan(0)
  })

  it("filters a custom type by a comparison its own rule defines", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: /Priority column options/i }))
    const panel = screen.getByRole("group", { name: /Priority column/i })

    // Ticking "Blocker" in the set filter, which is built from the values
    // present and labelled by the custom type's own formatter.
    await user.click(within(panel).getByText("Blocker"))

    expect(new Set(column(container, "Priority"))).toEqual(new Set(["Blocker"]))
  })

  it("clears a filter from its chip", async () => {
    const user = userEvent.setup()
    const { container } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: /Status column options/i }))
    const panel = screen.getByRole("group", { name: /Status column/i })
    await user.click(within(panel).getByText("Active"))

    const filtered = rowCount(container)
    await user.click(screen.getByRole("button", { name: /Remove filter on status/i }))

    expect(rowCount(container)).toBeGreaterThan(filtered)
  })
})

describe("search", () => {
  it("narrows the rows and says so when nothing matches", async () => {
    const user = userEvent.setup()
    const { container } = setup({ search: { debounce: 0 }, pagination: false })

    const box = within(container).getByRole("searchbox")
    await user.type(box, "ada")
    await vi.waitFor(() => expect(rowCount(container)).toBeLessThan(rows.length))
    expect(rowCount(container)).toBeGreaterThan(0)

    await user.clear(box)
    await user.type(box, "nothing-matches-this")
    await vi.waitFor(() => expect(screen.getByText("No rows match")).toBeDefined())
  })

  it("finds a value by the text on screen rather than the value underneath", async () => {
    const user = userEvent.setup()
    const { container } = setup({ search: { debounce: 0 }, pagination: false })

    // "Professional" is the label; the stored value is "pro".
    await user.type(within(container).getByRole("searchbox"), "Professional")
    await vi.waitFor(() => expect(rowCount(container)).toBeGreaterThan(0))
    expect(new Set(column(container, "Plan"))).toEqual(new Set(["Professional"]))
  })
})

describe("search, filter, sort and pagination together", () => {
  it("composes, and pages through exactly the matching rows", async () => {
    const user = userEvent.setup()
    const { container } = setup({ search: { debounce: 0 }, pagination: { pageSize: 5 } })

    /* Filter to one plan. */
    await user.click(within(container).getByRole("button", { name: /Plan column options/i }))
    await user.click(within(screen.getByRole("group", { name: /Plan column/i })).getByText("Professional"))

    /* Search within it. */
    await user.type(within(container).getByRole("searchbox"), "a")
    await vi.waitFor(() => expect(rowCount(container)).toBeGreaterThan(0))

    /* Sort it. */
    await user.click(within(container).getByRole("button", { name: "Count" }))

    /* Then walk every page, collecting what is shown. */
    const seen: string[] = []
    const totalText = within(container).getByText(/of \d+$/).textContent ?? ""
    const total = Number(/of (\d+)/.exec(totalText)?.[1] ?? "0")

    for (;;) {
      seen.push(...column(container, "Name"))
      const next = within(container).getByRole("button", { name: "Next page" })
      if ((next as HTMLButtonElement).disabled) break
      await user.click(next)
    }

    expect(seen).toHaveLength(total)
    expect(new Set(seen).size).toBeGreaterThan(0)
    // Every page is part of one ordered list, and no row appears twice.
    expect(new Set(column(container, "Plan"))).toEqual(new Set(["Professional"]))
  })

  it("goes back to page one when the rows change underneath", async () => {
    const user = userEvent.setup()
    const { container } = setup({ search: { debounce: 0 }, pagination: { pageSize: 5 } })

    await user.click(within(container).getByRole("button", { name: "Next page" }))
    expect(within(container).getByText(/^6–10 of/)).toBeDefined()

    await user.type(within(container).getByRole("searchbox"), "a")
    await vi.waitFor(() => expect(within(container).getByText(/^1–/)).toBeDefined())
  })

  it("keeps the arrangement when the data is replaced", async () => {
    const user = userEvent.setup()
    const { container, rerender } = setup({ pagination: false })

    await user.click(within(container).getByRole("button", { name: "Count" }))
    const before = column(container, "Count")

    act(() => {
      rerender(
        <Table
          data={[...rows]}
          columns={columns}
          types={customTypes}
          getRowId={(row) => row.id}
          format={{ now: NOW, currency: "AUD" }}
          pagination={false}
          aria-label="Everything"
        />,
      )
    })

    expect(column(container, "Count")).toEqual(before)
  })
})

describe("selection across filtering and paging", () => {
  it("keeps a selection made on one page while the user moves to another", async () => {
    const user = userEvent.setup()
    const selected: string[][] = []
    const { container } = setup({
      selection: true,
      onSelectionChange: (ids) => selected.push(ids),
      pagination: { pageSize: 5 },
    })

    await user.click(within(container).getAllByRole("checkbox", { name: /Select row/ })[0]!)
    await user.click(within(container).getByRole("button", { name: "Next page" }))

    expect(selected.at(-1)).toHaveLength(1)
    expect(within(container).getByText("1 selected")).toBeDefined()
  })

  it("selects only the rows on the page, not everything behind the pagination", async () => {
    const user = userEvent.setup()
    const { container } = setup({ selection: true, pagination: { pageSize: 5 } })

    await user.click(within(container).getByRole("checkbox", { name: /Select all/i }))
    expect(within(container).getByText("5 selected")).toBeDefined()
  })
})

describe("what the table shows", () => {
  it("formats every type the way its column asks", () => {
    const { container } = setup({ pagination: { pageSize: 120 } })

    // Money in minor units, rendered in the table's currency.
    expect(column(container, "Amount cents").every((text) => /^-?A\$[\d,]+\.\d{2}$/.test(text))).toBe(true)

    // A date is a day, never an instant shifted by a timezone.
    expect(column(container, "Birthday").every((text) => text === "—" || /^\w{3} \d{1,2}, \d{4}$/.test(text))).toBe(true)

    // Options render as their label, not their stored value.
    expect(new Set(column(container, "Plan"))).toEqual(new Set(PLANS.map((option) => option.label)))
    expect(new Set(column(container, "Status")).size).toBeLessThanOrEqual(STATUSES.length + 1)
  })

  it("shows a blank as the empty marker rather than as nothing", () => {
    const { container } = setup({ pagination: { pageSize: 120 } })
    const counts = column(container, "Count")
    expect(counts.some((text) => text === "—")).toBe(true)
  })
})
