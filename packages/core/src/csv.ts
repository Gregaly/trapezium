/**
 * Getting data out.
 *
 * Exports what the user is actually looking at — current filters, current sort,
 * current column order and visibility — because an export that quietly returns
 * something else is worse than no export at all.
 */

import { formatWithType, type TypeRegistry } from "./registry.js"
import type { AnyRow, CellContext, FormatContext, ResolvedColumn } from "./types.js"

export type ExportOptions<TRow, TNode = unknown> = {
  columns: readonly ResolvedColumn<TRow, TNode>[]
  types: TypeRegistry
  format: FormatContext
  /** `,` for CSV, `\t` for anything pasted into a spreadsheet. */
  delimiter?: string
  /** Write the header row. Defaults to true. */
  header?: boolean
  /**
   * Prefix the file with a byte order mark.
   *
   * Excel on Windows reads a UTF-8 CSV as the local code page unless it finds
   * one, which turns every accented name into mojibake. Defaults to true for
   * that reason alone.
   */
  bom?: boolean
}

/**
 * Escapes one field.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with a quote, because a spreadsheet
 * treats those as the start of a formula. `=1+1` is a curiosity;
 * `=HYPERLINK(...)` in an exported customer list is a security bug with a name
 * — CSV injection — and the fix costs one character.
 */
function escapeField(value: string, delimiter: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value

  if (
    guarded.includes(delimiter) ||
    guarded.includes('"') ||
    guarded.includes("\n") ||
    guarded.includes("\r")
  ) {
    return `"${guarded.replace(/"/g, '""')}"`
  }

  return guarded
}

/** The text one cell exports as: the column's own rule, or its formatted value. */
export function exportCell<TRow extends AnyRow, TNode = unknown>(
  row: TRow,
  rowId: string,
  rowIndex: number,
  column: ResolvedColumn<TRow, TNode>,
  types: TypeRegistry,
  format: FormatContext,
): string {
  const value = column.accessor(row)
  const context: CellContext<TRow, TNode> = {
    value,
    row,
    rowIndex,
    rowId,
    column,
    text: formatWithType(types.get(column.type), value, { ...format, ...column.formatOptions }),
    format,
  }

  /*
    The caller's word first, then the column's own formatter, then whatever the
    type says belongs in a file — a number rather than "$4,790.50", an ISO date
    rather than "Aug 13, 2026" — and finally the text on screen.
  */
  if (column.exportValue) return column.exportValue(context)
  if (column.format) return column.format(context)

  const type = types.get(column.type)
  if (type.exportValue) return type.exportValue(value, { ...format, ...column.formatOptions })

  return context.text
}

/** Rows as delimited text, ready to be downloaded or put on the clipboard. */
export function toDelimitedText<TRow extends AnyRow, TNode = unknown>(
  rows: readonly TRow[],
  options: ExportOptions<TRow, TNode> & { getRowId?: (row: TRow, index: number) => string },
): string {
  const delimiter = options.delimiter ?? ","
  const columns = options.columns.filter((column) => column.exportable)

  const lines: string[] = []

  if (options.header !== false) {
    lines.push(columns.map((column) => escapeField(column.header, delimiter)).join(delimiter))
  }

  rows.forEach((row, index) => {
    const rowId = options.getRowId?.(row, index) ?? String(index)
    lines.push(
      columns
        .map((column) =>
          escapeField(exportCell(row, rowId, index, column, options.types, options.format), delimiter),
        )
        .join(delimiter),
    )
  })

  // CRLF: the line ending the CSV specification asks for, and the one Excel
  // handles without complaint on every platform.
  return lines.join("\r\n")
}

export function toCsv<TRow extends AnyRow, TNode = unknown>(
  rows: readonly TRow[],
  options: ExportOptions<TRow, TNode> & { getRowId?: (row: TRow, index: number) => string },
): string {
  const text = toDelimitedText(rows, { ...options, delimiter: options.delimiter ?? "," })
  return options.bom === false ? text : `﻿${text}`
}

/**
 * Hands a string to the browser as a file.
 *
 * The one function in the core that touches the DOM, and it does so only when
 * called — never at module scope — so importing the core on a server stays
 * safe. It returns false rather than throwing where there is no browser.
 */
export function downloadText(text: string, filename: string, mimeType = "text/csv;charset=utf-8"): boolean {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return false

  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  /*
    Revoking immediately cancels the download in some browsers; a tick is
    enough for the navigation to have started. Held onto now rather than looked
    up then, because by the time the tick comes the environment may have moved
    on — a test that restored its globals, an embedder that swapped `URL` — and
    releasing a blob is best-effort cleanup that must never throw.
  */
  const revoke = URL.revokeObjectURL
  if (typeof revoke === "function") setTimeout(() => revoke.call(URL, url), 0)
  return true
}

/** Puts text on the clipboard, falling back to the legacy path in older browsers. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission refused, or an insecure origin. Fall through.
    }
  }

  if (typeof document === "undefined") return false

  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.append(area)
  area.select()

  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    area.remove()
  }
}
