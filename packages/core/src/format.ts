/**
 * Turning stored values into text.
 *
 * Pure, and separate from rendering, so every type's formatting can be tested
 * without a DOM — and so a cell, a CSV export, a search index and a tooltip all
 * produce the same string for the same value.
 *
 * Everything here goes through `Intl`, which every supported runtime has built
 * in. That is what keeps the core dependency-free while still formatting dates
 * and money correctly in a hundred locales.
 */

import type { FormatContext, FormatOptions, SelectOption } from "./types.js"
import { isEmpty } from "./util.js"

/** The defaults every table starts from, and which callers override at will. */
export const DEFAULT_FORMAT: FormatContext = {
  locale: "en",
  /*
    UTC rather than the runtime's zone, deliberately. A server in UTC and a
    browser in Sydney rendering the same timestamp differently is a hydration
    mismatch — and a silent, data-dependent one, which is the worst kind. A
    caller who knows their users' zone sets it; a caller who does not is at
    least consistent.
  */
  timeZone: "UTC",
  currency: "USD",
  currencyInMinorUnits: false,
  emptyText: "—",
}

/*
  `Intl` formatters are expensive to construct and cheap to reuse, and a table
  formats one per cell — tens of thousands of times on a large page. Caching
  them by their arguments is the single biggest performance decision in this
  file.
*/
const numberFormats = new Map<string, Intl.NumberFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>()

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options)
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, format)
  }
  return format
}

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options)
  let format = dateFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options)
    dateFormats.set(key, format)
  }
  return format
}

function relativeFormat(locale: string): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(locale)
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    relativeFormats.set(locale, format)
  }
  return format
}

/** Merges a column's overrides over the table's formatting. */
export function resolveFormat(base: FormatContext, options?: FormatOptions): FormatContext & FormatOptions {
  return options ? { ...base, ...options } : base
}

export function formatNumber(value: unknown, context: FormatContext & FormatOptions): string {
  const number = toNumber(value)
  if (number === undefined) return String(value)

  return numberFormat(context.locale, {
    minimumFractionDigits: context.decimals,
    maximumFractionDigits: context.decimals ?? 3,
  }).format(number)
}

export function formatPercent(value: unknown, context: FormatContext & FormatOptions): string {
  const number = toNumber(value)
  if (number === undefined) return String(value)

  /*
    The value is a percentage already — 12.5 means 12.5%, not 1250%. `Intl`'s
    percent style multiplies by 100, which is right for a ratio and wrong for
    what an API column called `discount_percent` actually holds. Formatting the
    number and appending the sign is the honest reading of the data.
  */
  return `${numberFormat(context.locale, {
    minimumFractionDigits: context.decimals,
    maximumFractionDigits: context.decimals ?? 2,
  }).format(number)}%`
}

/**
 * How many minor units make one major unit of a currency.
 *
 * Not always a hundred: yen and won have none, and dividing those by a hundred
 * shows every amount at a hundredth of its real value.
 */
export function minorUnitScale(currency: string, locale = "en"): number {
  try {
    const digits = numberFormat(locale, { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits
    return 10 ** (digits ?? 2)
  } catch {
    return 100
  }
}

export function formatCurrency(value: unknown, context: FormatContext & FormatOptions): string {
  const raw = toNumber(value)
  if (raw === undefined) return String(value)

  const amount = context.currencyInMinorUnits
    ? raw / minorUnitScale(context.currency, context.locale)
    : raw

  try {
    return numberFormat(context.locale, {
      style: "currency",
      currency: context.currency,
      minimumFractionDigits: context.decimals,
      maximumFractionDigits: context.decimals,
    }).format(amount)
  } catch {
    // An unknown currency code must not take the whole table down with it.
    return formatNumber(amount, context)
  }
}

/**
 * Parses whatever a row happens to hold into a `Date`.
 *
 * Dates arrive as `Date` objects, ISO strings, epoch milliseconds and epoch
 * seconds depending on where the data came from, and a table has no say in
 * which. Anything unparseable returns undefined rather than an Invalid Date,
 * so callers have one thing to check.
 */
export function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value

  if (typeof value === "number") {
    // Epoch seconds are indistinguishable from milliseconds except by
    // magnitude. Anything below ~1971 in milliseconds is far more likely to be
    // seconds, and every real timestamp in an application is after that.
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? undefined : date
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return undefined

    // A bare calendar day is a day, not an instant. `new Date("2026-08-13")`
    // parses as UTC midnight, which is what we want — but only because we then
    // render it in UTC too. Rendering it in a local zone is what shifts a
    // birthday to the day before for everyone west of Greenwich.
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? undefined : date
  }

  return undefined
}

/** True for a bare `YYYY-MM-DD`, which must be rendered as a day rather than an instant. */
export function isDateOnly(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

const DAY_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

/**
 * A calendar day.
 *
 * Always rendered in UTC, whatever the table's timezone, because a date has no
 * time and therefore no zone. Applying one moves it across midnight for half
 * the world.
 */
export function formatDate(value: unknown, context: FormatContext & FormatOptions): string {
  const date = toDate(value)
  if (!date) return String(value)

  return dateFormat(context.locale, {
    ...DAY_OPTIONS,
    ...context.dateOptions,
    timeZone: "UTC",
  }).format(date)
}

/** An instant, rendered in the table's timezone. */
export function formatDateTime(value: unknown, context: FormatContext & FormatOptions): string {
  const date = toDate(value)
  if (!date) return String(value)

  // A value with no time of day is a day, even in a datetime column.
  const options: Intl.DateTimeFormatOptions = isDateOnly(value)
    ? { ...DAY_OPTIONS, timeZone: "UTC" }
    : {
        ...DAY_OPTIONS,
        hour: "numeric",
        minute: "2-digit",
        timeZone: context.timeZone,
      }

  try {
    return dateFormat(context.locale, { ...options, ...context.dateOptions }).format(date)
  } catch {
    // An invalid IANA zone is a caller's typo, not a reason to render nothing.
    return dateFormat(context.locale, { ...options, timeZone: "UTC" }).format(date)
  }
}

/**
 * A time of day.
 *
 * Accepts `"14:30"` and `"14:30:00"` as well as a full timestamp, because a
 * time column is usually a `time` in the database and a string in the payload.
 */
export function formatTime(value: unknown, context: FormatContext & FormatOptions): string {
  if (typeof value === "string") {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value.trim())
    if (match) {
      const hours = Number(match[1])
      const minutes = Number(match[2])
      const date = new Date(Date.UTC(2000, 0, 1, hours, minutes))
      return dateFormat(context.locale, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        ...context.dateOptions,
      }).format(date)
    }
  }

  const date = toDate(value)
  if (!date) return String(value)

  return dateFormat(context.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: context.timeZone,
    ...context.dateOptions,
  }).format(date)
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
]

/**
 * "3 days ago", "in 2 months".
 *
 * `now` comes from the format context rather than the clock so the output is
 * deterministic in tests and identical on a server and a client rendering the
 * same page within the same second.
 */
export function formatRelativeTime(value: unknown, context: FormatContext & FormatOptions): string {
  const date = toDate(value)
  if (!date) return String(value)

  const now = context.now ?? new Date()
  const difference = date.getTime() - now.getTime()

  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(difference) >= size || unit === "second") {
      return relativeFormat(context.locale).format(Math.round(difference / size), unit)
    }
  }

  return relativeFormat(context.locale).format(0, "second")
}

/** The label for a stored option value. Never shows the raw key when a label exists. */
export function optionLabel(value: unknown, options: SelectOption[] | undefined): string {
  const text = String(value)
  const match = options?.find((option) => option.value === text)
  return match?.label ?? text
}

/**
 * Anything that is not a number returns undefined rather than `NaN`.
 *
 * Infinity is a number and is kept: it sorts at the extreme, compares the way
 * arithmetic says it should, and `Intl` renders it as "∞". Only `NaN` — which
 * is the absence of a number wearing a number's clothes — is refused.
 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isNaN(value) ? undefined : value
  if (typeof value === "boolean") return value ? 1 : 0

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return undefined
    // Strips grouping separators, currency symbols and stray spaces, so a
    // column of "$1,240.00" strings still sorts and filters numerically.
    const cleaned = trimmed.replace(/[^\d.\-+eE]/g, "")
    // Without this, "abc" cleans down to "" and `Number("")` is zero — a
    // column of text would sort as a column of zeroes and filter as one too.
    if (!/\d/.test(cleaned)) return undefined
    const parsed = Number(cleaned)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

/** A safe `String()` for values that may be objects, used as the last resort. */
export function toText(value: unknown, context: FormatContext): string {
  if (isEmpty(value)) return ""
  if (typeof value === "string") return value
  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? ""
    } catch {
      return String(value)
    }
  }
  return String(value)
}
