/**
 * @vitest-environment jsdom
 *
 * Row height, and the reason it is affordable.
 *
 * Two features live here and they are the same feature. Auto height is CSS —
 * a real `<table>` in normal flow already grows a row to fit its tallest cell,
 * so all the markup has to do is say which mode it is in. What that leaves is
 * the thing that actually costs: a table whose rows are not all the same
 * height, being appended to, page after page, must not rebuild the rows that
 * were already there. jsdom has no layout, so height itself is not measurable
 * here — what is measurable is how much work a render does, which is the part
 * that goes wrong.
 */
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Table } from "./table.js"

afterEach(cleanup)

type Note = { id: string; title: string; body: string }

const notes: Note[] = [
  { id: "1", title: "Ada", body: "A long note that would wrap onto several lines given a width." },
  { id: "2", title: "Tom", body: "Short." },
]

describe("rowHeight", () => {
  it("says nothing at all by default, so the fixed-height stylesheet applies", () => {
    const { container } = render(<Table data={notes} />)
    expect(container.querySelector(".tpz")?.getAttribute("data-row-height")).toBeNull()
  })

  it("marks the table when rows size themselves", () => {
    const { container } = render(<Table data={notes} rowHeight="auto" />)
    expect(container.querySelector(".tpz")?.getAttribute("data-row-height")).toBe("auto")
  })

  /*
    A number sets the token *and* says it is an exact row, because the two
    together are what a caller means by it: rows of this height, with the text
    using them. One truncated line adrift in a 72px row is not what anybody was
    asking for.
  */
  it("sets the height token and marks the table exact when given a number", () => {
    const { container } = render(<Table data={notes} rowHeight={56} />)
    const root = container.querySelector<HTMLElement>(".tpz")!

    expect(root.style.getPropertyValue("--tpz-row-height")).toBe("56px")
    expect(root.getAttribute("data-row-height")).toBe("exact")
  })

  it("wraps under an exact height, the same as under auto", () => {
    const { container } = render(
      <Table data={notes} rowHeight={72} columns={[{ key: "body" }, { key: "title", wrap: false }]} />,
    )

    const root = container.querySelector<HTMLElement>(".tpz")!
    expect(root.getAttribute("data-row-height")).toBe("exact")

    // The opt-out still opts out, whichever of the two wrapping modes is on.
    const [body, title] = [...container.querySelectorAll("tbody tr:first-child td")]
    expect(body?.getAttribute("data-wrap")).toBeNull()
    expect(title?.getAttribute("data-wrap")).toBe("false")
  })

  it("keeps maxHeight working alongside it", () => {
    const { container } = render(<Table data={notes} rowHeight={40} maxHeight={300} />)
    const root = container.querySelector<HTMLElement>(".tpz")!

    expect(root.style.getPropertyValue("--tpz-row-height")).toBe("40px")
    expect(root.style.getPropertyValue("--tpz-max-height")).toBe("300px")
  })
})

describe("a column opting out of wrapping", () => {
  it("marks a column told to wrap, and one told not to", () => {
    const { container } = render(
      <Table
        data={notes}
        rowHeight="auto"
        columns={[{ key: "title", wrap: false }, { key: "body", wrap: true }]}
      />,
    )

    const [title, body] = [...container.querySelectorAll("tbody tr:first-child td")]
    expect(title?.getAttribute("data-wrap")).toBe("false")
    expect(body?.getAttribute("data-wrap")).toBe("true")
  })

  it("clamps a column given a number of lines", () => {
    const { container } = render(<Table data={notes} columns={[{ key: "body", wrap: 3 }]} />)

    const clamp = container.querySelector<HTMLElement>("tbody tr:first-child .tpz-clamp")
    expect(clamp).toBeTruthy()
    expect(clamp!.style.getPropertyValue("--tpz-cell-lines")).toBe("3")
    // Still a wrapping cell: the clamp is where it stops, not whether it wraps.
    expect(container.querySelector("tbody td")?.getAttribute("data-wrap")).toBe("true")
  })

  it("leaves a column that said nothing unwrapped and unclamped", () => {
    const { container } = render(<Table data={notes} columns={[{ key: "body" }]} />)
    expect(container.querySelector("tbody td")?.getAttribute("data-wrap")).toBeNull()
    expect(container.querySelector(".tpz-clamp")).toBeNull()
  })
})

/**
 * The expensive part.
 *
 * An infinite list keeps every page loaded so far, so by page ten the table
 * holds ten pages of rows — and reaching the sentinel used to re-run every
 * cell renderer in all of them to put twenty-five new rows at the bottom. With
 * variable-height rows that is not merely wasted work, it is a re-layout of
 * the whole table at the moment the user is scrolling through it.
 *
 * Counting renderer calls is the honest way to assert this: it is exactly the
 * work a caller pays for, and it does not depend on React's internals.
 */
describe("appending a page", () => {
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

  type Person = { id: string; name: string }

  const many: Person[] = Array.from({ length: 100 }, (_, index) => ({
    id: String(index),
    name: `Person ${String(index)}`,
  }))

  function countingTable(extra: Record<string, unknown> = {}) {
    const rendered: string[] = []
    const result = render(
      <Table<Person>
        data={many}
        getRowId={(row) => row.id}
        pagination={{ mode: "infinite", pageSize: 10 }}
        columns={[
          {
            key: "name",
            render: ({ row }) => {
              rendered.push(row.id)
              return row.name
            },
          },
        ]}
        {...extra}
      />,
    )
    return { rendered, ...result }
  }

  it("renders only the new rows, not the ones already on screen", () => {
    const { rendered, container } = countingTable()

    expect(container.querySelectorAll("tbody tr")).toHaveLength(10)
    expect(new Set(rendered).size).toBe(10)
    rendered.length = 0

    act(() => observed.at(-1)!.fire())

    expect(container.querySelectorAll("tbody tr")).toHaveLength(20)
    // Ten new rows, and not one of the first ten touched again.
    expect(rendered.sort()).toEqual(["10", "11", "12", "13", "14", "15", "16", "17", "18", "19"])
  })

  it("does not start re-rendering everything once a caller passes inline callbacks", () => {
    /*
      The failure this guards is silent. `onRowClick={() => …}` and
      `rowClassName={(row) => …}` are written inline at almost every call site,
      and a new function each render is enough on its own to invalidate every
      memoised row — the table still works, it is just quietly back to
      rebuilding itself. Nothing about the output would show it.
    */
    const { rendered, container } = countingTable({
      onRowClick: () => {},
      rowClassName: () => undefined,
      onStateChange: () => {},
    })

    rendered.length = 0
    act(() => observed.at(-1)!.fire())

    expect(container.querySelectorAll("tbody tr")).toHaveLength(20)
    expect(rendered).toHaveLength(10)
  })

  it("still re-renders a row whose class actually changed", () => {
    // The other half of the bargain: the memo compares the resolved class, so
    // a row that genuinely looks different is rebuilt.
    const { rerender, container } = render(
      <Table<Person>
        data={many.slice(0, 3)}
        getRowId={(row) => row.id}
        rowClassName={(row) => (row.id === "1" ? "warn" : undefined)}
      />,
    )

    expect(container.querySelectorAll("tbody tr")[1]?.className).toContain("warn")

    rerender(
      <Table<Person>
        data={many.slice(0, 3)}
        getRowId={(row) => row.id}
        rowClassName={(row) => (row.id === "2" ? "warn" : undefined)}
      />,
    )

    expect(container.querySelectorAll("tbody tr")[1]?.className).not.toContain("warn")
    expect(container.querySelectorAll("tbody tr")[2]?.className).toContain("warn")
  })

  it("toggles the right row on a page that arrived later", () => {
    /*
      The handler reads the ids on screen through a ref now, because depending
      on them directly would rebuild it on every append and hand every row a
      changed prop. A ref read at the wrong moment is the classic way to break
      this, and it breaks quietly: the click lands on a row, just not that one.
    */
    const { container } = render(
      <Table<Person>
        data={many}
        getRowId={(row) => row.id}
        selection="multiple"
        pagination={{ mode: "infinite", pageSize: 10 }}
      />,
    )

    act(() => observed.at(-1)!.fire())
    expect(container.querySelectorAll("tbody tr")).toHaveLength(20)

    const boxes = container.querySelectorAll<HTMLInputElement>("tbody .tpz-checkbox")
    act(() => boxes[15]!.click())

    const selected = [...container.querySelectorAll("tbody tr[data-selected]")]
    expect(selected).toHaveLength(1)
    expect(selected[0]?.textContent).toContain("Person 15")
  })

  it("selects every row loaded so far, not only the first page", () => {
    const { container } = render(
      <Table<Person>
        data={many}
        getRowId={(row) => row.id}
        selection="multiple"
        pagination={{ mode: "infinite", pageSize: 10 }}
      />,
    )

    act(() => observed.at(-1)!.fire())
    act(() => observed.at(-1)!.fire())
    expect(container.querySelectorAll("tbody tr")).toHaveLength(30)

    act(() => container.querySelector<HTMLInputElement>("thead .tpz-checkbox")!.click())
    expect(container.querySelectorAll("tbody tr[data-selected]")).toHaveLength(30)
  })
})

/**
 * Server rendering.
 *
 * The claim this feature is built on is that a row sizes itself with no
 * measuring pass — and the test of that claim is a server, which has no layout
 * to measure and must still produce the finished markup. Everything the mode
 * needs is decided from the props: an attribute on the root, a custom property
 * for the height, and the element that bounds a cell. Nothing waits for an
 * effect, so there is nothing for hydration to disagree with.
 */
describe("on a server", () => {
  const modes = [
    { name: "fixed", prop: "fixed" as const, attribute: null },
    { name: "auto", prop: "auto" as const, attribute: "auto" },
    { name: "a number", prop: 72, attribute: "exact" },
  ]

  it.each(modes)("renders $name completely in the markup", async ({ prop, attribute }) => {
    const { renderToString } = await import("react-dom/server")

    const html = renderToString(
      <Table
        data={notes}
        rowHeight={prop}
        columns={[{ key: "title", wrap: false }, { key: "body", wrap: 3 }]}
      />,
    )

    if (attribute === null) expect(html).not.toContain("data-row-height")
    else expect(html).toContain(`data-row-height="${attribute}"`)

    if (typeof prop === "number") expect(html).toContain(`--tpz-row-height:${String(prop)}px`)

    // The bounding element is in the markup, not added by an effect later.
    if (attribute === "exact") expect(html).toContain("tpz-fit")
    expect(html).toContain("tpz-clamp")
    expect(html).toContain('data-wrap="false"')
  })

  it.each(modes)("hydrates $name without a mismatch", async ({ prop }) => {
    const { renderToString } = await import("react-dom/server")
    const { hydrateRoot } = await import("react-dom/client")

    const element = (
      <Table
        data={notes}
        rowHeight={prop}
        selection
        columns={[{ key: "title", wrap: false }, { key: "body", wrap: 2 }]}
      />
    )

    const container = document.createElement("div")
    container.innerHTML = renderToString(element)
    document.body.append(container)

    /*
      `onRecoverableError` is where React reports a hydration mismatch — it
      patches the DOM up and carries on, so a test watching only `console.error`
      passes whether or not the markup agreed. Both are watched here; the
      callback is the one that means anything.
    */
    const recovered: string[] = []
    const errors: unknown[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args))

    await act(async () => {
      hydrateRoot(container, element, {
        onRecoverableError: (error) => recovered.push(String(error)),
      })
    })

    spy.mockRestore()
    container.remove()

    expect(recovered).toEqual([])
    expect(errors).toEqual([])
  })

  it("puts nothing in the markup that a browser has to correct", async () => {
    const { renderToString } = await import("react-dom/server")
    const html = renderToString(<Table data={notes} rowHeight={72} />)

    /*
      A measured value would have to arrive as a pixel offset on a cell, which
      is how the frozen columns work — they are the one thing here that does
      wait for layout, and they are absent until a caller pins something.
    */
    expect(html).not.toContain("data-pin")
    expect(html).not.toContain("ResizeObserver")
  })
})
