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

import { el } from "@trapezium/vanilla"

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

  it("renders a cell built with the el helper", () => {
    const { body } = render(Table, {
      props: {
        data: people,
        columns: [{ key: "name", render: ({ value }: { value: unknown }) => el("strong", { class: "loud", text: String(value) }) }],
        pagination: false,
      },
    })

    expect(body).toContain('<strong class="loud">Ada</strong>')
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

  it("writes a sort of several levels, its reset, and the header search", () => {
    const { body } = render(Table, {
      props: {
        data: people,
        columns: ["name", "plan"],
        pagination: false,
        headerSearch: true,
        buildHref: () => "/people",
        state: {
          sort: [
            { key: "plan", direction: "asc" },
            { key: "name", direction: "desc" },
          ],
          filters: [{ key: "name", operator: "contains", value: "o" }],
        },
      },
    })

    expect(body).toContain('<span class="tpz-th-order" aria-hidden="true">1</span>')
    expect(body).toContain('aria-label="Sort by Name, sort level 2"')
    expect(body).toContain('<a href="/people" class="tpz-btn tpz-btn-icon tpz-sort-reset" aria-label="Reset sort" title="Reset sort">')
    expect(body.match(/class="tpz-th-icon tpz-th-search"/g)).toHaveLength(2)
    expect(body).toContain('aria-label="Search Name, searching for o"')
    // The box is opened by a click, so a server never writes one.
    expect(body).not.toContain("tpz-th-searchbox")

    // "Tom" and "Zoe" say "o"; free sorts before pro.
    const names = [...body.matchAll(/data-key="name" data-label="Name">([^<]+)</g)].map((match) => match[1])
    expect(names).toEqual(["Tom", "Zoe"])
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

    expect(body).toContain('<a href="/people?sort=name:asc" class="tpz-th-button" aria-label="Sort by Name" draggable="false">')
  })
})
