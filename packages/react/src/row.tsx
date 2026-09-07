import { memo } from "react"
import type { AnyRow, FormatContext, TypeRegistry } from "@trapezium/core"

import { cellText, renderCell } from "./cell.js"
import type { ClassResolver } from "./classes.js"
import type { TableColumn, LinkComponent } from "./types.js"

/**
 * One row, and the reason appending a page is cheap.
 *
 * This is `memo`'d, which is the whole point of it being a component at all.
 * An infinite list holds every page loaded so far, so by the tenth page the
 * table has thousands of rows on screen; without this, reaching the sentinel
 * re-runs every cell renderer and diffs every cell in the table to add
 * twenty-five rows at the bottom. With it, React skips straight past the rows
 * that have not changed and mounts only the new ones — the cost of a page is
 * the size of the page, not the size of the list.
 *
 * That only holds if the props are stable, so everything here is either a
 * primitive or memoised by the table: the row's class name and href arrive as
 * strings rather than as the functions that produced them, the handlers are
 * identity-stable, and the pin offsets are replaced only when they actually
 * change. A new object in any of these would quietly turn the memo off and
 * nothing would look broken — it would just be slow again.
 */

export type RowProps<TRow extends AnyRow> = {
  row: TRow
  id: string
  rowIndex: number
  columns: TableColumn<TRow>[]
  types: TypeRegistry
  format: FormatContext
  classes: ClassResolver
  /** Already resolved from `rowClassName`, so the memo compares a string. */
  className?: string
  /** Already resolved from `rowHref`, likewise. */
  href?: string
  selected: boolean
  selectionMode?: "single" | "multiple"
  /** False when `isSelectable` said this row is not. */
  selectable: boolean
  pinOffsets: Record<string, number>
  /** Keys of the last pinned column on each side — they carry the frozen edge. */
  pinEdges: Record<string, true>
  /** True when the table has an exact height, so cells need something to bound them. */
  fit: boolean
  onRowClick?: (row: TRow, event: React.MouseEvent) => void
  onToggle: (id: string, event: React.ChangeEvent<HTMLInputElement>) => void
  linkComponent?: LinkComponent
}

function RowInner<TRow extends AnyRow>({
  row,
  id,
  rowIndex,
  columns,
  types,
  format,
  classes,
  className,
  href,
  selected,
  selectionMode,
  selectable,
  pinOffsets,
  pinEdges,
  fit,
  onRowClick,
  onToggle,
  linkComponent: Link,
}: RowProps<TRow>) {
  return (
    <tr
      className={classes("row", className)}
      data-selected={selected ? "true" : undefined}
      data-clickable={onRowClick ? "true" : undefined}
      onClick={onRowClick ? (event) => onRowClick(row, event) : undefined}
    >
      {selectionMode && (
        <td
          className={classes("selectCell")}
          data-pin="start"
          data-key="__select"
          style={{ left: pinOffsets["__select"] ?? 0 }}
        >
          <input
            type={selectionMode === "single" ? "radio" : "checkbox"}
            className="tpz-checkbox"
            checked={selected}
            disabled={!selectable}
            aria-label={`Select row ${String(rowIndex + 1)}`}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToggle(id, event)}
          />
        </td>
      )}

      {columns.map((column, columnIndex) => {
        const context = cellText(row, id, rowIndex, column, types, format)
        const content = renderCell(context, types)
        const leading = columnIndex === 0
        const lines = typeof column.wrap === "number" ? column.wrap : undefined

        const inner =
          leading && href ? (
            Link ? (
              <Link href={href} className="tpz-link tpz-lead">
                {content}
              </Link>
            ) : (
              <a href={href} className="tpz-link tpz-lead">
                {content}
              </a>
            )
          ) : (
            content
          )

        return (
          <td
            key={column.key}
            className={classes("cell", column.className)}
            data-align={column.align}
            data-mono={column.mono ? undefined : "false"}
            data-wrap={wrapAttribute(column.wrap)}
            data-pin={column.pin}
            data-pin-edge={pinEdges[column.key] ? column.pin : undefined}
            data-key={column.key}
            // Carries the header into the cell so the card layout
            // can label it in CSS, with no second render.
            data-label={column.header}
            style={{
              ...(column.pin === "start" ? { left: pinOffsets[column.key] } : {}),
              ...(column.pin === "end" ? { right: pinOffsets[column.key] } : {}),
              width: column.width,
            }}
          >
            {/*
              A table cell has to go on being a table cell, so anything that
              bounds its content needs an element of its own inside it:
              `-webkit-box` for a line clamp, and a plain block for an exact
              row height, whose cap `height` alone cannot enforce.
            */}
            {lines !== undefined ? (
              <span className="tpz-clamp" style={{ "--tpz-cell-lines": lines } as React.CSSProperties}>
                {inner}
              </span>
            ) : fit ? (
              <span className="tpz-fit">{inner}</span>
            ) : (
              inner
            )}
          </td>
        )
      })}
    </tr>
  )
}

/**
 * `true` and a line count both mean "wrap"; `false` means "stay on one line
 * even though the table is set to wrap", which is a different thing from
 * saying nothing at all.
 */
export function wrapAttribute(wrap: boolean | number | undefined): "true" | "false" | undefined {
  if (wrap === undefined) return undefined
  return wrap === false ? "false" : "true"
}

/*
  `memo` does not carry a generic through: what it returns is a component over
  `RowProps<AnyRow>`, which would erase the caller's row type at every use. The
  cast gives the memoised component the signature `RowInner` already has — the
  same function, typed as itself — which is why it is a cast and not an error
  being silenced.
*/
export const Row = memo(RowInner) as typeof RowInner
