/**
 * @vitest-environment jsdom
 *
 * The table on a server, then in a browser.
 *
 * Rendered to a string with Vue's server renderer, hydrated with `createSSRApp`
 * over that string, and checked at every step: the rows are in the server
 * markup, Vue reports no mismatch, and the live table takes over without a
 * second copy appearing.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSSRApp, defineComponent, h, nextTick } from "vue"
import { renderToString } from "vue/server-renderer"

import { Table } from "./table.js"

type Person = { id: string; name: string; plan: string }

const people: Person[] = [
  { id: "1", name: "Ada", plan: "pro" },
  { id: "2", name: "Tom", plan: "free" },
  { id: "3", name: "Zoe", plan: "pro" },
]

const app = () =>
  defineComponent(() => () =>
    h(Table, {
      data: people,
      columns: ["name", "plan"],
      state: { sort: [{ key: "name", direction: "desc" }] },
      pagination: false,
    }),
  )

let mounted: { unmount(): void } | undefined
let host: HTMLElement | undefined

afterEach(() => {
  mounted?.unmount()
  host?.remove()
  mounted = undefined
  host = undefined
})

describe("server rendering", () => {
  it("writes the table into the server markup, already sorted", async () => {
    const html = await renderToString(createSSRApp(app()))

    expect(html).toContain('<table class="tpz-table">')
    expect(html).toContain('aria-sort="descending"')
    const names = [...html.matchAll(/data-key="name" data-label="Name">([^<]+)</g)].map((match) => match[1])
    expect(names).toEqual(["Zoe", "Tom", "Ada"])
  })

  it("hydrates without a mismatch and hands over to the live table", async () => {
    const html = await renderToString(createSSRApp(app()))

    host = document.createElement("div")
    host.innerHTML = html
    document.body.append(host)

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    const vue = createSSRApp(app())
    vue.mount(host)
    mounted = vue

    const complaints = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]))
    warn.mockRestore()
    error.mockRestore()
    expect(complaints.filter((message) => /hydrat|mismatch/i.test(message))).toEqual([])

    // One table, and it is alive: the header sorts.
    expect(host.querySelectorAll(".tpz")).toHaveLength(1)
    host.querySelector<HTMLButtonElement>(".tpz-th-button")!.click()
    const names = [...host.querySelectorAll('td[data-key="name"]')].map((cell) => cell.textContent)
    expect(names).toEqual(["Ada", "Tom", "Zoe"])
  })

  it("renders a template slot and a component cell on the server", async () => {
    const Chip = defineComponent({
      props: { label: { type: String, required: true } },
      render() {
        return h("strong", { class: "chip" }, this.label.toUpperCase())
      },
    })
    const page = defineComponent(() => () =>
      h(
        Table,
        {
          data: people,
          columns: [{ key: "name", render: ({ value }) => h(Chip, { label: String(value) }) }],
          pagination: false,
        },
        { toolbar: () => h("button", { class: "new" }, "New person"), footer: () => "3 people" },
      ),
    )

    const html = await renderToString(createSSRApp(page))
    expect(html).toContain('<strong class="chip">ADA</strong>')
    expect(html).toContain('<button class="new">New person</button>')
    expect(html).toContain('class="tpz-footer"')
    expect(html).toContain(">3 people<")

    host = document.createElement("div")
    host.innerHTML = html
    document.body.append(host)

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const vue = createSSRApp(page)
    vue.mount(host)
    mounted = vue
    const complaints = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]))
    warn.mockRestore()
    error.mockRestore()
    expect(complaints.filter((message) => /hydrat|mismatch/i.test(message))).toEqual([])

    // The slots are teleported in on the render after mount.
    await nextTick()

    // The live table has them too, once, and the first-paint copies are gone.
    expect(host.querySelectorAll(".chip")).toHaveLength(3)
    expect(host.querySelectorAll(".new")).toHaveLength(1)
    expect(host.querySelector(".tpz-footer")?.textContent).toBe("3 people")
  })

  it("hands a component cell over to the live table without leaving a copy behind", async () => {
    const Chip = defineComponent({
      props: { label: { type: String, required: true } },
      render() {
        return h("strong", { class: "chip" }, this.label.toUpperCase())
      },
    })
    const withChip = defineComponent(() => () =>
      h(Table, {
        data: people,
        columns: [{ key: "name", render: ({ value }) => h(Chip, { label: String(value) }) }],
        pagination: false,
      }),
    )

    const html = await renderToString(createSSRApp(withChip))
    expect(html).toContain('<strong class="chip">ADA</strong>')

    host = document.createElement("div")
    host.innerHTML = html
    document.body.append(host)
    const vue = createSSRApp(withChip)
    vue.mount(host)
    mounted = vue

    expect(host.querySelector(".chip")?.textContent).toBe("ADA")
  })
})
