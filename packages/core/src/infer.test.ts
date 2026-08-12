import { describe, expect, it } from "vitest"

import { distinctValues, inferColumns, inferType } from "./infer.js"

describe("inferType", () => {
  it("reads booleans, numbers and arrays from their values", () => {
    expect(inferType("active", [true, false])).toBe("boolean")
    expect(inferType("count", [1, 2, 3])).toBe("number")
    expect(inferType("labels", [["a"], ["b", "c"]])).toBe("tags")
  })

  it("reads the shapes dates arrive in", () => {
    expect(inferType("birthday", ["2026-08-13"])).toBe("date")
    expect(inferType("seen", ["2026-08-13T10:00:00Z"])).toBe("datetime")
    expect(inferType("starts", ["09:30"])).toBe("time")
    expect(inferType("when", [new Date()])).toBe("datetime")
  })

  it("recognises the string types worth their own rendering", () => {
    expect(inferType("contact", ["a@b.com"])).toBe("email")
    expect(inferType("site", ["https://example.com"])).toBe("url")
    expect(inferType("reference", ["3f0d2b2e-8a1f-4a2b-9c3d-0e1f2a3b4c5d"])).toBe("id")
  })

  it("takes the key's word for it where the name is unambiguous", () => {
    expect(inferType("email_address", ["anything"])).toBe("email")
    expect(inferType("owner_id", ["17"])).toBe("id")
    expect(inferType("status", ["whatever"])).toBe("badge")
    expect(inferType("avatar_url", ["https://example.com/a.png"])).toBe("image")
  })

  it("refuses a key hint the data contradicts", () => {
    // A column called `image` holding numbers is a coincidence of naming, and
    // rendering it as an image would show broken pictures.
    expect(inferType("image", [1, 2, 3])).toBe("number")
    expect(inferType("total_cents", ["not a number"])).toBe("text")
  })

  it("only treats money as money where the unit is stated", () => {
    expect(inferType("total_cents", [1250])).toBe("currency")
    expect(inferType("amount", [1250])).toBe("number")
  })

  it("gives prose its own type", () => {
    expect(inferType("summary", ["x".repeat(200)])).toBe("longText")
  })

  it("treats a short, repetitive string column as a category", () => {
    const values = Array.from({ length: 30 }, (_, index) => (index % 3 === 0 ? "active" : "paused"))
    expect(inferType("plan", values)).toBe("badge")
  })

  it("does not call a handful of names a category", () => {
    expect(inferType("name", ["Ada", "Tom", "Jo"])).toBe("text")
  })

  it("falls back to text for empty, mixed or unreadable columns", () => {
    expect(inferType("whatever", [null, undefined, ""])).toBe("text")
    expect(inferType("mixed", [1, "two", true])).toBe("text")
  })

  it("reads objects as structured values", () => {
    expect(inferType("home", [{ line1: "1 Test St", city: "Sydney" }])).toBe("address")
    expect(inferType("payload", [{ anything: 1 }])).toBe("json")
  })
})

describe("inferColumns", () => {
  const rows = [
    { id: "1", name: "Ada", email: "ada@example.com", _internal: "hidden" },
    { id: "2", name: "Tom", email: "tom@example.com", extra: 3 },
  ]

  it("builds a column per key, in the data's own order", () => {
    expect(inferColumns(rows).map((column) => column.key)).toEqual(["id", "name", "email", "extra"])
  })

  it("skips underscore-prefixed keys", () => {
    expect(inferColumns(rows).some((column) => column.key === "_internal")).toBe(false)
  })

  it("takes keys from every sampled row, not just the first", () => {
    expect(inferColumns(rows).some((column) => column.key === "extra")).toBe(true)
  })

  it("honours an explicit include list, in that order", () => {
    expect(inferColumns(rows, { include: ["email", "name"] }).map((column) => column.key)).toEqual([
      "email",
      "name",
    ])
  })
})

describe("distinctValues", () => {
  it("orders by how often a value appears", () => {
    const values = ["a", "b", "a", "c", "a", "b"]
    expect(distinctValues(values).map((entry) => entry.value)).toEqual(["a", "b", "c"])
  })

  it("counts each member of a tags column separately", () => {
    expect(distinctValues([["x", "y"], ["x"]])).toEqual([
      { value: "x", count: 2 },
      { value: "y", count: 1 },
    ])
  })

  it("ignores empties", () => {
    expect(distinctValues([null, "", undefined, "a"])).toEqual([{ value: "a", count: 1 }])
  })
})

describe("key hints that look like other words", () => {
  it("does not read every word ending in id as an identifier", () => {
    // `/Id$/i` matches paid, valid, void and grid — which turned a column of
    // booleans into monospaced "true"/"false" text.
    expect(inferType("paid", [true, false])).toBe("boolean")
    expect(inferType("valid", [true])).toBe("boolean")
    expect(inferType("grid_size", [3])).toBe("number")
  })

  it("still reads a real id key", () => {
    expect(inferType("id", ["abc"])).toBe("id")
    expect(inferType("customerId", ["abc"])).toBe("id")
    expect(inferType("customer_id", ["abc"])).toBe("id")
  })
})
