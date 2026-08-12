import { describe, expect, it } from "vitest"

import {
  DEFAULT_FORMAT,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  minorUnitScale,
  toDate,
  toNumber,
} from "./format.js"

const context = DEFAULT_FORMAT

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(1234567, context)).toBe("1,234,567")
  })

  it("honours a fixed number of decimals", () => {
    expect(formatNumber(1.5, { ...context, decimals: 2 })).toBe("1.50")
  })

  it("leaves a value it cannot read alone rather than showing NaN", () => {
    expect(formatNumber("not a number", context)).toBe("not a number")
  })
})

describe("formatCurrency", () => {
  it("uses the context currency", () => {
    expect(formatCurrency(1240.5, { ...context, currency: "USD" })).toBe("$1,240.50")
  })

  it("reads minor units when told to", () => {
    expect(formatCurrency(124050, { ...context, currency: "USD", currencyInMinorUnits: true })).toBe(
      "$1,240.50",
    )
  })

  it("knows currencies with no minor unit", () => {
    expect(minorUnitScale("JPY")).toBe(1)
    expect(formatCurrency(1240, { ...context, currency: "JPY", currencyInMinorUnits: true })).toBe(
      "¥1,240",
    )
  })

  it("falls back to a plain number for an unknown code", () => {
    expect(formatCurrency(10, { ...context, currency: "NOTACURRENCY" })).toBe("10")
  })
})

describe("formatPercent", () => {
  it("treats the value as a percentage, not a ratio", () => {
    expect(formatPercent(12.5, context)).toBe("12.5%")
  })
})

describe("formatDate", () => {
  it("renders a calendar day in UTC whatever the table timezone", () => {
    // The bug this guards: rendering a bare date in a western timezone shows
    // the day before.
    expect(formatDate("2026-08-13", { ...context, timeZone: "America/Los_Angeles" })).toBe(
      "Aug 13, 2026",
    )
  })

  it("accepts a Date", () => {
    expect(formatDate(new Date(Date.UTC(2026, 7, 13)), context)).toBe("Aug 13, 2026")
  })
})

describe("formatDateTime", () => {
  it("renders an instant in the table timezone", () => {
    expect(formatDateTime("2026-08-13T22:30:00Z", { ...context, timeZone: "Australia/Sydney" })).toBe(
      "Aug 14, 2026, 8:30 AM",
    )
  })

  it("renders a bare date as a day, with no invented midnight", () => {
    expect(formatDateTime("2026-08-13", context)).toBe("Aug 13, 2026")
  })

  it("survives an invalid timezone", () => {
    expect(formatDateTime("2026-08-13T00:00:00Z", { ...context, timeZone: "Nowhere/Nothing" })).toBe(
      "Aug 13, 2026, 12:00 AM",
    )
  })
})

describe("formatTime", () => {
  it("reads a bare clock time", () => {
    expect(formatTime("14:05", context)).toBe("2:05 PM")
  })

  it("reads one with seconds", () => {
    expect(formatTime("09:30:00", context)).toBe("9:30 AM")
  })
})

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-13T12:00:00Z")

  it("counts backwards", () => {
    expect(formatRelativeTime("2026-08-10T12:00:00Z", { ...context, now })).toBe("3 days ago")
  })

  it("counts forwards", () => {
    expect(formatRelativeTime("2026-10-13T12:00:00Z", { ...context, now })).toBe("in 2 months")
  })

  it("says yesterday rather than one day ago", () => {
    expect(formatRelativeTime("2026-08-12T12:00:00Z", { ...context, now })).toBe("yesterday")
  })
})

describe("toDate", () => {
  it("reads epoch seconds and milliseconds apart", () => {
    expect(toDate(1_755_000_000)?.getUTCFullYear()).toBe(2025)
    expect(toDate(1_755_000_000_000)?.getUTCFullYear()).toBe(2025)
  })

  it("returns undefined rather than an Invalid Date", () => {
    expect(toDate("banana")).toBeUndefined()
    expect(toDate("")).toBeUndefined()
    expect(toDate(null)).toBeUndefined()
  })
})

describe("toNumber", () => {
  it("reads numbers out of formatted strings", () => {
    expect(toNumber("$1,240.50")).toBe(1240.5)
  })

  it("refuses text", () => {
    expect(toNumber("abc")).toBeUndefined()
  })

  it("keeps zero", () => {
    expect(toNumber(0)).toBe(0)
  })
})
