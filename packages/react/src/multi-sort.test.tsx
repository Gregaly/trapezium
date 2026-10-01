import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { applyStateToUrl, stateFromUrl, type TableState } from "@trapezium/core"

import { Table } from "./table.js"
import type { LinkComponent, TableProps } from "./types.js"

/**
 * Sorting by several columns, and getting back.
 *
 * A shift-click adds a level; the headers say which level each one is; and a
 * reset in the toolbar returns the table to the order it rests in. All three
 * have to hold when the table's controls are links, because that is how a
 * server-rendered table is sorted before its script has loaded.
 */

afterEach(cleanup)

type Person = { id: string; name: string; team: string; level: number }

const staff: Person[] = [
  { id: "1", name: "Ada", team: "Eng", level: 2 },
  { id: "2", name: "Bea", team: "Ops", level: 1 },
  { id: "3", name: "Cy", team: "Eng", level: 3 },
  { id: "4", name: "Dee", team: "Eng", level: 2 },
  { id: "5", name: "Abe", team: "Ops", level: 1 },
  { id: "6", name: "Bo", team: "Eng", level: 3 },
]

function setup(props: Partial<TableProps<Person>> = {}) {
  return render(
    <Table
      data={staff}
      columns={["name", "team", "level"]}
      getRowId={(person) => person.id}
      pagination={false}
      aria-label="Staff"
      {...props}
    />,
  )
}

const names = () =>
  [...document.querySelectorAll("tbody tr")].map((row) => row.querySelector("td")?.textContent?.trim() ?? "")

/** A header cell, found by its column: its accessible name changes with the sort. */
function header(name: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(`thead th[data-key="${name.toLowerCase()}"]`)
  if (!cell) throw new Error(`no ${name} header`)
  return cell
}

/** The header's own sort control, as distinct from its menu and its resize handle. */
function sortButton(name: string): HTMLElement {
  const button = header(name).querySelector<HTMLElement>("button.tpz-th-button")
  if (!button) throw new Error(`no sort button in the ${name} header`)
  return button
}

/** The numeral beside a header's arrow, or nothing. */
const order = (name: string) => header(name).querySelector(".tpz-th-order")?.textContent ?? null

describe("a shift-click adds a level", () => {
  it("sorts by the first column, then by the second within it", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(sortButton("Team"))
    await user.keyboard("{Shift>}")
    await user.click(sortButton("Name"))
    await user.keyboard("{/Shift}")

    expect(names()).toEqual(["Ada", "Bo", "Cy", "Dee", "Abe", "Bea"])
    expect(header("Team").getAttribute("aria-sort")).toBe("ascending")
    expect(header("Name").getAttribute("aria-sort")).toBe("ascending")
  })

  it("numbers the headers in the order they were added", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(sortButton("Team"))
    // One level: an arrow, and no number, because a lone 1 says nothing.
    expect(order("Team")).toBeNull()

    await user.keyboard("{Shift>}")
    await user.click(sortButton("Level"))
    await user.click(sortButton("Name"))
    await user.keyboard("{/Shift}")

    expect([order("Team"), order("Level"), order("Name")]).toEqual(["1", "2", "3"])
  })

  it("says the level to a screen reader, where the numeral itself is hidden from one", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { sort: [{ key: "team", direction: "asc" }] } })

    await user.keyboard("{Shift>}")
    await user.click(sortButton("Name"))
    await user.keyboard("{/Shift}")

    expect(within(header("Name")).getByRole("button", { name: /^Name\s?, sort level 2$/ })).toBeDefined()
    expect(header("Name").querySelector(".tpz-th-order")?.getAttribute("aria-hidden")).toBe("true")
  })

  it("turns a level over where it is", async () => {
    const user = userEvent.setup()
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "asc" },
        ],
      },
    })

    await user.keyboard("{Shift>}")
    await user.click(sortButton("Team"))
    await user.keyboard("{/Shift}")

    // Ops first now, and Team is still the first level rather than the last.
    expect(names()).toEqual(["Abe", "Bea", "Ada", "Bo", "Cy", "Dee"])
    expect([order("Team"), order("Name")]).toEqual(["1", "2"])
    expect(header("Team").getAttribute("aria-sort")).toBe("descending")
  })

  it("drops a level on its third click and keeps the others", async () => {
    const user = userEvent.setup()
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "desc" },
          { key: "name", direction: "desc" },
        ],
      },
    })

    await user.keyboard("{Shift>}")
    await user.click(sortButton("Team"))
    await user.keyboard("{/Shift}")

    expect(header("Team").getAttribute("aria-sort")).toBe("none")
    expect(header("Name").getAttribute("aria-sort")).toBe("descending")
    expect(names()).toEqual(["Dee", "Cy", "Bo", "Bea", "Ada", "Abe"])
  })

  it("is replaced by a plain click", async () => {
    const user = userEvent.setup()
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "asc" },
        ],
      },
    })

    await user.click(sortButton("Level"))

    expect(header("Team").getAttribute("aria-sort")).toBe("none")
    expect(header("Name").getAttribute("aria-sort")).toBe("none")
    expect(header("Level").getAttribute("aria-sort")).toBe("ascending")
    expect(order("Level")).toBeNull()
  })

  it("orders by three levels, each in its own direction", async () => {
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "level", direction: "desc" },
          { key: "name", direction: "asc" },
        ],
      },
    })

    expect(names()).toEqual(["Bo", "Cy", "Ada", "Dee", "Abe", "Bea"])
  })

  it("tells the caller the whole sort, in order", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ onStateChange })

    await user.click(sortButton("Team"))
    await user.keyboard("{Shift>}")
    await user.click(sortButton("Level"))
    await user.keyboard("{/Shift}")

    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "level", direction: "asc" },
    ])
  })
})

describe("a table that sorts by one column only", () => {
  it("treats a shift-click as a click", async () => {
    const user = userEvent.setup()
    setup({ sortable: { multiple: false } })

    await user.click(sortButton("Team"))
    await user.keyboard("{Shift>}")
    await user.click(sortButton("Name"))
    await user.keyboard("{/Shift}")

    expect(header("Team").getAttribute("aria-sort")).toBe("none")
    expect(header("Name").getAttribute("aria-sort")).toBe("ascending")
  })

  it("does not offer to add a level from the menu", async () => {
    const user = userEvent.setup()
    setup({ sortable: { multiple: false }, defaultState: { sort: [{ key: "team", direction: "asc" }] } })

    await user.click(screen.getByRole("button", { name: "Name column options" }))
    expect(screen.queryByRole("button", { name: /Then sort/ })).toBeNull()
  })

  it("still shows every level a link asked for, because the state is the caller's", () => {
    setup({
      sortable: { multiple: false },
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "desc" },
        ],
      },
    })

    expect(names()).toEqual(["Dee", "Cy", "Bo", "Ada", "Bea", "Abe"])
    expect([order("Team"), order("Name")]).toEqual(["1", "2"])
  })
})

describe("adding a level without a shift key", () => {
  it("offers nothing to follow until another column is sorted", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole("button", { name: "Name column options" }))
    expect(screen.queryByRole("button", { name: /Then sort/ })).toBeNull()
  })

  it("adds one from the column's menu, in either direction", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { sort: [{ key: "team", direction: "asc" }] } })

    await user.click(screen.getByRole("button", { name: "Name column options" }))
    await user.click(screen.getByRole("button", { name: "Then sort descending" }))

    expect(names()).toEqual(["Dee", "Cy", "Bo", "Ada", "Bea", "Abe"])
    expect([order("Team"), order("Name")]).toEqual(["1", "2"])
    // The panel closes behind the choice, like every other action in it.
    expect(screen.queryByRole("group", { name: "Name column" })).toBeNull()
  })

  it("is reachable from the keyboard alone", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { sort: [{ key: "team", direction: "asc" }] } })

    screen.getByRole("button", { name: "Name column options" }).focus()
    await user.keyboard("{ArrowDown}")
    // Sort ascending, Sort descending, then the two that add a level.
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    expect(document.activeElement?.textContent).toBe("Then sort ascending")

    await user.keyboard("{Enter}")
    expect(names()).toEqual(["Ada", "Bo", "Cy", "Dee", "Abe", "Bea"])
  })

  it("clears one column's level from its menu and leaves the rest", async () => {
    const user = userEvent.setup()
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "desc" },
        ],
      },
    })

    await user.click(screen.getByRole("button", { name: "Team column options" }))
    await user.click(screen.getByRole("button", { name: "Clear sort" }))

    expect(header("Team").getAttribute("aria-sort")).toBe("none")
    expect(header("Name").getAttribute("aria-sort")).toBe("descending")
    expect(names()).toEqual(["Dee", "Cy", "Bo", "Bea", "Ada", "Abe"])
  })

  it("replaces the whole sort from Sort ascending, as it always has", async () => {
    const user = userEvent.setup()
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "desc" },
        ],
      },
    })

    await user.click(screen.getByRole("button", { name: "Level column options" }))
    await user.click(screen.getByRole("button", { name: "Sort ascending" }))

    expect(header("Team").getAttribute("aria-sort")).toBe("none")
    expect(header("Level").getAttribute("aria-sort")).toBe("ascending")
  })
})

describe("the reset", () => {
  const reset = () => screen.queryByRole("button", { name: "Reset sort" })

  it("is not there until something is sorted", () => {
    setup()
    expect(reset()).toBeNull()
  })

  it("appears with a sort, puts the rows back as they arrived, and goes", async () => {
    const user = userEvent.setup()
    setup()
    const arrived = names()

    await user.click(sortButton("Name"))
    expect(names()).not.toEqual(arrived)

    const control = reset()
    expect(control).not.toBeNull()
    if (!control) return

    await user.click(control)

    expect(names()).toEqual(arrived)
    expect(header("Name").getAttribute("aria-sort")).toBe("none")
    expect(reset()).toBeNull()
  })

  it("clears every level at once", async () => {
    const user = userEvent.setup()
    setup({
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "level", direction: "desc" },
          { key: "name", direction: "asc" },
        ],
      },
    })

    await user.click(screen.getByRole("button", { name: "Reset sort" }))

    for (const name of ["Team", "Level", "Name"]) expect(header(name).getAttribute("aria-sort")).toBe("none")
    expect(names()).toEqual(staff.map((person) => person.name))
  })

  it("leads the toolbar's controls, so that arriving it moves none of them", async () => {
    const user = userEvent.setup()
    const { container } = setup({ search: true, export: true })

    await user.click(sortButton("Name"))

    const groups = container.querySelectorAll(".tpz-toolbar-group")
    const controls = groups[groups.length - 1]
    expect(controls?.firstElementChild?.getAttribute("aria-label")).toBe("Reset sort")
  })

  it("goes back to page one", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({
      pagination: { pageSize: 2 },
      defaultState: { sort: [{ key: "name", direction: "asc" }], page: 3 },
      onStateChange,
    })

    await user.click(screen.getByRole("button", { name: "Reset sort" }))
    expect(onStateChange.mock.calls.at(-1)?.[0]).toMatchObject({ sort: [], page: 1 })
  })

  it("is left out when asked", async () => {
    const user = userEvent.setup()
    setup({ sortable: { reset: false } })

    await user.click(sortButton("Name"))
    expect(reset()).toBeNull()
  })

  it("is left out with sorting itself", () => {
    setup({ sortable: false, defaultState: { sort: [{ key: "name", direction: "asc" }] } })
    expect(reset()).toBeNull()
  })

  it("does not conjure up a toolbar to live in", async () => {
    const user = userEvent.setup()
    const { container } = setup({ columnControl: false })

    await user.click(sortButton("Name"))

    // A toolbar arriving on the click that sorted would push the header out
    // from under the pointer.
    expect(container.querySelector(".tpz-toolbar")).toBeNull()
    expect(reset()).toBeNull()
    expect(header("Name").getAttribute("aria-sort")).toBe("ascending")
  })

  describe("for a table that rests in an order of its own", () => {
    const resting = [{ key: "level", direction: "desc" }] as const

    it("is hidden while the table is in that order", () => {
      setup({ sortable: { reset: resting }, defaultState: { sort: [...resting] } })
      expect(reset()).toBeNull()
    })

    it("returns to that order, not to none", async () => {
      const user = userEvent.setup()
      setup({ sortable: { reset: resting }, defaultState: { sort: [...resting] } })

      await user.click(sortButton("Name"))
      await user.click(screen.getByRole("button", { name: "Reset sort" }))

      expect(header("Level").getAttribute("aria-sort")).toBe("descending")
      expect(header("Name").getAttribute("aria-sort")).toBe("none")
      expect(reset()).toBeNull()
    })

    it("counts no sort at all as somewhere to come back from", async () => {
      const user = userEvent.setup()
      setup({ sortable: { reset: resting }, defaultState: { sort: [...resting] } })

      // Third click on the resting column: descending, then off.
      await user.click(sortButton("Level"))
      expect(header("Level").getAttribute("aria-sort")).toBe("none")
      expect(reset()).not.toBeNull()
    })

    it("does not re-render every header for an options object written inline", async () => {
      // The options are a new object on every render; what they say is not.
      const user = userEvent.setup()
      const { rerender } = setup({ sortable: { reset: [{ key: "level", direction: "desc" }] } })

      await user.click(sortButton("Name"))
      rerender(
        <Table
          data={staff}
          columns={["name", "team", "level"]}
          getRowId={(person) => person.id}
          pagination={false}
          aria-label="Staff"
          sortable={{ reset: [{ key: "level", direction: "desc" }] }}
        />,
      )

      // The sort made before the re-render is still the one in force.
      expect(header("Name").getAttribute("aria-sort")).toBe("ascending")
      expect(reset()).not.toBeNull()
    })
  })
})

describe("when the controls are links", () => {
  const href = (state: TableState) => applyStateToUrl("/staff", state)

  it("draws the reset as a link to the unsorted view", () => {
    setup({ buildHref: href, defaultState: { sort: [{ key: "name", direction: "desc" }] } })

    const link = screen.getByRole("link", { name: "Reset sort" })
    expect(link.getAttribute("href")).toBe("/staff")
  })

  it("keeps everything else the URL carries when it resets", () => {
    setup({
      buildHref: href,
      search: true,
      defaultState: {
        sort: [{ key: "name", direction: "desc" }],
        search: "a",
        filters: [{ key: "team", operator: "eq", value: "Eng" }],
      },
    })

    const target = screen.getByRole("link", { name: "Reset sort" }).getAttribute("href") ?? ""
    const state = stateFromUrl(target.split("?")[1] ?? "")

    expect(state.sort).toEqual([])
    expect(state.search).toBe("a")
    expect(state.filters).toEqual([{ key: "team", operator: "eq", value: "Eng" }])
  })

  it("links the reset to the resting sort when there is one", () => {
    setup({
      buildHref: href,
      sortable: { reset: [{ key: "level", direction: "desc" }] },
      defaultState: { sort: [{ key: "name", direction: "asc" }] },
    })

    expect(screen.getByRole("link", { name: "Reset sort" }).getAttribute("href")).toBe("/staff?sort=level%3Adesc")
  })

  it("hands a plain click on the reset to the router", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    setup({ buildHref: href, onNavigate, defaultState: { sort: [{ key: "name", direction: "desc" }] } })

    await user.click(screen.getByRole("link", { name: "Reset sort" }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate.mock.calls[0]?.[0]).toBe("/staff")
  })

  it("names the level in each header link", () => {
    setup({
      buildHref: href,
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "desc" },
        ],
      },
    })

    expect(screen.getByRole("link", { name: "Sort by Team, sort level 1" })).toBeDefined()
    expect(screen.getByRole("link", { name: "Sort by Name, sort level 2" })).toBeDefined()
    expect(screen.getByRole("link", { name: "Sort by Level" })).toBeDefined()
    expect([order("Team"), order("Name")]).toEqual(["1", "2"])
  })

  it("turns a shift-click on a header link into a change of state, not a new window", () => {
    const onStateChange = vi.fn<(state: TableState) => void>()
    const onNavigate = vi.fn()
    setup({
      buildHref: href,
      onNavigate,
      onStateChange,
      defaultState: { sort: [{ key: "team", direction: "asc" }] },
    })

    const link = screen.getByRole("link", { name: "Sort by Name" })
    const allowed = fireEvent.click(link, { shiftKey: true })

    // Prevented, so the browser opens nothing; and not sent to the router as
    // if it were a plain click on the link's own address.
    expect(allowed).toBe(false)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
    ])
  })

  it("leaves a shift-click alone when the table sorts by one column", () => {
    const onStateChange = vi.fn()
    setup({ buildHref: href, onStateChange, sortable: { multiple: false } })

    const allowed = fireEvent.click(screen.getByRole("link", { name: "Sort by Name" }), { shiftKey: true })

    // The browser's to handle, as a modified click on any link is.
    expect(allowed).toBe(true)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("leaves the other modified clicks to the browser", () => {
    const onStateChange = vi.fn()
    setup({ buildHref: href, onStateChange })

    const link = screen.getByRole("link", { name: "Sort by Name" })
    expect(fireEvent.click(link, { shiftKey: true, metaKey: true })).toBe(true)
    expect(fireEvent.click(link, { shiftKey: true, ctrlKey: true })).toBe(true)
    expect(fireEvent.click(link, { shiftKey: true, button: 1 })).toBe(true)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("does the same through the caller's own link component", () => {
    const seen: string[] = []
    const Link: LinkComponent = ({ href: to, children, ...rest }) => {
      seen.push(to)
      return (
        <a href={to} data-router-link="" {...rest}>
          {children}
        </a>
      )
    }

    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({
      buildHref: href,
      linkComponent: Link,
      onStateChange,
      defaultState: { sort: [{ key: "team", direction: "asc" }] },
    })

    // The reset goes through it like every other link the table draws.
    const reset = screen.getByRole("link", { name: "Reset sort" })
    expect(reset.hasAttribute("data-router-link")).toBe(true)
    expect(seen).toContain("/staff")

    const allowed = fireEvent.click(screen.getByRole("link", { name: "Sort by Name" }), { shiftKey: true })
    expect(allowed).toBe(false)
    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toHaveLength(2)
  })

  it("links the menu's levels too", async () => {
    const user = userEvent.setup()
    setup({ buildHref: href, defaultState: { sort: [{ key: "team", direction: "asc" }] } })

    await user.click(screen.getByRole("button", { name: "Name column options" }))

    const then = screen.getByRole("link", { name: "Then sort descending" })
    expect(stateFromUrl((then.getAttribute("href") ?? "").split("?")[1] ?? "").sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "desc" },
    ])
  })
})

describe("with the sorting done on a server", () => {
  it("asks for the levels and leaves the rows as they were given", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ server: true, total: 6, onStateChange })
    const given = names()

    await user.click(sortButton("Team"))
    await user.keyboard("{Shift>}")
    await user.click(sortButton("Name"))
    await user.keyboard("{/Shift}")

    expect(onStateChange.mock.calls.at(-1)?.[0].sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
    ])
    expect(names()).toEqual(given)
    // The headers still say what was asked for.
    expect([order("Team"), order("Name")]).toEqual(["1", "2"])
  })
})

describe("with the state held by the caller", () => {
  it("shows the levels it is given and reports the ones it is asked for", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    const { rerender } = setup({ state: { sort: [{ key: "team", direction: "asc" }] }, onStateChange })

    await user.keyboard("{Shift>}")
    await user.click(sortButton("Level"))
    await user.keyboard("{/Shift}")

    const asked = onStateChange.mock.calls.at(-1)?.[0].sort
    expect(asked).toEqual([
      { key: "team", direction: "asc" },
      { key: "level", direction: "asc" },
    ])

    // Still controlled: nothing changes on screen until the caller agrees.
    expect(header("Level").getAttribute("aria-sort")).toBe("none")

    rerender(
      <Table
        data={staff}
        columns={["name", "team", "level"]}
        getRowId={(person) => person.id}
        pagination={false}
        aria-label="Staff"
        state={{ sort: asked }}
        onStateChange={onStateChange}
      />,
    )

    expect([order("Team"), order("Level")]).toEqual(["1", "2"])
    expect(screen.getByRole("button", { name: "Reset sort" })).toBeDefined()
  })
})

describe("on a server", () => {
  const element = (
    <Table
      data={staff}
      columns={["name", "team", "level"]}
      getRowId={(person) => person.id}
      pagination={false}
      aria-label="Staff"
      buildHref={(state) => applyStateToUrl("/staff", state)}
      defaultState={{
        sort: [
          { key: "team", direction: "asc" },
          { key: "level", direction: "desc" },
        ],
      }}
    />
  )

  it("writes the levels, the order and the reset into the HTML", () => {
    const html = renderToString(element)

    expect(html).toContain('class="tpz-th-order"')
    expect(html).toContain('aria-label="Reset sort"')
    expect(html).toContain('href="/staff"')
    // Sorted before it left the server: Eng by level descending comes first.
    expect(html.indexOf(">Bo<")).toBeLessThan(html.indexOf(">Ada<"))
    expect(html.indexOf(">Ada<")).toBeLessThan(html.indexOf(">Abe<"))
  })

  it("hydrates without a mismatch", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(element)
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

describe("accessibility", () => {
  it("passes the automated checks with several levels and the reset on screen", async () => {
    const { container } = setup({
      search: true,
      defaultState: {
        sort: [
          { key: "team", direction: "asc" },
          { key: "name", direction: "desc" },
        ],
      },
    })

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })

  it("reaches the reset with the keyboard and works it", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { sort: [{ key: "name", direction: "desc" }] } })

    const control = screen.getByRole("button", { name: "Reset sort" })
    control.focus()
    await user.keyboard("{Enter}")

    expect(header("Name").getAttribute("aria-sort")).toBe("none")
  })
})
