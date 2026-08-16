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
