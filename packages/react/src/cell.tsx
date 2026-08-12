import type { ReactNode } from "react"
import {
  formatWithType,
  isEmpty,
  optionLabel,
  type AnyRow,
  type SelectOption,
  type TypeRegistry,
} from "@trapezium/core"

import { Icon } from "./icon.js"
import type { TableCellContext, TableColumn } from "./types.js"

/**
 * What a cell looks like when nobody said otherwise.
 *
 * One renderer for every type, shared by every table — so a date looks the same
 * in one product as it does in another, and adding a type means one change here
 * rather than one per screen.
 *
 * A column's own `render` replaces all of this. `format` replaces only the
 * text, which is the more common thing to want and the one that keeps sorting,
 * filtering, search and export working on the real value.
 */
export function renderCell<TRow extends AnyRow>(
  context: TableCellContext<TRow>,
  types: TypeRegistry,
): ReactNode {
  const { column, value, text } = context

  if (column.render) return column.render(context)

  if (isEmpty(value)) {
    return (
      <span className="tpz-empty-value" aria-label="Empty">
        {context.format.emptyText}
      </span>
    )
  }

  switch (column.type) {
    case "boolean":
      // An icon reads faster than a word in a dense column, but it still needs
      // a text alternative — an icon alone announces nothing.
      return (
        <span className={value ? "tpz-boolean-true" : "tpz-boolean-false"}>
          <Icon name={value ? "check" : "minus"} />
          <span className="tpz-sr">{value ? "Yes" : "No"}</span>
        </span>
      )

    case "url": {
      const href = String(value)
      return (
        <a
          href={href}
          target="_blank"
          // noreferrer as well as noopener: the destination must not learn
          // where the click came from, and older browsers only honour the one.
          rel="noopener noreferrer"
          className="tpz-link"
          onClick={stopRowClick}
        >
          {href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )
    }

    case "email":
      return (
        <a href={`mailto:${String(value)}`} className="tpz-link" onClick={stopRowClick}>
          {String(value)}
        </a>
      )

    case "phone":
      return (
        <a href={`tel:${String(value).replace(/[^\d+]/g, "")}`} className="tpz-link" onClick={stopRowClick}>
          {String(value)}
        </a>
      )

    case "image":
      return (
        <img
          src={String(value)}
          alt=""
          className="tpz-avatar"
          loading="lazy"
          decoding="async"
        />
      )

    case "select":
    case "badge":
      return <Badge value={String(value)} options={column.formatOptions?.options} />

    case "tags": {
      const values = Array.isArray(value) ? value : [value]
      return (
        <span className="tpz-tags">
          {values.map((entry) => (
            <Badge key={String(entry)} value={String(entry)} options={column.formatOptions?.options} />
          ))}
        </span>
      )
    }

    case "json":
      return (
        <span className="tpz-code" title={safeJson(value)}>
          {text}
        </span>
      )

    default:
      /*
        `title` gives a truncated cell a way to be read in full. Only where the
        text is long enough to be cut off — a tooltip on every cell in the table
        is noise, and it fires on hover over data people are only scanning.
      */
      return text.length > 24 ? <span title={text}>{text}</span> : text
  }
}

/** The text a cell shows, before any React node wraps it. */
export function cellText<TRow extends AnyRow>(
  row: TRow,
  rowId: string,
  rowIndex: number,
  column: TableColumn<TRow>,
  types: TypeRegistry,
  format: TableCellContext<TRow>["format"],
): TableCellContext<TRow> {
  const value = column.accessor(row)
  const options = { ...format, ...column.formatOptions }

  const context: TableCellContext<TRow> = {
    value,
    row,
    rowIndex,
    rowId,
    column,
    text: formatWithType(types.get(column.type), value, options),
    format,
  }

  // A column-level formatter replaces the type's text but keeps everything
  // else, so the raw value still drives sorting and filtering.
  if (column.format) context.text = column.format(context)

  return context
}

function Badge({ value, options }: { value: string; options?: SelectOption[] }) {
  const option = options?.find((entry) => entry.value === value)
  const label = optionLabel(value, options)

  return (
    <span
      className="tpz-badge"
      data-colour={option?.colour ? "" : undefined}
      style={option?.colour ? ({ "--tpz-badge-colour": option.colour } as React.CSSProperties) : undefined}
      title={label}
    >
      {label}
    </span>
  )
}

/**
 * Keeps a click on a link inside a cell from also triggering the row.
 *
 * Without it, clicking someone's email address in a table whose rows navigate
 * opens the mail client *and* the record, which is two things nobody asked for.
 */
function stopRowClick(event: React.MouseEvent) {
  event.stopPropagation()
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? ""
  } catch {
    return String(value)
  }
}
