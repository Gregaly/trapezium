import { describe, expect, it } from "vitest"

import { HEADER_SEARCH_DEBOUNCE, resolveHeaderSearch } from "./header-search.js"

describe("resolveHeaderSearch", () => {
  it("is off unless asked for", () => {
    expect(resolveHeaderSearch(undefined).enabled).toBe(false)
    expect(resolveHeaderSearch(false).enabled).toBe(false)
  })

  it("is on for true, and for the options", () => {
    expect(resolveHeaderSearch(true).enabled).toBe(true)
    expect(resolveHeaderSearch({}).enabled).toBe(true)
  })

  it("always decides the pause, because a column can opt in by itself", () => {
    expect(resolveHeaderSearch(undefined).debounce).toBe(HEADER_SEARCH_DEBOUNCE)
    expect(resolveHeaderSearch(true).debounce).toBe(HEADER_SEARCH_DEBOUNCE)
    expect(resolveHeaderSearch({ debounce: 400 }).debounce).toBe(400)
    expect(resolveHeaderSearch({ debounce: 0 }).debounce).toBe(0)
  })
})
