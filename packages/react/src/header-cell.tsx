import { useEffect, useRef, useState } from "react"
import {
  HEADER_SEARCH_DEBOUNCE,
  addSort,
  columnSearchText,
  hideColumn as hideColumnState,
  isPlainLinkClick,
  moveColumn,
  poof,
  reorderColumnTo,
  setColumnSearch,
  setFilter as setFilterState,
  setOrder,
  setPin,
  setWidth,
  sortPriority,
  toggleSort,
  removeFilter,
  removeSort,
  type AnyRow,
  type ColumnFilter,
  type SelectOption,
  type TableState,
} from "@trapezium/core"

import { FilterControl } from "./filter-control.js"
import { HeaderSearchBox, HeaderSearchTrigger } from "./header-search.js"
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
  onNavigate,
  style,
  pinOffset,
  isPinEdge,
  theme,
  onDragStateChange,
  formatValue,
  fetchOptions,
  searchDebounce = HEADER_SEARCH_DEBOUNCE,
  className = "tpz-th",
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
    /** Whether a shift-click adds a level to the sort. Defaults to false. */
    multiSort?: boolean
  }
  buildHref?: (state: TableState) => string
  linkComponent?: LinkComponent
  onNavigate?: (href: string, event: React.MouseEvent) => void
  style?: React.CSSProperties
  pinOffset?: number
  isPinEdge?: boolean
  /** Copied onto the puff, so it is themed like the table it came from. */
  theme?: "light" | "dark"
  /** Lets the table mark itself while a column is in the air. */
  onDragStateChange?: (dragging: boolean) => void
  /** How a stored value reads on screen, for the set filter's choices. */
  formatValue: (value: unknown) => string
  /** Asks the server what values this column has, when the table knows how. */
  fetchOptions?: () => Promise<SelectOption[]>
  /** Milliseconds a header search waits after a keystroke. Defaults to 150. */
  searchDebounce?: number
  /** The resolved slot class, with the column's own `headerClassName` already added. */
  className?: string
}) {
  const [dropEdge, setDropEdge] = useState<"before" | "after" | undefined>()
  const [dragging, setDragging] = useState(false)
  const headerRef = useRef<HTMLTableCellElement | null>(null)

  const sort = state.sort.find((entry) => entry.key === column.key)
  const filter = state.filters.find((entry) => entry.key === column.key)
  const sortable = features.sortable && column.sortable
  const multiSort = sortable && features.multiSort === true
  const priority = sortPriority(state.sort, column.key)
  // A level can only be added to a sort that already has another column in it.
  const sortedElsewhere = state.sort.some((entry) => entry.key !== column.key)
  const filterable = features.filters && column.filterKind !== "none"
  const reorderable = features.reorderable && column.reorderable !== false && !column.pin

  /*
    A header search is a filter, so the table's `filters` switch governs it
    too. Whether the box is open is this header's own business — nothing else
    in the table needs to know — and it is never open on a server, so the
    markup both sides render is the closed one.
  */
  const searchable = features.filters && column.headerSearch
  const [searching, setSearching] = useState(false)
  const searchText = searchable ? columnSearchText(state, column.key) : ""
  const searchTrigger = useRef<HTMLButtonElement | null>(null)
  const returnFocus = useRef(false)

  // Back to the magnifier once the box has gone, when the keyboard closed it:
  // the button can only be focused again after the render that shows it.
  useEffect(() => {
    if (searching || !returnFocus.current) return
    returnFocus.current = false
    searchTrigger.current?.focus()
  }, [searching])

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
    /*
      The whole header is draggable, and a press-and-move on the resize handle
      is exactly what starts a drag. Turning it off for the duration is what
      lets the two gestures share the same cell.
    */
    cell.draggable = false

    const onMove = (move: PointerEvent) => {
      apply((current) => setWidth(current, column.key, startWidth + (move.clientX - startX)))
    }

    const onUp = () => {
      target.releasePointerCapture(event.pointerId)
      delete target.dataset["resizing"]
      cell.draggable = reorderable
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
      {priority !== undefined && (
        <>
          <span className="tpz-th-order" aria-hidden="true">
            {priority}
          </span>
          <span className="tpz-sr">{`, sort level ${String(priority)}`}</span>
        </>
      )}
    </>
  )

  const Link = linkComponent

  return (
    <th
      ref={headerRef}
      scope="col"
      className={className}
      data-align={column.align}
      data-key={column.key}
      data-pin={column.pin}
      data-pin-edge={isPinEdge ? column.pin : undefined}
      data-filtered={filter ? "true" : undefined}
      data-draggable={reorderable ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      data-drop={dropEdge}
      data-searching={searching && searchable ? "true" : undefined}
      // A draggable ancestor takes the mouse away from a text box: dragging to
      // select what was typed would pick the column up instead.
      draggable={reorderable && !searching}
      aria-sort={sort ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      style={{
        ...style,
        ...(column.pin === "start" ? { left: pinOffset } : {}),
        ...(column.pin === "end" ? { right: pinOffset } : {}),
      }}
      /*
        A shift-click on a header that is a link. The browser's answer to that
        is a new window, and a link component leaves modified clicks to the
        browser — so it is caught here, on the way down, and turned into the
        change of state it means. The caller's `onStateChange` is what turns a
        change of state into a URL, as it does for every control that is not a
        link.
      */
      onClickCapture={
        multiSort && buildHref
          ? (event) => {
              if (!event.shiftKey || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return
              if (!(event.target instanceof Element) || !event.target.closest("a.tpz-th-button")) return
              event.preventDefault()
              event.stopPropagation()
              apply((current) => toggleSort(current, column.key, true))
            }
          : undefined
      }
      // A shift-click also stretches the page's text selection to wherever
      // was clicked, which paints half the table blue for a gesture that
      // meant "sort by this as well".
      onMouseDownCapture={
        multiSort
          ? (event) => {
              if (!event.shiftKey) return
              if (event.target instanceof Element && event.target.closest(".tpz-th-button")) event.preventDefault()
            }
          : undefined
      }
      onDragStart={
        reorderable
          ? (event) => {
              event.dataTransfer.setData("text/tpz-column", column.key)
              event.dataTransfer.effectAllowed = "move"
              setDragging(true)
              onDragStateChange?.(true)
            }
          : undefined
      }
      onDragEnd={
        reorderable
          ? (event) => {
              setDragging(false)
              setDropEdge(undefined)
              onDragStateChange?.(false)

              /*
                Nothing accepted the drop, so it landed outside the table —
                which is how a column is removed, the same gesture as dragging
                something off the macOS dock. The last visible column is
                refused: a table of nothing has no obvious way back.
              */
              if (event.dataTransfer.dropEffect !== "none") return
              if (!isOutside(headerRef.current, event.clientX, event.clientY)) return
              if (visibleKeys.length <= 1) return

              poof({ x: event.clientX, y: event.clientY, theme })
              apply((current) => hideColumnState(current, column.key))
            }
          : undefined
      }
      onDragOver={
        reorderable
          ? (event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = "move"
              // Which side of the middle the pointer is on decides where the
              // column lands, so a drop is never a guess.
              const rect = event.currentTarget.getBoundingClientRect()
              setDropEdge(event.clientX < rect.left + rect.width / 2 ? "before" : "after")
            }
          : undefined
      }
      onDragLeave={reorderable ? () => setDropEdge(undefined) : undefined}
      onDrop={
        reorderable
          ? (event) => {
              event.preventDefault()
              const edge = dropEdge ?? "before"
              setDropEdge(undefined)

              const dragged = event.dataTransfer.getData("text/tpz-column")
              if (!dragged || dragged === column.key) return

              apply((current) =>
                setOrder(current, reorderColumnTo(visibleKeys, dragged, column.key, edge)),
              )
            }
          : undefined
      }
    >
      <div className="tpz-th-inner">
        {/*
          A column that can be searched from its header has the magnifier
          where its icon would be — the same slot, as a button.
        */}
        {searchable ? (
          <HeaderSearchTrigger
            header={column.header}
            icon={column.icon}
            text={searchText}
            buttonRef={searchTrigger}
            onOpen={() => setSearching(true)}
          />
        ) : (
          <span className="tpz-th-icon" aria-hidden="true">
            <Icon name={column.icon} />
          </span>
        )}

        {/*
          Clicking the header sorts. Everything else is behind the chevron
          beside it, because a header that opens a menu instead of sorting
          fails the one expectation every person brings to a table.
        */}
        {sortable ? (
          <SortButton
            href={href((current) => toggleSort(current, column.key))}
            Link={Link}
            onNavigate={onNavigate}
            onSelect={(additive) => apply((current) => toggleSort(current, column.key, additive && multiSort))}
            columnHeader={column.header}
            priority={priority}
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
                      onNavigate={onNavigate}
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
                      onNavigate={onNavigate}
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
                    {/*
                      Adding a level without a shift key: the keyboard's way to
                      a sort of several columns, and the way anybody finds out
                      there is one. Offered once some other column is sorted,
                      because until then "then" has nothing to follow.
                    */}
                    {multiSort && sortedElsewhere && (
                      <>
                        <Action
                          icon={<Icon name="sortAscending" />}
                          href={href((current) => addSort(current, column.key, "asc"))}
                          Link={Link}
                          onNavigate={onNavigate}
                          onSelect={() => {
                            apply((current) => addSort(current, column.key, "asc"))
                            close()
                          }}
                        >
                          Then sort ascending
                        </Action>
                        <Action
                          icon={<Icon name="sortDescending" />}
                          href={href((current) => addSort(current, column.key, "desc"))}
                          Link={Link}
                          onNavigate={onNavigate}
                          onSelect={() => {
                            apply((current) => addSort(current, column.key, "desc"))
                            close()
                          }}
                        >
                          Then sort descending
                        </Action>
                      </>
                    )}
                    {sort && (
                      <Action
                        icon={<Icon name="close" />}
                        // This column's level only: the others are somebody's
                        // deliberate choice, and the reset is there for all of them.
                        href={href((current) => removeSort(current, column.key))}
                        Link={Link}
                        onNavigate={onNavigate}
                        onSelect={() => {
                          apply((current) => removeSort(current, column.key))
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
                      label={formatValue}
                      fetchOptions={fetchOptions}
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
                  onNavigate={onNavigate}
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

      {searching && searchable && (
        <HeaderSearchBox
          header={column.header}
          text={searchText}
          debounce={searchDebounce}
          onSearch={(text) => apply((current) => setColumnSearch(current, column.key, text))}
          onClose={(focusTrigger) => {
            if (focusTrigger) returnFocus.current = true
            setSearching(false)
          }}
        />
      )}
    </th>
  )
}

/** A menu entry that is a link when the table is driven by URLs, and a button otherwise. */
function Action({
  children,
  icon,
  href,
  Link,
  onNavigate,
  onSelect,
  disabled,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  href?: string
  Link?: LinkComponent
  onNavigate?: (href: string, event: React.MouseEvent) => void
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
    <a href={href} data-menu-item="" className="tpz-menu-item" onClick={routeClick(href, onNavigate)}>
      {icon}
      {children}
    </a>
  )
}

/**
 * The click handler that hands a plain click on a link to `onNavigate`.
 *
 * A modifier held or the middle button means the person asked the browser for
 * something, and it is left alone.
 */
export function routeClick(
  href: string,
  onNavigate: ((href: string, event: React.MouseEvent) => void) | undefined,
): ((event: React.MouseEvent<HTMLAnchorElement>) => void) | undefined {
  if (!onNavigate) return undefined
  return (event) => {
    if (!isPlainLinkClick(event, event.currentTarget.getAttribute("target"))) return
    event.preventDefault()
    onNavigate(href, event)
  }
}

function SortButton({
  children,
  href,
  Link,
  onNavigate,
  onSelect,
  columnHeader,
  priority,
}: {
  children: React.ReactNode
  href?: string
  Link?: LinkComponent
  onNavigate?: (href: string, event: React.MouseEvent) => void
  /** Called with whether the shift key was held, which asks for a level to be added. */
  onSelect: (additive: boolean) => void
  columnHeader: string
  /** The column's place in a sort of several levels, if it has one. */
  priority?: number
}) {
  if (href) {
    // The class goes on the anchor itself rather than on a span inside it, or
    // the browser's own link styling underlines every column header.
    /*
      A link is draggable on its own — the browser lets a person drag a URL
      to another tab or the desktop. Inside a draggable header that native
      link drag wins, because the drag starts at the innermost draggable
      element: the header's own handlers still fire as it bubbles, so the drop
      indicator moves as if a column were coming, but what lands is a URL, and
      wherever it lands the browser opens it. Turning the link's own drag off
      lets the header be the thing that is dragged.
    */
    const props = {
      href,
      className: "tpz-th-button",
      // Replaces the link's own text as its name, so the level has to be said here.
      "aria-label":
        priority === undefined ? `Sort by ${columnHeader}` : `Sort by ${columnHeader}, sort level ${String(priority)}`,
      draggable: false as const,
      children,
    }
    return Link ? <Link {...props} /> : <a {...props} onClick={routeClick(href, onNavigate)} />
  }

  return (
    <button type="button" className="tpz-th-button" onClick={(event) => onSelect(event.shiftKey)}>
      {children}
    </button>
  )
}

/**
 * Whether a point is outside the table the header belongs to.
 *
 * The scroll container rather than the header: a drop a few pixels below the
 * last row is still inside the table, and removing a column for that would be
 * infuriating.
 */
function isOutside(header: HTMLElement | null, x: number, y: number): boolean {
  const table = header?.closest(".tpz-frame")
  if (!table) return false

  const rect = table.getBoundingClientRect()
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom
}
