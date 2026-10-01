import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { applyStateToUrl, stateFromUrl, type TableState } from "@trapezium/core"
import { columns as fullColumns, customTypes, makeRows, type Row } from "@trapezium/core/testing"

import { Table } from "./table.js"
import type { Column, TableProps } from "./types.js"

/**
 * Searching a column from its header.
 *
 * Opt-in, and deliberately slight: a magnifier that turns up when a header is
 * hovered, and the header itself becoming the text box. What is typed there is
 * the column's filter — the same one its menu edits — so it has to show up as
 * a chip, reach the caller, survive a link, and find every type of value by
 * the words that type puts on the screen.
 */

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

type Person = { id: string; name: string; team: string; salary: number; joined: string; remote: boolean }

const staff: Person[] = [
  { id: "1", name: "Ada Lovelace", team: "Eng", salary: 120_000, joined: "2024-03-01", remote: true },
  { id: "2", name: "Tom Kerrigan", team: "Sales", salary: 80_000, joined: "2023-06-15", remote: false },
  { id: "3", name: "Zoë Marchetti", team: "Eng", salary: 118_500, joined: "2022-01-10", remote: true },
  { id: "4", name: "Bea Whitlock", team: "Ops", salary: 95_000, joined: "2024-03-22", remote: false },
]

const columns: Column<Person>[] = [
  { key: "name" },
  { key: "team", filter: "set" },
  { key: "salary", type: "currency" },
  { key: "joined", type: "date" },
  { key: "remote", type: "boolean" },
]

function setup(props: Partial<TableProps<Person>> = {}) {
  return render(
    <Table
      data={staff}
      columns={columns}
      getRowId={(person) => person.id}
      pagination={false}
      aria-label="Staff"
      // No wait, so a test reads the result of typing without a clock.
      headerSearch={{ debounce: 0 }}
      {...props}
    />,
  )
}

const names = () =>
  [...document.querySelectorAll("tbody tr")].map((row) => row.querySelector("td")?.textContent?.trim() ?? "")

function header(key: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(`thead th[data-key="${key}"]`)
  if (!cell) throw new Error(`no ${key} header`)
  return cell
}

const trigger = (label: string) => screen.getByRole("button", { name: new RegExp(`^Search ${label}`) })
const box = (label: string) => screen.getByRole("searchbox", { name: `Search ${label}` })

/** Opens a column's search box and types into it. */
async function searchFor(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  await user.click(trigger(label))
  await user.type(box(label), text)
}

describe("who gets a magnifier", () => {
  it("nobody, until it is asked for", () => {
    setup({ headerSearch: undefined })
    expect(screen.queryByRole("button", { name: /^Search / })).toBeNull()
  })

  it("every column that can be filtered, when the table asks", () => {
    setup()
    for (const label of ["Name", "Team", "Salary", "Joined", "Remote"]) expect(trigger(label)).toBeDefined()
  })

  it("only the columns that ask, when the table does not", () => {
    setup({
      headerSearch: undefined,
      columns: [{ key: "name", headerSearch: true }, { key: "team" }],
    })

    expect(trigger("Name")).toBeDefined()
    expect(screen.queryByRole("button", { name: /^Search Team/ })).toBeNull()
  })

  it("not a column that opted out, or one with its filter off", () => {
    setup({
      columns: [{ key: "name", headerSearch: false }, { key: "team", filter: false }, { key: "salary" }],
    })

    expect(screen.queryByRole("button", { name: /^Search Name/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Search Team/ })).toBeNull()
    expect(trigger("Salary")).toBeDefined()
  })

  it("nobody at all when the table's filters are switched off, because a search is one", () => {
    setup({ filters: false })
    expect(screen.queryByRole("button", { name: /^Search / })).toBeNull()
  })

  it("still everybody when only the column menus are switched off", () => {
    setup({ columnMenu: false })
    expect(screen.queryByRole("button", { name: /column options/ })).toBeNull()
    expect(trigger("Name")).toBeDefined()
  })
})

describe("the box", () => {
  it("opens over the header, focused, with the column's name where it was", async () => {
    const user = userEvent.setup()
    setup()

    expect(screen.queryByRole("searchbox")).toBeNull()
    await user.click(trigger("Name"))

    const input = box("Name")
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute("placeholder")).toBe("Name")
    expect(header("name").dataset["searching"]).toBe("true")
    // Laid over the header, not put in place of it: the label is what keeps
    // the column the width it was.
    expect(header("name").querySelector(".tpz-th-inner .tpz-th-label")?.textContent).toBe("Name")
    expect(input.closest(".tpz-th-searchbox")?.parentElement).toBe(header("name"))
  })

  it("does not sort the column on the way in", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(trigger("Name"))
    expect(header("name").getAttribute("aria-sort")).toBe("none")
  })

  it("filters as it is typed into", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Name", "love")
    await waitFor(() => expect(names()).toEqual(["Ada Lovelace"]))
  })

  it("ignores case and accents, like every other text comparison", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Name", "ZOE")
    await waitFor(() => expect(names()).toEqual(["Zoë Marchetti"]))
  })

  it("applies at once on Enter, closes, and hands focus back to the magnifier", async () => {
    const user = userEvent.setup()
    // A long wait, so only Enter can be what applied it.
    setup({ headerSearch: { debounce: 60_000 } })

    await searchFor(user, "Name", "tom")
    expect(names()).toHaveLength(4)

    await user.keyboard("{Enter}")

    expect(names()).toEqual(["Tom Kerrigan"])
    expect(screen.queryByRole("searchbox")).toBeNull()
    expect(document.activeElement).toBe(trigger("Name"))
    expect(header("name").dataset["searching"]).toBeUndefined()
  })

  it("keeps what was typed when focus moves away, and closes", async () => {
    const user = userEvent.setup()
    // jsdom never reports its document as focused; a browser does, which is
    // how the box tells a click elsewhere from the window going away.
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true)
    setup({ headerSearch: { debounce: 60_000 }, search: true })

    await searchFor(user, "Name", "bea")
    await user.click(screen.getByRole("searchbox", { name: "Search" }))
    hasFocus.mockRestore()

    expect(screen.queryByRole("searchbox", { name: "Search Name" })).toBeNull()
    expect(names()).toEqual(["Bea Whitlock"])
  })

  it("closes with nothing applied when nothing was typed", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn()
    setup({ onStateChange })

    await user.click(trigger("Name"))
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("searchbox")).toBeNull()
    expect(document.activeElement).toBe(trigger("Name"))
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("empties on Escape, and closes on the Escape after that", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Name", "ada")
    await waitFor(() => expect(names()).toHaveLength(1))

    await user.keyboard("{Escape}")
    expect(box("Name")).toHaveProperty("value", "")
    expect(names()).toHaveLength(4)

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("searchbox")).toBeNull()
  })

  it("does not let its Escape reach whatever the table is inside", async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    render(
      <div onKeyDown={(event) => event.key === "Escape" && outer()}>
        <Table data={staff} columns={columns} headerSearch aria-label="Staff" />
      </div>,
    )

    await user.click(trigger("Name"))
    await user.keyboard("{Escape}")
    expect(outer).not.toHaveBeenCalled()
  })

  it("clears and closes from its own button", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Name", "ada")
    await waitFor(() => expect(names()).toHaveLength(1))

    await user.click(screen.getByRole("button", { name: "Clear search on Name" }))

    expect(names()).toHaveLength(4)
    expect(screen.queryByRole("searchbox")).toBeNull()
    expect(document.activeElement).toBe(trigger("Name"))
  })

  it("empties when the last character is deleted and the box is left", async () => {
    const user = userEvent.setup()
    setup({ headerSearch: { debounce: 60_000 }, defaultState: { filters: [{ key: "name", operator: "contains", value: "a" }] } })

    await user.click(trigger("Name"))
    await user.clear(box("Name"))
    // Escape on an empty box closes it — and what was deleted stays deleted,
    // even though the wait had not run out.
    await user.keyboard("{Escape}")

    expect(names()).toHaveLength(4)
  })

  it("opens on what the column is already being searched for", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { filters: [{ key: "name", operator: "contains", value: "ada" }] } })

    await user.click(trigger("Name"))
    expect(box("Name")).toHaveProperty("value", "ada")
  })

  it("opens empty over a filter that was not a search, and leaves it alone", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn()
    setup({ defaultState: { filters: [{ key: "team", operator: "in", value: ["Eng", "Ops"] }] }, onStateChange })

    await user.click(trigger("Team"))
    expect(box("Team")).toHaveProperty("value", "")

    await user.keyboard("{Escape}")
    expect(onStateChange).not.toHaveBeenCalled()
    expect(names()).toHaveLength(3)
  })

  it("stops the header being dragged while it is a text box", async () => {
    const user = userEvent.setup()
    setup()

    expect(header("name").draggable).toBe(true)
    await user.click(trigger("Name"))
    // A draggable ancestor would take the mouse away from the text.
    expect(header("name").draggable).toBe(false)

    await user.keyboard("{Escape}")
    expect(header("name").draggable).toBe(true)
  })

  it("stays open when the window loses focus rather than the box", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(trigger("Name"))
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false)
    fireEvent.blur(box("Name"))
    hasFocus.mockRestore()

    expect(screen.queryByRole("searchbox")).not.toBeNull()
  })
})

describe("waiting for the typing to stop", () => {
  it("applies once, after the pause, rather than on every key", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ headerSearch: { debounce: 200 }, onStateChange })

    act(() => trigger("Name").click())
    const input = box("Name")

    for (const text of ["a", "ad", "ada"]) {
      fireEvent.change(input, { target: { value: text } })
      act(() => vi.advanceTimersByTime(150))
    }
    expect(onStateChange).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(60))
    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(onStateChange.mock.calls[0]?.[0].filters).toEqual([{ key: "name", operator: "contains", value: "ada" }])
  })

  it("waits 150 milliseconds unless told otherwise", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()
    setup({ headerSearch: true, onStateChange })

    act(() => trigger("Name").click())
    fireEvent.change(box("Name"), { target: { value: "ada" } })

    act(() => vi.advanceTimersByTime(149))
    expect(onStateChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(2))
    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it("says nothing when what was typed comes to the same search", () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()
    setup({ headerSearch: { debounce: 10 }, onStateChange, defaultState: { filters: [{ key: "name", operator: "contains", value: "ada" }] } })

    act(() => trigger("Name").click())
    // A trailing space is not a different search.
    fireEvent.change(box("Name"), { target: { value: "ada " } })
    act(() => vi.advanceTimersByTime(50))

    expect(onStateChange).not.toHaveBeenCalled()
  })
})

describe("it is the column's filter", () => {
  it("shows as a chip that reads as a sentence", async () => {
    const user = userEvent.setup()
    const { container } = setup()

    await searchFor(user, "Name", "ada")
    await waitFor(() => expect(container.querySelector(".tpz-chip")?.textContent).toBe("Name contains ada"))
  })

  it("marks the magnifier, and says what is being searched for", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Name", "ada")
    await user.keyboard("{Enter}")

    const button = trigger("Name")
    expect(button.dataset["active"]).toBe("true")
    expect(button.getAttribute("aria-label")).toBe("Search Name, searching for ada")
    // And the header says it is filtered, as it does for any filter.
    expect(header("name").dataset["filtered"]).toBe("true")
  })

  it("follows its chip being removed, even while the box is open", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Name", "ada")
    await waitFor(() => expect(names()).toHaveLength(1))

    fireEvent.click(screen.getByRole("button", { name: "Remove filter on Name" }))

    expect(names()).toHaveLength(4)
    expect(box("Name")).toHaveProperty("value", "")
  })

  it("is what the column's menu shows, operator and all", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { filters: [{ key: "joined", operator: "contains", value: "mar" }] } })

    expect(names()).toEqual(["Ada Lovelace", "Bea Whitlock"])

    await user.click(screen.getByRole("button", { name: "Joined column options" }))
    const panel = screen.getByRole("group", { name: "Joined column" })

    expect(within(panel).getByRole("combobox", { name: "How to filter Joined" })).toHaveProperty("value", "contains")
    // A date picker could not hold "mar", so this is a plain text box.
    const value = within(panel).getByRole("textbox", { name: "Filter Joined by" })
    expect(value).toHaveProperty("value", "mar")
    expect(value.getAttribute("type")).toBe("text")
  })

  it("goes back to the type's own input when the menu picks one of the type's own operators", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { filters: [{ key: "joined", operator: "contains", value: "mar" }] } })

    await user.click(screen.getByRole("button", { name: "Joined column options" }))
    const panel = screen.getByRole("group", { name: "Joined column" })
    await user.selectOptions(within(panel).getByRole("combobox", { name: "How to filter Joined" }), "gte")

    expect(panel.querySelector('input[aria-label="Filter Joined by"]')?.getAttribute("type")).toBe("date")
  })

  it("does not tick a choice in a set filter, and is replaced when one is ticked", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ defaultState: { filters: [{ key: "team", operator: "contains", value: "s" }] }, onStateChange })

    // "Sales" and "Ops".
    expect(names()).toEqual(["Tom Kerrigan", "Bea Whitlock"])

    await user.click(screen.getByRole("button", { name: "Team column options" }))
    const panel = screen.getByRole("group", { name: "Team column" })
    const boxes = within(panel).getAllByRole("checkbox")
    expect(boxes.every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true)

    await user.click(within(panel).getByRole("checkbox", { name: "Eng" }))

    // The choice alone — the searched-for "s" is not carried into the list.
    expect(onStateChange.mock.calls.at(-1)?.[0].filters).toEqual([{ key: "team", operator: "eq", value: "Eng" }])
  })

  it("does not read as a yes or a no in a checkbox column's menu", async () => {
    const user = userEvent.setup()
    setup({ defaultState: { filters: [{ key: "remote", operator: "contains", value: "yes" }] } })

    expect(names()).toEqual(["Ada Lovelace", "Zoë Marchetti"])

    await user.click(screen.getByRole("button", { name: "Remote column options" }))
    expect(screen.getByRole("combobox", { name: "Filter Remote" })).toHaveProperty("value", "")
  })

  it("replaces whatever filter the column had", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ defaultState: { filters: [{ key: "team", operator: "in", value: ["Eng", "Ops"] }] }, onStateChange })

    await searchFor(user, "Team", "sal")
    await waitFor(() => expect(names()).toEqual(["Tom Kerrigan"]))
    expect(onStateChange.mock.calls.at(-1)?.[0].filters).toEqual([{ key: "team", operator: "contains", value: "sal" }])
  })

  it("works alongside searches in other columns, the toolbar's search and a sort", async () => {
    const user = userEvent.setup()
    setup({ search: true, defaultState: { sort: [{ key: "name", direction: "desc" }] } })

    await searchFor(user, "Team", "eng")
    await user.keyboard("{Enter}")
    expect(names()).toEqual(["Zoë Marchetti", "Ada Lovelace"])

    await searchFor(user, "Salary", "$120")
    await user.keyboard("{Enter}")
    expect(names()).toEqual(["Ada Lovelace"])
  })
})

describe("every type, by the words on the screen", () => {
  it("money, by the formatted figure", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Salary", "$118,5")
    await waitFor(() => expect(names()).toEqual(["Zoë Marchetti"]))
  })

  it("a date, by its month", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Joined", "mar")
    await waitFor(() => expect(names()).toEqual(["Ada Lovelace", "Bea Whitlock"]))
  })

  it("a checkbox, by the word it is read as", async () => {
    const user = userEvent.setup()
    setup()

    await searchFor(user, "Remote", "no")
    await waitFor(() => expect(names()).toEqual(["Tom Kerrigan", "Bea Whitlock"]))
  })

  /*
    The full spectrum: one column of every built-in type and two custom ones,
    over data built to be awkward. For each column that can be searched, the
    text of a real cell is typed into its header, and the row it came from has
    to still be there — with every row left showing that text too.
  */
  describe("across the whole dataset", () => {
    const NOW = new Date("2026-08-13T12:00:00.000Z")
    const rows = makeRows(60, 21)
    const everyColumn = fullColumns as Column<Row>[]

    const searchable = everyColumn.filter((column) => !["image", "json"].includes(column.type ?? ""))

    function mount() {
      return render(
        <Table
          data={rows}
          columns={everyColumn}
          types={customTypes}
          getRowId={(row) => row.id}
          format={{ now: NOW, currency: "AUD" }}
          pagination={false}
          columnControl={false}
          headerSearch={{ debounce: 0 }}
          aria-label="Everything"
        />,
      )
    }

    /** The cell for a column in each body row, with the row's id. */
    function cellsOf(container: HTMLElement, key: string): Array<{ id: string; cell: HTMLElement }> {
      return [...container.querySelectorAll<HTMLElement>("tbody tr")].flatMap((row) => {
        const cell = row.querySelector<HTMLElement>(`td[data-key="${key}"]`)
        const id = row.querySelector<HTMLElement>('td[data-key="id"]')?.textContent?.trim() ?? ""
        return cell ? [{ id, cell }] : []
      })
    }

    /** What a person would read in a cell and type: one tag of several, or the cell's text. */
    function wordsIn(cell: HTMLElement): string {
      const tag = cell.querySelector(".tpz-tags .tpz-badge")
      return (tag ?? cell).textContent?.trim() ?? ""
    }

    it("leaves the two types that show no text without a magnifier", () => {
      mount()
      expect(screen.queryByRole("button", { name: /^Search Avatar/ })).toBeNull()
      expect(screen.queryByRole("button", { name: /^Search Payload/ })).toBeNull()
    })

    for (const column of searchable) {
      const key = String(column.key)

      it(`${key} (${column.type ?? "inferred"})`, async () => {
        const { container } = mount()
        const headerText = header(key).querySelector(".tpz-th-label")?.textContent ?? ""

        // The first row with something in this column.
        const source = cellsOf(container, key).find(({ cell }) => !cell.querySelector(".tpz-empty-value"))
        expect(source, `a row with a value in ${key}`).toBeDefined()
        if (!source) return

        const typed = wordsIn(source.cell)
        expect(typed).not.toBe("")

        act(() => screen.getByRole("button", { name: `Search ${headerText}` }).click())
        fireEvent.change(screen.getByRole("searchbox", { name: `Search ${headerText}` }), { target: { value: typed } })

        await waitFor(() => expect(container.querySelector(".tpz-chip")).not.toBeNull())

        const left = cellsOf(container, key)
        expect(left.length).toBeGreaterThan(0)
        expect(left.length).toBeLessThanOrEqual(rows.length)

        // The row the words were read from is still on screen…
        expect(left.map((entry) => entry.id)).toContain(source.id)

        // …and nothing is left that does not say them.
        const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
        for (const { cell, id } of left) {
          expect(fold(cell.textContent ?? ""), `${key} in ${id}`).toContain(fold(typed))
        }
      })
    }
  })
})

describe("with the filtering done on a server", () => {
  it("asks for the search and leaves the rows as they were given", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn<(state: TableState) => void>()
    setup({ server: true, total: 4, onStateChange })

    await searchFor(user, "Joined", "mar")
    await waitFor(() => expect(onStateChange).toHaveBeenCalled())

    expect(onStateChange.mock.calls.at(-1)?.[0]).toMatchObject({
      filters: [{ key: "joined", operator: "contains", value: "mar" }],
      page: 1,
    })
    expect(names()).toHaveLength(4)
  })
})

describe("when the controls are links", () => {
  it("reports the search as a change of state, which the caller turns into a URL", async () => {
    const user = userEvent.setup()
    const visited: string[] = []
    const href = (state: TableState) => applyStateToUrl("/staff", state)

    setup({ buildHref: href, onStateChange: (state) => visited.push(href(state)) })

    await searchFor(user, "Salary", "$1,2")
    await user.keyboard("{Enter}")

    const url = visited.at(-1) ?? ""
    // Readable in the address bar, and reads back as the same search.
    expect(stateFromUrl(url.split("?")[1] ?? "").filters).toEqual([
      { key: "salary", operator: "contains", value: "$1,2" },
    ])
  })

  it("opens a shared link on the search it carries", () => {
    setup({ defaultState: stateFromUrl("f=name:contains:tom") })

    expect(names()).toEqual(["Tom Kerrigan"])
    expect(trigger("Name").dataset["active"]).toBe("true")
  })
})

describe("with the state held by the caller", () => {
  it("shows the search it is given, and follows when it changes", async () => {
    const user = userEvent.setup()
    const props = { data: staff, columns, getRowId: (person: Person) => person.id, pagination: false as const, headerSearch: true }

    const { rerender } = render(
      <Table {...props} aria-label="Staff" state={{ filters: [{ key: "name", operator: "contains", value: "ada" }] }} />,
    )
    expect(names()).toEqual(["Ada Lovelace"])

    await user.click(trigger("Name"))
    expect(box("Name")).toHaveProperty("value", "ada")

    rerender(<Table {...props} aria-label="Staff" state={{ filters: [{ key: "name", operator: "contains", value: "tom" }] }} />)

    expect(names()).toEqual(["Tom Kerrigan"])
    expect(box("Name")).toHaveProperty("value", "tom")
  })
})

describe("on a server", () => {
  const element = (
    <Table
      data={staff}
      columns={columns}
      getRowId={(person) => person.id}
      pagination={false}
      headerSearch
      aria-label="Staff"
      defaultState={{ filters: [{ key: "joined", operator: "contains", value: "2024" }] }}
    />
  )

  it("renders the magnifiers, the rows already searched, and never the box", () => {
    const html = renderToString(element)

    expect(html.match(/class="tpz-th-search"/g)).toHaveLength(5)
    expect(html).not.toContain("tpz-th-searchbox")
    expect(html).toContain('aria-label="Search Joined, searching for 2024"')
    expect(html).toContain("Ada Lovelace")
    expect(html).not.toContain("Tom Kerrigan")
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
  const check = async (root: HTMLElement) => {
    const results = await axe.run(root, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
    return results.violations.map((violation) => `${violation.id}: ${violation.help}`)
  }

  it("passes the automated checks closed, open and searching", async () => {
    const user = userEvent.setup()
    const { container } = setup()
    expect(await check(container)).toEqual([])

    await user.click(trigger("Name"))
    expect(await check(container)).toEqual([])

    await user.type(box("Name"), "ada")
    await user.keyboard("{Enter}")
    expect(await check(container)).toEqual([])
  })

  it("is reached and worked from the keyboard alone", async () => {
    const user = userEvent.setup()
    setup({ columnControl: false, columns: [{ key: "name" }] })

    // The sort control, then the magnifier.
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(trigger("Name"))

    await user.keyboard("{Enter}")
    expect(document.activeElement).toBe(box("Name"))

    await user.keyboard("zoe{Enter}")
    expect(names()).toEqual(["Zoë Marchetti"])
    expect(document.activeElement).toBe(trigger("Name"))
  })

  it("names both of its buttons", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(trigger("Salary"))
    expect(screen.getByRole("button", { name: "Clear search on Salary" })).toBeDefined()
  })
})
