/**
 * @vitest-environment jsdom
 *
 * Sorting by several columns and searching a column from its header, through
 * the Vue adapter.
 *
 * The behaviour is the DOM renderer's and is tested there. What Vue adds is a
 * parent that re-renders: a template writes its props inline, so every change
 * of state hands the table a fresh set of options. The search box has to come
 * through that with the person's typing intact, which is the test that matters
 * most here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createApp, createSSRApp, defineComponent, h, nextTick, ref } from "vue"
import { renderToString } from "vue/server-renderer"
import { applyStateToUrl, type PartialTableState, type TableState } from "@trapezium/core"

import { Table } from "./table.js"

type Person = { id: string; name: string; team: string; joined: string }

const staff: Person[] = [
  { id: "1", name: "Ada", team: "Eng", joined: "2024-03-01" },
  { id: "2", name: "Bea", team: "Ops", joined: "2023-06-15" },
  { id: "3", name: "Cy", team: "Eng", joined: "2022-01-10" },
  { id: "4", name: "Abe", team: "Ops", joined: "2024-03-22" },
]

let unmount: (() => void) | undefined

beforeEach(() => {
  // jsdom never reports its document as focused; a browser does.
  vi.spyOn(document, "hasFocus").mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
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

const names = (host: HTMLElement) =>
  [...host.querySelectorAll("tbody tr")].map((row) => row.querySelector("td")?.textContent?.trim() ?? "")

function header(host: HTMLElement, key: string): HTMLElement {
  const cell = host.querySelector<HTMLElement>(`thead th[data-key="${key}"]`)
  if (!cell) throw new Error(`no ${key} header`)
  return cell
}

function sortControl(host: HTMLElement, key: string): HTMLElement {
  const control = header(host, key).querySelector<HTMLElement>(".tpz-th-button")
  if (!control) throw new Error(`no sort control in ${key}`)
  return control
}

const click = (element: Element, init: MouseEventInit = {}) =>
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }))

function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

const columns = ["name", "team", { key: "joined", type: "date" }]

describe("sorting by several columns", () => {
  it("adds a level on a shift-click and reports the whole sort", async () => {
    const seen: TableState[] = []
    const host = mount(
      defineComponent(() => () =>
        h(Table, { data: staff, columns, pagination: false, "onUpdate:state": (state: TableState) => seen.push(state) }),
      ),
    )
    await nextTick()

    click(sortControl(host, "team"))
    click(sortControl(host, "name"), { shiftKey: true })

    expect(names(host)).toEqual(["Ada", "Cy", "Abe", "Bea"])
    expect(seen.at(-1)?.sort).toEqual([
      { key: "team", direction: "asc" },
      { key: "name", direction: "asc" },
    ])
    expect(header(host, "name").querySelector(".tpz-th-order")?.textContent).toBe("2")
  })

  it("takes the options as an object, where the prop used to be a switch", async () => {
    const host = mount(
      defineComponent(() => () => h(Table, { data: staff, columns, pagination: false, sortable: { multiple: false } })),
    )
    await nextTick()

    click(sortControl(host, "team"))
    click(sortControl(host, "name"), { shiftKey: true })

    expect(header(host, "team").getAttribute("aria-sort")).toBe("none")
    expect(header(host, "name").getAttribute("aria-sort")).toBe("ascending")
  })

  it("is still a switch: a bare attribute is on, and false is off", async () => {
    const off = mount(defineComponent(() => () => h(Table, { data: staff, columns, sortable: false })))
    await nextTick()
    expect(off.querySelector("button.tpz-th-button")).toBeNull()
    unmount?.()

    // What `<TrapeziumTable sortable />` compiles to.
    const on = mount(defineComponent(() => () => h(Table, { data: staff, columns, sortable: "" as unknown as boolean })))
    await nextTick()
    expect(on.querySelector("button.tpz-th-button")).not.toBeNull()
  })

  it("resets through v-model, with the parent holding the state", async () => {
    const state = ref<PartialTableState>({ sort: [{ key: "name", direction: "desc" }] })

    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: staff,
          columns,
          // Written inline, as a template writes them: a new object every render.
          pagination: { pageSize: 10 },
          state: state.value,
          "onUpdate:state": (next: TableState) => {
            state.value = next
          },
        }),
      ),
    )
    await nextTick()

    expect(names(host)).toEqual(["Cy", "Bea", "Ada", "Abe"])
    const reset = host.querySelector<HTMLElement>(".tpz-sort-reset")
    expect(reset).not.toBeNull()

    reset?.click()
    await nextTick()

    expect(names(host)).toEqual(["Ada", "Bea", "Cy", "Abe"])
    expect(state.value.sort).toEqual([])
    expect(host.querySelector(".tpz-sort-reset")).toBeNull()
  })

  it("follows a resting sort given as a prop", async () => {
    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: staff,
          columns,
          pagination: false,
          sortable: { reset: [{ key: "name", direction: "asc" }] },
          defaultState: { sort: [{ key: "name", direction: "asc" }] },
        }),
      ),
    )
    await nextTick()
    expect(host.querySelector(".tpz-sort-reset")).toBeNull()

    click(sortControl(host, "team"))
    host.querySelector<HTMLElement>(".tpz-sort-reset")?.click()

    expect(header(host, "name").getAttribute("aria-sort")).toBe("ascending")
    expect(header(host, "team").getAttribute("aria-sort")).toBe("none")
  })
})

describe("searching a column from its header", () => {
  it("is off until the prop asks for it, on for the table, or on for one column", async () => {
    const plain = mount(defineComponent(() => () => h(Table, { data: staff, columns })))
    await nextTick()
    expect(plain.querySelector(".tpz-th-search")).toBeNull()
    unmount?.()

    const all = mount(defineComponent(() => () => h(Table, { data: staff, columns, headerSearch: true })))
    await nextTick()
    expect(all.querySelectorAll(".tpz-th-search")).toHaveLength(3)
    unmount?.()

    const one = mount(
      defineComponent(() => () => h(Table, { data: staff, columns: [{ key: "name", headerSearch: true }, "team"] })),
    )
    await nextTick()
    expect(one.querySelectorAll(".tpz-th-search")).toHaveLength(1)
  })

  it("follows the prop being switched on later", async () => {
    const on = ref(false)
    const host = mount(defineComponent(() => () => h(Table, { data: staff, columns, headerSearch: on.value })))
    await nextTick()
    expect(host.querySelector(".tpz-th-search")).toBeNull()

    on.value = true
    await nextTick()
    expect(host.querySelectorAll(".tpz-th-search")).toHaveLength(3)
  })

  it("filters, and tells the parent, with the wait it was given", async () => {
    vi.useFakeTimers()
    const seen: TableState[] = []
    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: staff,
          columns,
          pagination: false,
          headerSearch: { debounce: 300 },
          "onUpdate:state": (state: TableState) => seen.push(state),
        }),
      ),
    )
    await nextTick()

    header(host, "joined").querySelector<HTMLElement>(".tpz-th-search")?.click()
    const input = header(host, "joined").querySelector<HTMLInputElement>(".tpz-th-search-input")
    if (!input) throw new Error("the box did not open")

    type(input, "mar")
    vi.advanceTimersByTime(299)
    expect(seen).toHaveLength(0)
    vi.advanceTimersByTime(2)

    expect(seen.at(-1)?.filters).toEqual([{ key: "joined", operator: "contains", value: "mar" }])
    expect(names(host)).toEqual(["Ada", "Abe"])
  })

  it("keeps the box, its text and its focus while the parent re-renders around it", async () => {
    vi.useFakeTimers()
    const state = ref<PartialTableState>({})

    const host = mount(
      defineComponent(() => () => {
        return h(Table, {
          data: staff,
          // Every one of these is a new object on every render of the parent,
          // which is what a template with inline props hands over.
          columns: [{ key: "name" }, { key: "team" }, { key: "joined", type: "date" }],
          pagination: { pageSize: 10 },
          headerSearch: { debounce: 50 },
          classNames: { cell: "roomy" },
          state: state.value,
          "onUpdate:state": (next: TableState) => {
            state.value = next
          },
        })
      }),
    )
    await nextTick()

    header(host, "name").querySelector<HTMLElement>(".tpz-th-search")?.click()
    const input = header(host, "name").querySelector<HTMLInputElement>(".tpz-th-search-input")
    if (!input) throw new Error("the box did not open")

    // Three keystrokes, each one applied and each one re-rendering the parent.
    for (const text of ["a", "ad", "ada"]) {
      type(input, text)
      vi.advanceTimersByTime(60)
      await nextTick()
      await nextTick()

      expect(header(host, "name").querySelector(".tpz-th-search-input"), `after "${text}"`).toBe(input)
      expect(document.activeElement, `after "${text}"`).toBe(input)
      expect(input.value).toBe(text)
    }

    expect(names(host)).toEqual(["Ada"])
    expect(state.value.filters).toEqual([{ key: "name", operator: "contains", value: "ada" }])
    expect(host.querySelectorAll(".tpz-th-searchbox")).toHaveLength(1)
  })

  it("keeps a component in a cell alive across a search", async () => {
    const Chip = defineComponent({
      props: { label: { type: String, required: true } },
      render() {
        return h("strong", { class: "chip" }, this.label)
      },
    })

    vi.useFakeTimers()
    const host = mount(
      defineComponent(() => () =>
        h(Table, {
          data: staff,
          pagination: false,
          headerSearch: { debounce: 0 },
          columns: [{ key: "name", render: ({ value }) => h(Chip, { label: String(value) }) }, "team"],
        }),
      ),
    )
    await nextTick()
    expect(host.querySelectorAll(".chip")).toHaveLength(4)

    header(host, "team").querySelector<HTMLElement>(".tpz-th-search")?.click()
    const input = header(host, "team").querySelector<HTMLInputElement>(".tpz-th-search-input")
    if (!input) throw new Error("the box did not open")
    type(input, "eng")
    vi.runAllTimers()
    await nextTick()

    expect([...host.querySelectorAll(".chip")].map((chip) => chip.textContent)).toEqual(["Ada", "Cy"])
  })
})

describe("on a server", () => {
  const page = () =>
    defineComponent(() => () =>
      h(Table, {
        data: staff,
        columns,
        pagination: false,
        headerSearch: true,
        search: true,
        buildHref: (state: TableState) => applyStateToUrl("/staff", state),
        state: {
          sort: [
            { key: "team", direction: "asc" },
            { key: "name", direction: "desc" },
          ],
          filters: [{ key: "joined", operator: "contains", value: "2024" }],
        },
      }),
    )

  it("writes the levels, the reset, the magnifiers and the searched rows", async () => {
    const html = await renderToString(createSSRApp(page()))

    expect(html).toContain('<span class="tpz-th-order" aria-hidden="true">1</span>')
    expect(html).toContain('aria-label="Sort by Name, sort level 2"')
    expect(html).toContain('class="tpz-btn tpz-btn-icon tpz-sort-reset"')
    expect(html.match(/class="tpz-th-icon tpz-th-search"/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Search Joined, searching for 2024"')
    expect(html).not.toContain("tpz-th-searchbox")

    const rendered = [...html.matchAll(/data-key="name" data-label="Name">([^<]+)</g)].map((match) => match[1])
    expect(rendered).toEqual(["Ada", "Abe"])
  })

  it("hydrates without a mismatch and hands over to a table that still works", async () => {
    const html = await renderToString(createSSRApp(page()))

    const host = document.createElement("div")
    host.innerHTML = html
    document.body.append(host)

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    const app = createSSRApp(page())
    app.mount(host)
    unmount = () => {
      app.unmount()
      host.remove()
    }

    const complaints = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]))
    warn.mockRestore()
    error.mockRestore()
    expect(complaints.filter((message) => /hydrat|mismatch/i.test(message))).toEqual([])

    expect(host.querySelectorAll(".tpz")).toHaveLength(1)
    expect(host.querySelectorAll(".tpz-sort-reset")).toHaveLength(1)

    // Alive: the magnifier opens a box.
    header(host, "name").querySelector<HTMLElement>(".tpz-th-search")?.click()
    expect(header(host, "name").querySelector(".tpz-th-search-input")).not.toBeNull()
  })
})
