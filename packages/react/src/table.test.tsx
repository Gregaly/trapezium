import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "@testing-library/react"

import { Table } from "./table.js"

afterEach(cleanup)

type Person = {
  id: string
  name: string
  email: string
  age: number
  plan: string
  active: boolean
  joined: string
}

const people: Person[] = [
  { id: "1", name: "Ada", email: "ada@example.com", age: 36, plan: "pro", active: true, joined: "2026-01-15" },
  { id: "2", name: "Tom", email: "tom@example.com", age: 28, plan: "free", active: false, joined: "2026-03-02" },
  { id: "3", name: "Zoe", email: "zoe@example.com", age: 44, plan: "pro", active: true, joined: "2025-11-20" },
]

/** The visible text of every body row, in order. */
function bodyRows(): string[][] {
  const body = document.querySelector("tbody")
  return [...(body?.querySelectorAll("tr") ?? [])].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""),
  )
}

describe("with nothing configured", () => {
  it("builds a column per field and renders every row", () => {
    render(<Table data={people} />)

    expect(screen.getByRole("columnheader", { name: /full name|name/i })).toBeDefined()
    expect(bodyRows()).toHaveLength(3)
  })

  it("humanises the headers", () => {
    render(<Table data={people} />)
    expect(screen.getByRole("columnheader", { name: /^ID/ })).toBeDefined()
  })

  it("formats by inferred type", () => {
    render(<Table data={people} columns={["joined"]} />)
    expect(screen.getByText("Jan 15, 2026")).toBeDefined()
  })

  it("renders a real table, because everything downstream depends on it", () => {
    render(<Table data={people} />)
    expect(screen.getByRole("table")).toBeDefined()
    expect(screen.getAllByRole("row")).toHaveLength(4)
  })
})

describe("sorting", () => {
  it("cycles ascending, descending, off", async () => {
    const user = userEvent.setup()
    render(<Table data={people} columns={["name", "age"]} />)

    const header = screen.getByRole("columnheader", { name: /^Name/ })
    const button = within(header).getByRole("button", { name: "Name" })

    await user.click(button)
    expect(bodyRows().map((row) => row[0])).toEqual(["Ada", "Tom", "Zoe"])
    expect(header.getAttribute("aria-sort")).toBe("ascending")

    await user.click(button)
    expect(bodyRows().map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])
    expect(header.getAttribute("aria-sort")).toBe("descending")
  })

  it("sorts numbers numerically", async () => {
    const user = userEvent.setup()
    render(<Table data={people} columns={["name", "age"]} columnMenu={false} />)

    await user.click(screen.getByRole("button", { name: /^Age/ }))
    expect(bodyRows().map((row) => row[1])).toEqual(["28", "36", "44"])
  })
})

describe("search", () => {
  it("filters across every column, on formatted text as well as raw", async () => {
    const user = userEvent.setup()
    render(<Table data={people} search />)

    await user.type(screen.getByRole("searchbox", { name: /search/i }), "zoe")
    await vi.waitFor(() => expect(bodyRows()).toHaveLength(1))
  })

  it("says so when a search matches nothing", async () => {
    const user = userEvent.setup()
    render(<Table data={people} search />)

    await user.type(screen.getByRole("searchbox", { name: /search/i }), "nobody")
    await vi.waitFor(() => expect(screen.getByText("No rows match")).toBeDefined())
  })
})

describe("pagination", () => {
  const many = Array.from({ length: 55 }, (_, index) => ({ id: String(index), name: `Person ${String(index)}` }))

  it("pages, and says where you are", async () => {
    const user = userEvent.setup()
    render(<Table data={many} pagination={{ pageSize: 10 }} />)

    expect(bodyRows()).toHaveLength(10)
    expect(screen.getByText("1–10 of 55")).toBeDefined()

    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(screen.getByText("11–20 of 55")).toBeDefined()
  })

  it("keeps every loaded page on screen in load-more mode", async () => {
    const user = userEvent.setup()
    render(<Table data={many} pagination={{ mode: "loadMore", pageSize: 10 }} />)

    await user.click(screen.getByRole("button", { name: /load more/i }))
    expect(bodyRows()).toHaveLength(20)
  })

  it("shows no pagination when there is only one page", () => {
    render(<Table data={people} />)
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull()
  })
})

describe("selection", () => {
  it("reports what was selected", async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    render(<Table data={people} selection onSelectionChange={onSelectionChange} />)

    await user.click(screen.getByRole("checkbox", { name: "Select row 1" }))

    expect(onSelectionChange).toHaveBeenLastCalledWith(["1"], [people[0]])
  })

  it("selects the whole page from the header", async () => {
    const user = userEvent.setup()
    render(<Table data={people} selection />)

    await user.click(screen.getByRole("checkbox", { name: /select all/i }))
    expect(screen.getByText("3 selected")).toBeDefined()
  })
})

describe("custom rendering", () => {
  it("lets a column own its cell", () => {
    render(
      <Table
        data={people}
        columns={[{ key: "name", render: ({ value }) => <strong>{String(value).toUpperCase()}</strong> }]}
      />,
    )
    expect(screen.getByText("ADA").tagName).toBe("STRONG")
  })

  it("lets a column own only its text, and still sorts on the value", async () => {
    const user = userEvent.setup()
    render(
      <Table
        data={people}
        columnMenu={false}
        columns={[{ key: "age", format: ({ value }) => `${String(value)} years` }]}
      />,
    )

    expect(screen.getByText("36 years")).toBeDefined()

    await user.click(screen.getByRole("button", { name: /^Age/ }))
    expect(bodyRows().map((row) => row[0])).toEqual(["28 years", "36 years", "44 years"])
  })

  it("renders a custom type everywhere the built-ins work", () => {
    render(
      <Table
        data={people}
        columns={[{ key: "age", type: "stars" }]}
        types={{ stars: { name: "stars", format: (value) => "★".repeat(Number(value) / 10) } }}
      />,
    )
    expect(screen.getByText("★★★")).toBeDefined()
  })
})

describe("server mode", () => {
  it("renders the rows it was given and trusts the total", () => {
    render(
      <Table
        data={people}
        server
        total={480}
        pagination={{ pageSize: 3 }}
        state={{ page: 2 }}
        onStateChange={() => {}}
      />,
    )

    expect(bodyRows()).toHaveLength(3)
    expect(screen.getByText("4–6 of 480")).toBeDefined()
  })

  it("asks the caller for the next page instead of slicing", async () => {
    const user = userEvent.setup()
    const onStateChange = vi.fn()
    render(<Table data={people} server total={90} pagination={{ pageSize: 3 }} onStateChange={onStateChange} />)

    await user.click(screen.getByRole("button", { name: "Next page" }))
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
  })
})

describe("states", () => {
  it("has an empty state of its own, and takes one from the caller", () => {
    const { rerender } = render(<Table data={[]} columns={["name"]} />)
    expect(screen.getByText("Nothing to show")).toBeDefined()

    rerender(<Table data={[]} columns={["name"]} emptyState={<p>No people yet</p>} />)
    expect(screen.getByText("No people yet")).toBeDefined()
  })

  it("shows an error instead of rows", () => {
    render(<Table data={people} error="Could not load" />)
    expect(screen.getByRole("alert").textContent).toContain("Could not load")
  })
})

describe("server rendering", () => {
  it("produces the finished table as HTML, already sorted and paged", () => {
    const html = renderToString(
      <Table
        data={people}
        columns={["name", "age"]}
        defaultState={{ sort: [{ key: "age", direction: "desc" }], pageSize: 2 }}
      />,
    )

    // The first row is the oldest, in the markup itself — not corrected by an
    // effect after the page paints.
    expect(html.indexOf("Zoe")).toBeLessThan(html.indexOf("Ada"))
    expect(html).not.toContain("Tom")
    expect(html).toContain("<table")
  })

  it("hydrates without a mismatch", () => {
    const element = (
      <Table data={people} columns={["name", "joined"]} selection pagination={{ pageSize: 2 }} />
    )
    const server = renderToString(element)

    const container = document.createElement("div")
    container.innerHTML = server
    document.body.append(container)

    const errors: unknown[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args))

    const { hydrateRoot } = require("react-dom/client") as typeof import("react-dom/client")
    hydrateRoot(container, element)

    spy.mockRestore()
    container.remove()
    expect(errors).toEqual([])
  })
})

/**
 * jsdom has no drag-and-drop, so these build the events by hand. The handlers
 * only ever read `dataTransfer`, the pointer position and the element's own
 * rectangle, and all three are supplied here exactly as a browser would.
 */
function transfer(payload: Record<string, string> = {}, dropEffect = "move") {
  return {
    dropEffect,
    effectAllowed: "move",
    setData: (format: string, value: string) => {
      payload[format] = value
    },
    getData: (format: string) => payload[format] ?? "",
  }
}

/**
 * A drag event with a pointer position on it.
 *
 * Testing Library builds drag events from `window.DragEvent`, which jsdom does
 * not have — so it falls back to a plain `Event`, and `clientX` never arrives.
 * A `MouseEvent` of the right type carries the coordinates the handlers
 * actually read.
 */
function drag(
  type: string,
  dataTransfer: unknown,
  point: { x: number; y: number } = { x: 0, y: 0 },
): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y })
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer })
  return event
}

function measure(node: Element, box: { left: number; width: number }) {
  node.getBoundingClientRect = () =>
    ({
      left: box.left,
      right: box.left + box.width,
      top: 0,
      bottom: 32,
      width: box.width,
      height: 32,
      x: box.left,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

describe("reordering columns by dragging", () => {
  const headerKeys = (container: HTMLElement) =>
    [...container.querySelectorAll("thead .tpz-th")].map((cell) => (cell as HTMLElement).dataset["key"])

  it("moves a column to where it was dropped", () => {
    const { container } = render(<Table data={people} columns={["name", "age", "plan"]} />)
    const [name, , plan] = [...container.querySelectorAll("thead .tpz-th")]

    const payload = {}
    fireEvent(name!, drag("dragstart", transfer(payload)))

    measure(plan!, { left: 200, width: 100 })
    fireEvent(plan!, drag("dragover", transfer(payload), { x: 280, y: 10 }))
    fireEvent(plan!, drag("drop", transfer(payload), { x: 280, y: 10 }))

    expect(headerKeys(container)).toEqual(["age", "plan", "name"])
  })

  it("shows which edge it will land on", () => {
    const { container } = render(<Table data={people} columns={["name", "age"]} />)
    const age = [...container.querySelectorAll("thead .tpz-th")][1]!

    measure(age, { left: 100, width: 100 })
    fireEvent(age, drag("dragover", transfer(), { x: 110, y: 10 }))
    expect((age as HTMLElement).dataset["drop"]).toBe("before")

    fireEvent(age, drag("dragover", transfer(), { x: 190, y: 10 }))
    expect((age as HTMLElement).dataset["drop"]).toBe("after")
  })

  it("hides a column dragged out of the table, and keeps one dropped inside it", () => {
    const { container } = render(<Table data={people} columns={["name", "age"]} />)
    measure(container.querySelector(".tpz-frame")!, { left: 0, width: 400 })

    fireEvent(
      container.querySelector("thead .tpz-th")!,
      drag("dragend", transfer({}, "none"), { x: 900, y: 600 }),
    )
    expect(headerKeys(container)).toEqual(["age"])

    measure(container.querySelector(".tpz-frame")!, { left: 0, width: 400 })
    fireEvent(
      container.querySelector("thead .tpz-th")!,
      drag("dragend", transfer({}, "none"), { x: 900, y: 600 }),
    )
    // The last one stays: a table of nothing has no obvious way back.
    expect(headerKeys(container)).toEqual(["age"])
  })
})

/**
 * Infinite scrolling.
 *
 * jsdom has no layout and no IntersectionObserver, so the observer is stubbed —
 * which is enough to assert the two things that were wrong: where the sentinel
 * lives, and how often it may fire.
 */
describe("infinite scrolling", () => {
  let observed: Array<{ fire: () => void }> = []

  beforeEach(() => {
    observed = []
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: (entries: Array<{ isIntersecting: boolean }>) => void
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          this.callback = callback
        }
        observe() {
          observed.push({ fire: () => this.callback([{ isIntersecting: true }]) })
        }
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return []
        }
      },
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  const many = Array.from({ length: 200 }, (_, index) => ({ id: String(index), name: `Person ${String(index)}` }))

  it("puts the sentinel inside the scroll container, not in the pagination bar", () => {
    const { container } = render(<Table data={many} pagination={{ mode: "infinite", pageSize: 10 }} />)

    const sentinel = container.querySelector(".tpz-sentinel")
    expect(sentinel).toBeTruthy()
    // The bug this guards: a sentinel below the table is on screen whenever the
    // table is, so it fires immediately and loads every page at once.
    expect(container.querySelector(".tpz-scroll")?.contains(sentinel!)).toBe(true)
    expect(container.querySelector(".tpz-pagination .tpz-sentinel")).toBeNull()
  })

  it("loads one page each time it is reached, not every page at once", () => {
    const { container } = render(<Table data={many} pagination={{ mode: "infinite", pageSize: 10 }} />)
    const rows = () => container.querySelectorAll("tbody tr").length

    expect(rows()).toBe(10)

    act(() => observed.at(-1)!.fire())
    expect(rows()).toBe(20)

    act(() => observed.at(-1)!.fire())
    expect(rows()).toBe(30)
  })

  it("stops observing once every row is loaded", () => {
    const few = many.slice(0, 12)
    const { container } = render(<Table data={few} pagination={{ mode: "infinite", pageSize: 10 }} />)

    act(() => observed.at(-1)!.fire())
    expect(container.querySelectorAll("tbody tr")).toHaveLength(12)

    const settled = observed.length
    act(() => observed.at(-1)!.fire())
    // Nothing left to ask for, so no new observation was set up.
    expect(observed.length).toBe(settled)
  })
})
