import { useRef, useState } from "react"
import {
  hideColumn as hideColumnState,
  moveColumn,
  reorderColumn,
  setFilter as setFilterState,
  setOrder,
  setPin,
  setWidth,
  toggleSort,
  removeFilter,
  type AnyRow,
  type ColumnFilter,
  type TableState,
} from "@trapezium/core"

import { FilterControl } from "./filter-control.js"
import { Icon } from "./icon.js"
import { Menu, MenuItem, MenuSeparator } from "./menu.js"
import type { LinkComponent, TableColumn } from "./types.js"

/**
 * A column header.
 *
 * Everything a column can do lives here, and all of it is reachable three ways:
 * by mouse, by keyboard, and — when the table is given `buildHref` — by
 * following a link with no JavaScript at all.
 *
 * The drag handle is the type icon rather than the whole cell, because a
 * draggable element swallows the pointer events its children need. That is the
 * same reason the resize handle is its own button rather than a border style.
 */
export function HeaderCell<TRow extends AnyRow>({
  column,
  state,
  rows,
  update,
  visibleKeys,
  features,
  buildHref,
  linkComponent,
  style,
  pinOffset,
  isPinEdge,
}: {
  column: TableColumn<TRow>
  state: TableState
  rows: readonly TRow[]
  update: (next: (current: TableState) => TableState) => void
  /** The visible column keys in order, for the move and reorder actions. */
  visibleKeys: string[]
  features: {
    sortable: boolean
    filters: boolean
    menu: boolean
    resizable: boolean
    reorderable: boolean
  }
  buildHref?: (state: TableState) => string
  linkComponent?: LinkComponent
  style?: React.CSSProperties
  pinOffset?: number
  isPinEdge?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const headerRef = useRef<HTMLTableCellElement | null>(null)

  const sort = state.sort.find((entry) => entry.key === column.key)
  const filter = state.filters.find((entry) => entry.key === column.key)
  const sortable = features.sortable && column.sortable
  const filterable = features.filters && column.filterKind !== "none"
  const reorderable = features.reorderable && column.reorderable !== false && !column.pin

  const href = (next: (current: TableState) => TableState) =>
    buildHref ? buildHref(next(state)) : undefined

  const apply = (next: (current: TableState) => TableState) => update(next)

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const cell = headerRef.current
    if (!cell) return

    const startX = event.clientX
    const startWidth = cell.getBoundingClientRect().width
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    target.dataset["resizing"] = "true"

    const onMove = (move: PointerEvent) => {
      apply((current) => setWidth(current, column.key, startWidth + (move.clientX - startX)))
    }

    const onUp = () => {
      target.releasePointerCapture(event.pointerId)
      delete target.dataset["resizing"]
      target.removeEventListener("pointermove", onMove)
      target.removeEventListener("pointerup", onUp)
    }

    target.addEventListener("pointermove", onMove)
    target.addEventListener("pointerup", onUp)
  }

  const label = (
    <>
      <span className="tpz-th-label">{column.header}</span>
      {sort && (
        <Icon
          name={sort.direction === "asc" ? "sortAscending" : "sortDescending"}
          size={12}
          className="tpz-th-marker"
        />
      )}
    </>
  )

  const Link = linkComponent

  return (
    <th
      ref={headerRef}
      scope="col"
      className="tpz-th"
      data-align={column.align}
      data-pin={column.pin}
      data-pin-edge={isPinEdge ? column.pin : undefined}
      data-filtered={filter ? "true" : undefined}
      data-drag-over={dragOver ? "true" : undefined}
      aria-sort={sort ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      style={{
        ...style,
        ...(column.pin === "start" ? { left: pinOffset } : {}),
        ...(column.pin === "end" ? { right: pinOffset } : {}),
      }}
      onDragOver={
        reorderable
          ? (event) => {
              event.preventDefault()
              setDragOver(true)
            }
          : undefined
      }
      onDragLeave={reorderable ? () => setDragOver(false) : undefined}
      onDrop={
        reorderable
          ? (event) => {
              event.preventDefault()
              setDragOver(false)
              const dragged = event.dataTransfer.getData("text/tpz-column")
              if (!dragged || dragged === column.key) return
              apply((current) =>
                setOrder(current, reorderColumn(visibleKeys, dragged, visibleKeys.indexOf(column.key))),
              )
            }
          : undefined
      }
    >
      <div className="tpz-th-inner">
        <span
          className="tpz-th-icon"
          data-draggable={reorderable ? "true" : undefined}
          draggable={reorderable}
          /*
            Dragging is a pointer affordance; the keyboard equivalent is "Move
            left" and "Move right" in the column panel, so there is nothing
            here for a screen reader to announce.
          */
          aria-hidden="true"
          onDragStart={
            reorderable
              ? (event) => {
                  event.dataTransfer.setData("text/tpz-column", column.key)
                  event.dataTransfer.effectAllowed = "move"
                }
              : undefined
          }
        >
          <Icon name={column.icon} />
        </span>

        {/*
          Clicking the header sorts. Everything else is behind the chevron
          beside it, because a header that opens a menu instead of sorting
          fails the one expectation every person brings to a table.
        */}
        {sortable ? (
          <SortButton
            href={href((current) => toggleSort(current, column.key))}
            Link={Link}
            onSelect={() => apply((current) => toggleSort(current, column.key))}
            columnHeader={column.header}
          >
            {label}
          </SortButton>
        ) : (
          <span className="tpz-th-button">{label}</span>
        )}

        {features.menu && (
          <Menu
            align="start"
            label={`${column.header} column`}
            trigger={(props) => (
              <button
                type="button"
                className="tpz-th-menu"
                aria-label={`${column.header} column options`}
                {...props}
              >
                <Icon name="chevronDown" size={12} className="tpz-th-chevron" />
              </button>
            )}
          >
            {(close) => (
              <>
                {sortable && (
                  <>
                    <Action
                      icon={<Icon name="sortAscending" />}
                      href={href((current) => ({
                        ...current,
                        sort: [{ key: column.key, direction: "asc" }],
                        page: 1,
                      }))}
                      Link={Link}
                      onSelect={() => {
                        apply((current) => ({
                          ...current,
                          sort: [{ key: column.key, direction: "asc" }],
                          page: 1,
                        }))
                        close()
                      }}
                    >
                      Sort ascending
                    </Action>
                    <Action
                      icon={<Icon name="sortDescending" />}
                      href={href((current) => ({
                        ...current,
                        sort: [{ key: column.key, direction: "desc" }],
                        page: 1,
                      }))}
                      Link={Link}
                      onSelect={() => {
                        apply((current) => ({
                          ...current,
                          sort: [{ key: column.key, direction: "desc" }],
                          page: 1,
                        }))
                        close()
                      }}
                    >
                      Sort descending
                    </Action>
                    {sort && (
                      <Action
                        icon={<Icon name="close" />}
                        href={href((current) => ({ ...current, sort: [] }))}
                        Link={Link}
                        onSelect={() => {
                          apply((current) => ({ ...current, sort: [] }))
                          close()
                        }}
                      >
                        Clear sort
                      </Action>
                    )}
                    <MenuSeparator />
                  </>
                )}

                {filterable && (
                  <>
                    <FilterControl
                      column={column}
                      filter={filter}
                      rows={rows}
                      onApply={(next: ColumnFilter) => {
                        apply((current) => setFilterState(current, next))
                        if (column.filterKind !== "set") close()
                      }}
                      onClear={() => apply((current) => removeFilter(current, column.key))}
                    />
                    <MenuSeparator />
                  </>
                )}

                {features.reorderable && !column.pin && (
                  <>
                    <MenuItem
                      icon={<Icon name="arrowLeft" />}
                      disabled={visibleKeys.indexOf(column.key) <= 0}
                      onSelect={() => {
                        apply((current) => setOrder(current, moveColumn(visibleKeys, column.key, "left")))
                        close()
                      }}
                    >
                      Move left
                    </MenuItem>
                    <MenuItem
                      icon={<Icon name="arrowRight" />}
                      disabled={visibleKeys.indexOf(column.key) >= visibleKeys.length - 1}
                      onSelect={() => {
                        apply((current) => setOrder(current, moveColumn(visibleKeys, column.key, "right")))
                        close()
                      }}
                    >
                      Move right
                    </MenuItem>
                  </>
                )}

                <MenuItem
                  icon={<Icon name="pin" />}
                  onSelect={() => {
                    apply((current) =>
                      setPin(current, column.key, current.pinned[column.key] === "start" ? undefined : "start"),
                    )
                    close()
                  }}
                >
                  {state.pinned[column.key] === "start" ? "Unpin" : "Pin to the left"}
                </MenuItem>

                <Action
                  icon={<Icon name="eyeOff" />}
                  href={href((current) => hideColumnState(current, column.key))}
                  Link={Link}
                  onSelect={() => {
                    apply((current) => hideColumnState(current, column.key))
                    close()
                  }}
                >
                  Hide column
                </Action>
              </>
            )}
          </Menu>
        )}

        {features.resizable && column.resizable !== false && (
          <button
            type="button"
            className="tpz-resizer"
            aria-label={`Resize ${column.header}`}
            onPointerDown={startResize}
            onDoubleClick={() =>
              apply((current) => {
                const widths = { ...current.widths }
                delete widths[column.key]
                return { ...current, widths }
              })
            }
            onKeyDown={(event) => {
              // Resizing has to be reachable without a pointer.
              const step = event.shiftKey ? 40 : 10
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault()
                const current = headerRef.current?.getBoundingClientRect().width ?? 160
                apply((state) =>
                  setWidth(state, column.key, current + (event.key === "ArrowRight" ? step : -step)),
                )
              }
            }}
          />
        )}
      </div>
    </th>
  )
}

/** A menu entry that is a link when the table is driven by URLs, and a button otherwise. */
function Action({
  children,
  icon,
  href,
  Link,
  onSelect,
  disabled,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  href?: string
  Link?: LinkComponent
  onSelect: () => void
  disabled?: boolean
}) {
  if (!href) {
    return (
      <MenuItem icon={icon} onSelect={onSelect} disabled={disabled}>
        {children}
      </MenuItem>
    )
  }

  if (Link) {
    return (
      <Link href={href} className="tpz-menu-item">
        {icon}
        {children}
      </Link>
    )
  }

  return (
    <a href={href} data-menu-item="" className="tpz-menu-item">
      {icon}
      {children}
    </a>
  )
}

function SortButton({
  children,
  href,
  Link,
  onSelect,
  columnHeader,
}: {
  children: React.ReactNode
  href?: string
  Link?: LinkComponent
  onSelect: () => void
  columnHeader: string
}) {
  if (href) {
    // The class goes on the anchor itself rather than on a span inside it, or
    // the browser's own link styling underlines every column header.
    const props = { href, className: "tpz-th-button", "aria-label": `Sort by ${columnHeader}`, children }
    return Link ? <Link {...props} /> : <a {...props} />
  }

  return (
    <button type="button" className="tpz-th-button" onClick={onSelect}>
      {children}
    </button>
  )
}
