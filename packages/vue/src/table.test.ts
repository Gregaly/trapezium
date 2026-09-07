/**
 * @vitest-environment jsdom
 *
 * The Vue adapter's job is reactivity and lifecycle — the markup is the DOM
 * renderer's, and is tested there. So these tests check the seam: props reach
 * the table, changes flow through, VNode renderers mount as real components,
 * and nothing is left behind on unmount.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { createApp, defineComponent, h, nextTick, ref } from "vue"

import { Table } from "./table.js"

type Person = { id: string; name: string; plan: string }

const people: Person[] = [
  { id: "1", name: "Ada", plan: "pro" },
  { id: "2", name: "Tom", plan: "free" },
]

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
  document.querySelectorAll(".tpz-portal").forEach((node) => node.remove())
})

function mount(component: ReturnType<typeof defineComponent>) {
  const host = document.createElement("div")
  document.body.append(host)
  const app = createApp(component)
  app.mount(host)

  unmount = () => {
    app.unmount()
    host.remove()
  }

  return host
}

function rows(host: HTMLElement): string[][] {
  return [...host.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""),
  )
}

describe("rendering", () => {
  it("renders the table into the page", async () => {
    const host = mount(defineComponent(() => () => h(Table, { data: people })))
    await nextTick()

    expect(host.querySelector("table")).toBeTruthy()
    expect(rows(host)).toHaveLength(2)
  })

  it("takes columns as keys or definitions", async () => {
    const host = mount(
      defineComponent(() => () => h(Table, { data: people, columns: ["name", { key: "plan", header: "Tier" }] })),
    )
    await nextTick()

    const headers = [...host.querySelectorAll("th")].map((cell) => cell.textContent?.trim())
    expect(headers.some((header) => header?.includes("Tier"))).toBe(true)
  })
})

describe("reactivity", () => {
  it("follows the data", async () => {
    const data = ref<Person[]>(people)
    const host = mount(defineComponent(() => () => h(Table, { data: data.value })))
    await nextTick()

    data.value = [...people, { id: "3", name: "Zoe", plan: "pro" }]
    await nextTick()

    expect(rows(host)).toHaveLength(3)
  })

  it("keeps the arrangement when the data is replaced", async () => {
    const data = ref<Person[]>(people)
    const host = mount(defineComponent(() => () => h(Table, { data: data.value, columns: ["name"] })))
    await nextTick()

    host.querySelector<HTMLButtonElement>(".tpz-th-button")!.click()
    host.querySelector<HTMLButtonElement>(".tpz-th-button")!.click()
    expect(rows(host).map((row) => row[0])).toEqual(["Tom", "Ada"])

    data.value = [...people, { id: "3", name: "Zoe", plan: "pro" }]
    await nextTick()

    expect(rows(host).map((row) => row[0])).toEqual(["Zoe", "Tom", "Ada"])
  })

  it("emits state and selection changes", async () => {
    const onState = vi.fn()
    const onSelection = vi.fn()

    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: people,
          columns: ["name"],
          selection: "multiple",
          "onUpdate:state": onState,
          onSelectionChange: onSelection,
        }),
      ),
    )
    await nextTick()

    host.querySelector<HTMLButtonElement>(".tpz-th-button")!.click()
    expect(onState).toHaveBeenCalled()

    host.querySelectorAll<HTMLInputElement>("tbody .tpz-select-cell input")[0]!.click()
    expect(onSelection).toHaveBeenCalledWith(["1"], [people[0]])
  })
})

describe("custom cells", () => {
  it("mounts a VNode as a real component", async () => {
    const Chip = defineComponent({
      props: { label: { type: String, required: true } },
      render() {
        return h("strong", { class: "chip" }, this.label.toUpperCase())
      },
    })

    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: people,
          columns: [{ key: "name", render: ({ value }) => h(Chip, { label: String(value) }) }],
        }),
      ),
    )
    await nextTick()

    expect(host.querySelector(".chip")?.textContent).toBe("ADA")
  })

  it("keeps the components in rows that were already on screen when a page is appended", async () => {
    /*
      Vue mounts each custom cell into a container of its own, outside its own
      tree, and has to unmount them itself or a table that re-renders leaks a
      component every time. It used to do that before every render, which was
      safe while the DOM renderer rebuilt every row. It no longer does: an
      appended page leaves the rows above it alone, so tearing their components
      down would empty cells that are still on screen.

      The sequence below is what a server-side "load more" does — the page
      advances, the caller fetches, and the new rows arrive on the `data` prop
      with the old ones still in front of them.
    */
    const Chip = defineComponent({
      props: { label: { type: String, required: true } },
      render() {
        return h("strong", { class: "chip" }, this.label)
      },
    })

    const many = ref(Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: `P${index}` })))

    // Held still, the way an app that is not rebuilding its column definitions
    // on every render holds them — otherwise changing the data also looks like
    // changing the columns, and everything is rebuilt for a different reason.
    const columns = [{ key: "name", render: ({ value }: { value: unknown }) => h(Chip, { label: String(value) }) }]
    const pagination = { mode: "loadMore" as const, pageSize: 10 }
    const getRowId = (row: Record<string, unknown>) => String(row["id"])

    const host = mount(
      defineComponent(() => () => h(Table, { data: many.value, getRowId, pagination, columns })),
    )
    await nextTick()
    expect(host.querySelectorAll(".chip")).toHaveLength(10)

    host.querySelector<HTMLButtonElement>(".tpz-pagination button")!.click()
    await nextTick()
    expect(host.querySelectorAll(".chip")).toHaveLength(20)

    // The caller appending what they fetched, which is how append pagination
    // works once the rows are on a server.
    many.value = [
      ...many.value,
      ...Array.from({ length: 10 }, (_, index) => ({ id: String(100 + index), name: `Q${index}` })),
    ]
    await nextTick()

    // Still on screen, and still showing what their component rendered.
    const chips = [...host.querySelectorAll(".chip")]
    expect(chips).toHaveLength(20)
    expect(chips.map((chip) => chip.textContent)).toContain("P0")
    expect(chips.every((chip) => chip.textContent !== "")).toBe(true)
  })

  it("keeps the rows on screen while loading is toggled around an appended page", async () => {
    /*
      Every prop but `data` reaches the DOM renderer through `setOptions`, and
      the adapted columns used to be rebuilt on each call — new renderer
      functions every time, which looked like a new set of columns and threw
      every row away. A server-side "load more" toggles `loading` around each
      fetch, so that is the sequence checked here.
    */
    const Chip = defineComponent({
      props: { label: { type: String, required: true } },
      render() {
        return h("strong", { class: "chip" }, this.label)
      },
    })

    const many = ref(Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: `P${index}` })))
    const loading = ref(false)

    const columns = [{ key: "name", render: ({ value }: { value: unknown }) => h(Chip, { label: String(value) }) }]
    const pagination = { mode: "loadMore" as const, pageSize: 10 }
    const getRowId = (row: Record<string, unknown>) => String(row["id"])

    const host = mount(
      defineComponent(
        () => () => h(Table, { data: many.value, loading: loading.value, getRowId, pagination, columns }),
      ),
    )
    await nextTick()
    const first = [...host.querySelectorAll("tbody tr")]
    expect(first).toHaveLength(10)

    loading.value = true
    await nextTick()
    // By identity: `toEqual` on DOM nodes is `isEqualNode`, which a rebuilt row passes.
    expect([...host.querySelectorAll("tbody tr")].every((row, index) => row === first[index])).toBe(true)

    many.value = [
      ...many.value,
      ...Array.from({ length: 10 }, (_, index) => ({ id: String(100 + index), name: `Q${index}` })),
    ]
    loading.value = false
    await nextTick()
    host.querySelector<HTMLButtonElement>(".tpz-pagination button")!.click()
    await nextTick()

    const after = [...host.querySelectorAll("tbody tr")]
    expect(after).toHaveLength(20)
    expect(after.slice(0, 10).every((row, index) => row === first[index])).toBe(true)
    expect([...host.querySelectorAll(".chip")].map((chip) => chip.textContent)).toContain("Q9")
  })

  it("still accepts a plain string or DOM node", async () => {
    const host = mount(
      defineComponent(() => () =>
        h(Table, { data: people, columns: [{ key: "name", render: ({ value }) => `«${String(value)}»` }] }),
      ),
    )
    await nextTick()

    expect(host.textContent).toContain("«Ada»")
  })
})

describe("teardown", () => {
  it("removes the table when the component unmounts", async () => {
    const host = mount(defineComponent(() => () => h(Table, { data: people })))
    await nextTick()
    expect(host.querySelector(".tpz")).toBeTruthy()

    unmount?.()
    unmount = undefined

    expect(document.querySelector(".tpz-table")).toBeNull()
  })
})

describe("server-side data", () => {
  it("passes a server source through to the table", async () => {
    const distinct = vi.fn(() => Promise.resolve(["pro", "free", "enterprise"]))

    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: [people[0]!],
          total: 480,
          server: { distinct },
          columns: ["name", { key: "plan", filter: "set" }],
          pagination: { pageSize: 1 },
        }),
      ),
    )

    // The page holds one row and one plan; the filter must offer all three.
    host.querySelectorAll<HTMLButtonElement>(".tpz-th-menu")[1]!.click()
    const panel = document.querySelector<HTMLElement>(".tpz-portal")!
    expect(distinct).toHaveBeenCalledWith("plan", expect.objectContaining({ page: 1 }))

    await vi.waitFor(() => {
      const labels = [...panel.querySelectorAll(".tpz-filter-option-label")].map((node) => node.textContent)
      expect(labels).toEqual(["pro", "free", "enterprise"])
    })
  })
})

describe("props that change after the first render", () => {
  /** Every prop below is one a real app toggles while the table is on screen. */
  it("follows columns, pagination, search, selection and density", async () => {
    const columns = ref<(string | { key: string; header?: string })[]>(["name", "plan"])
    const pageSize = ref(1)
    const selection = ref<"multiple" | false>(false)
    const density = ref<"normal" | "compact">("normal")

    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: people,
          columns: columns.value,
          pagination: { pageSize: pageSize.value },
          selection: selection.value,
          density: density.value,
          search: true,
        }),
      ),
    )
    await nextTick()

    expect(rows(host)).toHaveLength(1)

    pageSize.value = 10
    await nextTick()
    expect(rows(host)).toHaveLength(2)

    columns.value = [{ key: "name", header: "Who" }]
    await nextTick()
    expect([...host.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim())).toEqual(["Who"])

    selection.value = "multiple"
    await nextTick()
    expect(host.querySelectorAll("tbody .tpz-select-cell input")).toHaveLength(2)

    density.value = "compact"
    await nextTick()
    expect(host.querySelector(".tpz")?.getAttribute("data-density")).toBe("compact")
  })

  it("searches, and keeps the query when the data underneath changes", async () => {
    const data = ref<Person[]>(people)
    const host = mount(
      defineComponent(() => () => h(Table, { data: data.value, columns: ["name"], search: { debounce: 0 } })),
    )
    await nextTick()

    const box = host.querySelector<HTMLInputElement>("input[type='search']")!
    box.value = "ada"
    box.dispatchEvent(new Event("input", { bubbles: true }))
    await vi.waitFor(() => expect(rows(host)).toHaveLength(1))

    data.value = [...people, { id: "3", name: "Adam", plan: "pro" }]
    await nextTick()

    // Still filtered, and the new row is judged by the same query.
    expect(rows(host).map((row) => row[0])).toEqual(["Ada", "Adam"])
  })

  it("takes a state prop as the source of truth", async () => {
    const state = ref<{ sort: { key: string; direction: "asc" | "desc" }[] }>({
      sort: [{ key: "name", direction: "desc" }],
    })
    const host = mount(
      defineComponent(() => () => h(Table, { data: people, columns: ["name"], state: state.value })),
    )
    await nextTick()
    expect(rows(host).map((row) => row[0])).toEqual(["Tom", "Ada"])

    state.value = { sort: [{ key: "name", direction: "asc" }] }
    await nextTick()
    expect(rows(host).map((row) => row[0])).toEqual(["Ada", "Tom"])
  })
})

describe("the row-height switch", () => {
  it("appears when asked and changes the rows", async () => {
    const host = mount(defineComponent(() => () => h(Table, { data: people, densityControl: true })))
    await nextTick()

    host.querySelector<HTMLButtonElement>('[aria-label="Row height"]')!.click()
    const items = [...document.querySelectorAll<HTMLElement>(".tpz-portal [data-menu-item]")]
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Compact", "Normal", "Relaxed"])

    items[2]!.click()
    expect(host.querySelector(".tpz")?.getAttribute("data-density")).toBe("relaxed")
  })
})

describe("selection options", () => {
  it("disables the rows that cannot be selected, and skips them from the header", async () => {
    const onSelection = vi.fn()
    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: people,
          columns: ["name"],
          selection: { isSelectable: (row: Person) => row.plan === "pro" },
          onSelectionChange: onSelection,
        }),
      ),
    )
    await nextTick()

    const boxes = [...host.querySelectorAll<HTMLInputElement>("tbody .tpz-select-cell input")]
    expect(boxes.map((box) => box.disabled)).toEqual([false, true])

    host.querySelector<HTMLInputElement>("thead .tpz-select-cell input")!.click()
    expect(onSelection).toHaveBeenCalledWith(["1"], [people[0]])
  })
})

describe("slots", () => {
  it("teleports the toolbar slot into the toolbar, and keeps it reactive", async () => {
    const count = ref(0)
    const host = mount(
      defineComponent(() => () =>
        h(Table, { data: people, search: true }, { toolbar: () => h("button", { class: "mine" }, `New (${String(count.value)})`) }),
      ),
    )
    await nextTick()

    const button = host.querySelector(".tpz-toolbar .mine")
    expect(button?.textContent).toBe("New (0)")

    count.value = 2
    await nextTick()
    expect(host.querySelector(".tpz-toolbar .mine")?.textContent).toBe("New (2)")
  })

  it("fills the append row, the footer and the empty state", async () => {
    const host = mount(
      defineComponent(() => () =>
        h(
          Table,
          { data: [] as Person[], columns: ["name"] },
          {
            appendRow: () => h("a", { href: "/new" }, "Add one"),
            footer: () => "2 people",
            empty: () => h("p", { class: "nothing" }, "No people yet"),
          },
        ),
      ),
    )
    await nextTick()

    expect(host.querySelector("tbody tr:last-child a")?.textContent).toBe("Add one")
    expect(host.querySelector(".tpz-footer")?.textContent).toBe("2 people")
    expect(host.querySelector("tbody .nothing")?.textContent).toBe("No people yet")
    expect(host.querySelector(".tpz-state")).toBeNull()
  })
})

describe("presentation props", () => {
  it("passes the class overrides and the caption through", async () => {
    const host = mount(
      defineComponent(() => () =>
        h(Table, { data: people, columns: ["name"], className: "mine", classNames: { row: "hover" }, caption: "People" }),
      ),
    )
    await nextTick()

    expect(host.querySelector(".tpz")?.className).toBe("tpz mine")
    expect(host.querySelector("tbody tr")?.className).toBe("tpz-tr hover")
    expect(host.querySelector("caption")?.textContent).toBe("People")
  })

  it("follows a prop that used to be set once, like maxHeight or export", async () => {
    const maxHeight = ref<number | undefined>(undefined)
    const exportOn = ref(false)
    const host = mount(
      defineComponent(() => () => h(Table, { data: people, maxHeight: maxHeight.value, export: exportOn.value })),
    )
    await nextTick()
    expect(host.querySelector('[aria-label="Export"]')).toBeNull()

    maxHeight.value = 300
    exportOn.value = true
    await nextTick()

    expect(host.querySelector<HTMLElement>(".tpz")?.style.getPropertyValue("--tpz-max-height")).toBe("300px")
    expect(host.querySelector('[aria-label="Export"]')).toBeTruthy()
  })
})
