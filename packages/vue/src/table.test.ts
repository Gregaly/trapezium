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
