import { describe, expect, it } from "vitest"

import { createState } from "./state.js"
import {
  applyStateToUrl,
  pickUrlState,
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

describe("a table with its own defaults", () => {
  const options = { defaults: { pageSize: 15 } }

  it("reads a URL with no size as the table's size, not the library's", () => {
    expect(stateFromUrl("", options).pageSize).toBe(15)
    expect(stateFromUrl("?size=30", options).pageSize).toBe(30)
  })

  it("writes nothing for the resting size, and the size when it differs", () => {
    expect(stateToQueryString(createState({ pageSize: 15 }), options)).toBe("")
    expect(stateToQueryString(createState({ pageSize: 25 }), options)).toBe("size=25")
  })

  it("round-trips", () => {
    const state = createState({ pageSize: 15, page: 3, density: "compact" })
    expect(stateFromUrl(stateToQueryString(state, options), options)).toEqual(state)
  })
})

describe("pickUrlState", () => {
  const state = createState({
    sort: [{ key: "name", direction: "asc" }],
    page: 3,
    selection: ["a", "b"],
    widths: { name: 240 },
    hidden: ["notes"],
  })

  it("keeps what the URL carries and leaves out what it does not", () => {
    const picked = pickUrlState(state)

    expect(picked.sort).toEqual(state.sort)
    expect(picked.page).toBe(3)
    expect(picked.hidden).toEqual(["notes"])
    expect(picked).not.toHaveProperty("selection")
    expect(picked).not.toHaveProperty("widths")
  })

  it("controls every carried key, even one still at its default", () => {
    // Otherwise the back button could not undo a sort: the URL would lose the
    // parameter and the table would keep the order it had.
    expect(pickUrlState(createState())).toHaveProperty("sort", [])
    expect(pickUrlState(createState())).toHaveProperty("search", "")
  })

  it("follows the same include list as the codec", () => {
    const picked = pickUrlState(state, { include: ["selection", "page"] })
    expect(picked).toEqual({ selection: ["a", "b"], page: 3 })
  })
})
