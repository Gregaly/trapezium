import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useState } from "react"

import { Table } from "./table.js"

afterEach(cleanup)

type Item = { id: string; name: string; amount: number }

const items: Item[] = [
  { id: "a", name: "Anvil", amount: 30 },
  { id: "b", name: "Bucket", amount: 10 },
]

describe("renderHeader", () => {
  it("draws the header's text, and the sort, the menu and the resize handle stay and work", async () => {
    const user = userEvent.setup()
    render(
      <Table
        data={items}
        columns={[
          "name",
          {
            key: "amount",
            renderHeader: ({ column, sort }) => (
              <span className="custom">
                {column.header} <em>AUD</em>
                {sort ? ` (${sort.direction})` : ""}
              </span>
            ),
          },
        ]}
      />,
    )

    expect(document.querySelector("th .custom em")?.textContent).toBe("AUD")
    // Still named for the column, whatever the renderer drew.
    const sort = screen.getByRole("button", { name: "Amount" })
    await user.click(sort)
    expect(document.querySelector('th[data-key="amount"]')?.getAttribute("aria-sort")).toBe("ascending")
    expect(document.querySelector("th .custom")?.textContent).toContain("(asc)")
    expect(screen.getByRole("button", { name: "Amount column options" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Resize Amount" })).toBeDefined()
  })

  it("is rendered on a server", () => {
    const html = renderToString(
      <Table data={items} columns={[{ key: "amount", renderHeader: () => <b className="custom">Amount (AUD)</b> }]} />,
    )
    expect(html).toContain('<b class="custom">Amount (AUD)</b>')
  })
})

describe("description", () => {
  it("is linked to the header for a screen reader, on the server and after hydration", () => {
    const element = (
      <Table data={items} id="items" columns={[{ key: "amount", description: "Excludes tax" }, "name"]} />
    )
    const html = renderToString(element)
    expect(html).toContain('id="items-desc-amount"')
    expect(html).toContain("Excludes tax")

    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const problems: unknown[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => problems.push(args))
    act(() => {
      hydrateRoot(container, element)
    })
    spy.mockRestore()
    expect(problems).toEqual([])

    const button = container.querySelector<HTMLElement>('th[data-key="amount"] .tpz-th-button')
    const describedBy = button?.getAttribute("aria-describedby") ?? ""
    expect(document.getElementById(describedBy)?.textContent).toBe("Excludes tax")
    container.remove()
  })

  it("shows as a tooltip when the header has the keyboard, and goes on Escape", async () => {
    const user = userEvent.setup()
    render(<Table data={items} columns={[{ key: "amount", description: "Excludes tax" }]} />)
    const button = screen.getByRole("button", { name: "Amount" })

    act(() => button.focus())
    await vi.waitFor(() => expect(document.querySelector(".tpz-tooltip")?.textContent).toBe("Excludes tax"))
    expect(document.querySelector(".tpz-tooltip")?.getAttribute("aria-hidden")).toBe("true")

    await user.keyboard("{Escape}")
    expect(document.querySelector(".tpz-tooltip")).toBeNull()
  })

  it("passes the automated accessibility checks", async () => {
    const { container } = render(<Table data={items} columns={[{ key: "amount", description: "Excludes tax" }, "name"]} />)
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

describe("renderHeaderControls", () => {
  const header = (key: string) => document.querySelector<HTMLTableCellElement>(`th[data-key="${key}"]`)

  it("draws controls beside the text, outside the sort control and before the menu", () => {
    render(
      <Table
        data={items}
        columns={[
          { key: "name", renderHeaderControls: () => <button type="button">Pick</button> },
          "amount",
        ]}
      />,
    )
    const cell = header("name")
    const controls = cell?.querySelector(".tpz-th-controls")
    expect(controls?.contains(screen.getByRole("button", { name: "Pick" }))).toBe(true)
    expect(cell?.querySelector(".tpz-th-button")?.contains(controls ?? null)).toBe(false)
    // In the header's row, after the sort control and before the menu.
    const order = [...(cell?.querySelector(".tpz-th-inner")?.children ?? [])].map((child) => child.className)
    expect(order.indexOf("tpz-th-controls")).toBeGreaterThan(order.indexOf("tpz-th-button"))
    expect(order.indexOf("tpz-th-controls")).toBeLessThan(order.indexOf("tpz-th-menu"))
    expect(cell?.dataset["controls"]).toBe("true")
    expect(header("amount")?.dataset["controls"]).toBeUndefined()
  })

  it("never sorts the column from a click in them", async () => {
    const user = userEvent.setup()
    render(
      <Table data={items} columns={[{ key: "name", renderHeaderControls: () => <button type="button">Pick</button> }]} />,
    )
    await user.click(screen.getByRole("button", { name: "Pick" }))
    expect(header("name")?.getAttribute("aria-sort")).toBe("none")
  })

  it("keeps an input's focus and text while what it types changes the table", async () => {
    const user = userEvent.setup()
    function Searchable() {
      const [search, setSearch] = useState("")
      return (
        <Table
          data={items}
          state={{ search }}
          onStateChange={(next) => setSearch(next.search)}
          columns={[
            {
              key: "name",
              renderHeaderControls: () => (
                <input aria-label="Search names" value={search} onChange={(event) => setSearch(event.target.value)} />
              ),
            },
          ]}
        />
      )
    }
    render(<Searchable />)
    const input = screen.getByRole("textbox", { name: "Search names" })
    await user.type(input, "buc")

    expect(document.activeElement).toBe(input)
    expect((input as HTMLInputElement).value).toBe("buc")
    expect(document.querySelectorAll(".tpz-tbody .tpz-tr")).toHaveLength(1)
  })

  it("stops the header being a handle while a control is pressed, so text can be selected", () => {
    render(
      <Table data={items} columns={[{ key: "name", renderHeaderControls: () => <input aria-label="Search names" /> }]} />,
    )
    expect(header("name")?.draggable).toBe(true)
    // jsdom has no PointerEvent; the type is what the handlers listen for.
    fireEvent.pointerDown(screen.getByRole("textbox", { name: "Search names" }))
    expect(header("name")?.draggable).toBe(false)
    act(() => {
      window.dispatchEvent(new Event("pointerup"))
    })
    expect(header("name")?.draggable).toBe(true)
  })

  it("draws no slot when there is nothing to draw", () => {
    render(<Table data={items} columns={[{ key: "name", renderHeaderControls: () => null }]} />)
    expect(header("name")?.querySelector(".tpz-th-controls")).toBeNull()
    expect(header("name")?.dataset["controls"]).toBeUndefined()
  })

  it("is rendered on a server, and hydrates", () => {
    const element = (
      <Table data={items} columns={[{ key: "name", renderHeaderControls: () => <button type="button">Pick</button> }]} />
    )
    const html = renderToString(element)
    expect(html).toContain('<button type="button">Pick</button>')
    expect(html).toContain('data-controls="true"')

    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const problems: unknown[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => problems.push(args))
    act(() => {
      hydrateRoot(container, element)
    })
    spy.mockRestore()
    expect(problems).toEqual([])
    container.remove()
  })

  it("passes the automated accessibility checks", async () => {
    const { container } = render(
      <Table
        data={items}
        columns={[{ key: "name", renderHeaderControls: () => <input aria-label="Search names" /> }, "amount"]}
      />,
    )
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
