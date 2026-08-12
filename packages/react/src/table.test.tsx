import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
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
    expect(errors).toEqual([])
  })
})
