/**
 * @vitest-environment node
 *
 * The component on a server.
 *
 * Compiled for the server by running under Node rather than jsdom, and rendered
 * with Svelte's own `render`. What matters is that the table is in the markup
 * — rows, sorting and all — before any script runs.
 */
import { render } from "svelte/server"
import { describe, expect, it } from "vitest"

import Table from "./Table.svelte"

const people = [
  { id: "1", name: "Ada", plan: "pro" },
  { id: "2", name: "Tom", plan: "free" },
  { id: "3", name: "Zoe", plan: "pro" },
]

describe("server rendering", () => {
  it("writes the table into the markup, already sorted", () => {
    const { body } = render(Table, {
      props: {
        data: people,
        columns: ["name", "plan"],
        state: { sort: [{ key: "name", direction: "desc" }] },
        pagination: false,
      },
    })

    expect(body).toContain('<table class="tpz-table">')
    expect(body).toContain('aria-sort="descending"')
    const names = [...body.matchAll(/data-key="name" data-label="Name">([^<]+)</g)].map((match) => match[1])
    expect(names).toEqual(["Zoe", "Tom", "Ada"])
  })

  it("writes a cell whose renderer needs the DOM as its text", () => {
    const { body } = render(Table, {
      props: {
        data: people,
        columns: [
          {
            key: "name",
            render: ({ value }: { value: unknown }) => {
              const node = document.createElement("strong")
              node.textContent = String(value)
              return node
            },
          },
        ],
        pagination: false,
      },
    })

    expect(body).toContain(">Ada<")
    expect(body).not.toContain("<strong")
  })

  it("renders links for a table with URLs, so it works before the script arrives", () => {
    const { body } = render(Table, {
      props: {
        data: people,
        columns: ["name"],
        pagination: false,
        buildHref: (state: { sort: Array<{ key: string; direction: string }> }) =>
          `/people?sort=${state.sort.map((sort) => `${sort.key}:${sort.direction}`).join(",")}`,
      },
    })

    expect(body).toContain('<a href="/people?sort=name:asc" class="tpz-th-button" aria-label="Sort by Name">')
  })
})
