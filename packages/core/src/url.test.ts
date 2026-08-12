import { describe, expect, it } from "vitest"

import { createState } from "./state.js"
import {
  applyStateToUrl,
  stateFromSearchParams,
  stateFromUrl,
  stateToQueryString,
  stateToSearchParams,
} from "./url.js"
import type { TableState } from "./types.js"

describe("stateToSearchParams", () => {
  it("writes nothing for a table nobody has touched", () => {
    expect(stateToQueryString(createState())).toBe("")
  })

  it("writes only what differs from the defaults", () => {
    const query = stateToQueryString(createState({ page: 3, search: "ada" }))
    expect(query).toBe("q=ada&page=3")
  })

  it("keeps a shared link readable", () => {
    const query = stateToQueryString(
      createState({
        sort: [{ key: "name", direction: "asc" }],
        filters: [{ key: "plan", operator: "eq", value: "pro" }],
      }),
    )
    expect(decodeURIComponent(query)).toBe("sort=name:asc&f=plan:eq:pro")
  })

  it("leaves selection and widths out unless asked", () => {
    const state = createState({ selection: ["1", "2"], widths: { name: 200 } })
    expect(stateToQueryString(state)).toBe("")
    expect(stateToQueryString(state, { include: ["selection", "widths"] })).toContain("sel=1%2C2")
  })

  it("prefixes every parameter, so two tables can share a page", () => {
    expect(stateToQueryString(createState({ page: 2 }), { prefix: "b_" })).toBe("b_page=2")
  })
})

describe("round trip", () => {
  const state: TableState = createState({
    sort: [
      { key: "name", direction: "desc" },
      { key: "age", direction: "asc" },
    ],
    filters: [
      { key: "plan", operator: "in", value: ["pro", "team"] },
      { key: "notes", operator: "notEmpty" },
    ],
    match: "any",
    search: "ada",
    page: 4,
    pageSize: 50,
    order: ["name", "age"],
    hidden: ["notes"],
    pinned: { name: "start", actions: "end" },
    density: "compact",
  })

  it("survives being written and read back", () => {
    const params = stateToSearchParams(state)
    expect(stateFromUrl(params)).toEqual(state)
  })

  it("survives values containing the separators", () => {
    const awkward = createState({
      filters: [{ key: "note", operator: "eq", value: "a:b~c,d e&f" }],
    })
    const back = stateFromUrl(stateToSearchParams(awkward))
    expect(back.filters[0]?.value).toBe("a:b~c,d e&f")
  })

  it("keeps a numeric-looking value as text, so a postcode survives", () => {
    const back = stateFromUrl("f=postcode:eq:0800")
    expect(back.filters[0]?.value).toBe("0800")
  })
})

describe("stateFromSearchParams", () => {
  it("accepts a query string, a URLSearchParams, or a plain object", () => {
    expect(stateFromSearchParams("page=2").page).toBe(2)
    expect(stateFromSearchParams(new URLSearchParams("page=2")).page).toBe(2)
    expect(stateFromSearchParams({ page: "2" }).page).toBe(2)
  })

  it("takes the last of a repeated parameter, like a browser does", () => {
    expect(stateFromSearchParams({ page: ["2", "5"] }).page).toBe(5)
  })

  it("drops anything malformed rather than throwing", () => {
    expect(stateFromSearchParams("page=banana").page).toBeUndefined()
    expect(stateFromSearchParams("page=-4").page).toBeUndefined()
    expect(stateFromSearchParams("d=enormous").density).toBeUndefined()
    expect(stateFromSearchParams("f=~~~").filters).toEqual([])
    expect(stateFromSearchParams("sort=:asc").sort).toEqual([])
  })

  it("reads a filter with no value as a presence check", () => {
    expect(stateFromSearchParams("f=notes:notEmpty").filters).toEqual([
      { key: "notes", operator: "notEmpty" },
    ])
  })
})

describe("applyStateToUrl", () => {
  it("leaves the page's own parameters alone", () => {
    const url = applyStateToUrl("/people?tab=archive", createState({ page: 2 }))
    expect(url).toBe("/people?tab=archive&page=2")
  })

  it("clears a parameter that has gone back to its default", () => {
    const url = applyStateToUrl("/people?tab=archive&page=2", createState({ page: 1 }))
    expect(url).toBe("/people?tab=archive")
  })
})
