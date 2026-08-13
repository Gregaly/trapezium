import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { afterEach, describe, expect, it } from "vitest"

import { Table } from "./table.js"

/**
 * Accessibility is a promise the library makes, so it is a test rather than a
 * paragraph. An automated pass catches a fraction of what matters — the
 * keyboard paths below cover the part it cannot.
 */

afterEach(cleanup)

const people = [
  { id: "1", name: "Ada", email: "ada@example.com", amount: 1200, active: true },
  { id: "2", name: "Tom", email: "tom@example.com", amount: 940, active: false },
]

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // Contrast cannot be computed in jsdom, which has no layout and no real
      // stylesheet — it is checked against the built CSS instead.
      "color-contrast": { enabled: false },
      // A page-structure rule, not a component one: whether the table sits
      // inside a landmark is the application's business.
      region: { enabled: false },
    },
  })
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`)
}

describe("automated checks", () => {
  it("passes on a table with everything switched on", async () => {
    const { container } = render(
      <Table
        data={people}
        aria-label="People"
        search
        selection
        export
        densityControl
        pagination={{ pageSize: 1 }}
      />,
    )

    expect(await violations(container)).toEqual([])
  })

  it("passes on the empty, loading and error states", async () => {
    const { container, rerender } = render(<Table data={[]} columns={["name"]} aria-label="People" />)
    expect(await violations(container)).toEqual([])

    rerender(<Table data={[]} columns={["name"]} aria-label="People" loading />)
    expect(await violations(container)).toEqual([])

    rerender(<Table data={[]} columns={["name"]} aria-label="People" error="Could not load" />)
    expect(await violations(container)).toEqual([])
  })

  it("passes with an open column menu", async () => {
    const user = userEvent.setup()
    render(<Table data={people} columns={["name"]} aria-label="People" />)

    await user.click(screen.getByRole("button", { name: /column options/i }))

    // The menu is portalled to the body, so the whole document is checked.
    expect(await violations(document.body)).toEqual([])
  })
})

describe("keyboard", () => {
  it("sorts from the keyboard", async () => {
    const user = userEvent.setup()
    render(<Table data={people} columns={["name"]} aria-label="People" />)

    const header = screen.getByRole("columnheader", { name: /^Name/ })
    await user.tab()
    await user.tab()
    await user.keyboard("{Enter}")

    expect(header.getAttribute("aria-sort")).toBe("ascending")
  })

  it("opens a menu, moves through it, and gives focus back on escape", async () => {
    const user = userEvent.setup()
    render(<Table data={people} columns={["name"]} aria-label="People" />)

    const trigger = screen.getByRole("button", { name: /column options/i })
    trigger.focus()
    await user.keyboard("{ArrowDown}")

    expect(screen.getByRole("group", { name: /column/i })).toBeDefined()

    await user.keyboard("{ArrowDown}")
    expect(document.activeElement?.textContent).toContain("Sort ascending")

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("group", { name: /column/i })).toBeNull()
    // Focus must come back, or the user is stranded at the top of the document.
    expect(document.activeElement).toBe(trigger)
  })

  it("names every icon-only control", () => {
    render(<Table data={people} aria-label="People" export pagination={{ pageSize: 1 }} />)

    for (const button of screen.getAllByRole("button")) {
      const name = button.getAttribute("aria-label") ?? button.textContent?.trim()
      expect(name, button.outerHTML.slice(0, 120)).toBeTruthy()
    }
  })
})
