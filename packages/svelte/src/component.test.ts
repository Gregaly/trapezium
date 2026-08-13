/**
 * @vitest-environment jsdom
 *
 * The component is a wrapper around the action, but it is what people actually
 * import — so it gets its own test, mounted the way Svelte 5 mounts things.
 */
import { afterEach, describe, expect, it } from "vitest"
import { flushSync, mount, unmount } from "svelte"

import Table from "./Table.svelte"

const people = [
  { id: "1", name: "Ada", plan: "pro" },
  { id: "2", name: "Tom", plan: "free" },
]

let host: HTMLElement | undefined
let instance: Record<string, unknown> | undefined

afterEach(() => {
  if (instance) void unmount(instance)
  host?.remove()
  instance = undefined
  host = undefined
})

function render(props: Record<string, unknown>) {
  host = document.createElement("div")
  document.body.append(host)
  /*
    Svelte 5 runs effects — and therefore actions — in a microtask, so the
    table does not exist on the line after `mount`. Tests flush deliberately
    rather than waiting on a timer.
  */
  flushSync(() => {
    instance = mount(Table, { target: host!, props }) as Record<string, unknown>
  })
  return host
}

describe("<Table>", () => {
  it("renders the table", () => {
    const node = render({ data: people })

    expect(node.querySelector("table")).toBeTruthy()
    expect(node.querySelectorAll("tbody tr")).toHaveLength(2)
  })

  it("passes its props through", () => {
    const node = render({ data: people, columns: ["name"], search: true })

    expect(node.querySelectorAll("thead th")).toHaveLength(1)
    expect(node.querySelector("input[type=search]")).toBeTruthy()
  })

  it("takes the table apart when it unmounts", () => {
    const node = render({ data: people })
    if (instance) flushSync(() => void unmount(instance!))
    instance = undefined

    expect(node.querySelector(".tpz")).toBeNull()
  })
})
