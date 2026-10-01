/**
 * The text a cell shows, remembered per row.
 *
 * Search and the text filters both compare against what is on the screen as
 * well as what is underneath, which means formatting every date, every amount
 * and every duration — and `Intl` formatting costs roughly a microsecond a
 * cell. Over ten thousand rows and a handful of formatted columns that is a
 * fifth of a second on every keystroke.
 *
 * So it is remembered against the row object itself. Filtering and sorting hand
 * back the same objects, and an application replacing its data replaces those
 * objects — so the cache is invalidated by exactly the thing that should
 * invalidate it, and holds nothing alive that the caller has let go of.
 *
 * One cache for both, because a table searched from its toolbar and from a
 * column header is asking for the same strings twice.
 */

import type { TypeDef } from "./registry.js"
import type { FormatContext, FormatOptions } from "./types.js"

const shownText = new WeakMap<object, Map<string, string>>()

/** The formatted text for one cell, computed the first time it is asked for. */
export function cachedText(
  row: object,
  cacheKey: string,
  type: TypeDef,
  value: unknown,
  context: FormatContext & FormatOptions,
): string {
  let perRow = shownText.get(row)
  if (!perRow) {
    perRow = new Map()
    shownText.set(row, perRow)
  }

  const remembered = perRow.get(cacheKey)
  if (remembered !== undefined) return remembered

  const text = type.format ? type.format(value, context) : ""
  perRow.set(cacheKey, text)
  return text
}

/**
 * Names the column and the formatting that produced a cached string.
 *
 * Two tables over the same rows in different currencies must not read each
 * other's cache, and neither must one table before and after its locale changes.
 */
export function textCacheKey(columnKey: string, type: TypeDef, context: FormatContext & FormatOptions): string {
  return `${columnKey}|${type.name}|${formatSignature(context)}`
}

function formatSignature(context: FormatContext & FormatOptions): string {
  return [
    context.locale,
    context.timeZone,
    context.currency,
    context.currencyInMinorUnits ? "1" : "0",
    context.decimals ?? "",
    // `now` moves, and a relative time formatted an hour ago reads differently
    // — but only to the minute, which is close enough to key on.
    context.now ? Math.floor(context.now.getTime() / 60_000) : "",
    context.options ? context.options.map((option) => `${option.value}=${option.label ?? ""}`).join(",") : "",
    context.dateOptions ? JSON.stringify(context.dateOptions) : "",
  ].join("|")
}
