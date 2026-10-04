import { useEffect, useRef, useState } from "react"
import {
  OPERATOR_LABELS,
  clearFilters,
  optionLabel,
  removeFilterAt,
  setDensity,
  reorderColumnTo,
  setOrder,
  setSearch,
  showColumn,
  toggleColumn,
  type AnyRow,
  type ColumnFilter,
  type Density,
  type TableState,
} from "@trapezium/core"

import { routeClick } from "./header-cell.js"
import { Icon } from "./icon.js"
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "./menu.js"
import type { LinkComponent, SearchOptions, TableColumn } from "./types.js"

/**
 * Everything above the table: what is selected, what is filtered, and the
 * controls that change either.
 *
 * It renders nothing at all when nothing is switched on, so a plain
 * `<Table data={rows} />` is a table and not a table with an empty grey strip
 * on top of it.
 */
export function Toolbar<TRow extends AnyRow>({
  state,
  update,
  columns,
  hiddenColumns,
  total,
  selectedCount,
  search,
  columnControl,
  densityControl,
  exportControl,
  sortReset,
  linkComponent,
  onNavigate,
  extra,
  className,
  searchClassName = "tpz-search",
}: {
  state: TableState
  update: (next: (current: TableState) => TableState) => void
  columns: TableColumn<TRow>[]
  hiddenColumns: TableColumn<TRow>[]
  total: number
  selectedCount: number
  search: SearchOptions | undefined
  columnControl: boolean
  densityControl: boolean
  exportControl: { onDownload: () => void; onCopy?: () => void } | undefined
  /**
   * Puts the sort back to the one the table rests in. Given only while the
   * sort is somewhere else, and with an `href` when the table's controls are
   * links.
   */
  sortReset?: { onReset: () => void; href?: string }
  /** The caller's link component, for the controls that are links. */
  linkComponent?: LinkComponent
  /** Takes a plain click on one of those links, when there is no link component. */
  onNavigate?: (href: string, event: React.MouseEvent) => void
  extra?: React.ReactNode
  className: string
  /** The resolved `search` slot class. */
  searchClassName?: string
}) {
  const anything = search || columnControl || densityControl || exportControl || extra
  if (!anything && state.filters.length === 0) return null

  return (
    <div className={className}>
      <div className="tpz-toolbar-group">
        <span className="tpz-count" aria-live="polite">
          {selectedCount > 0
            ? `${selectedCount.toLocaleString()} selected`
            : `${total.toLocaleString()} ${total === 1 ? "row" : "rows"}`}
        </span>

        <FilterChips state={state} update={update} columns={columns} />
      </div>

      <div className="tpz-toolbar-group">
        {/*
          First in the group, which is aligned to the far edge: arriving here
          it moves nothing, where arriving at the end would push the search box
          and every button along by its own width each time a column is sorted.

          Only in a toolbar that is there anyway. Conjuring one up for this
          alone would shove the header down from under the pointer on the very
          click that sorted it.
        */}
        {anything && sortReset && (
          <SortReset reset={sortReset} linkComponent={linkComponent} onNavigate={onNavigate} />
        )}

        {extra}

        {search && <SearchBox state={state} update={update} options={search} className={searchClassName} />}

        {columnControl && (
          <ColumnMenu update={update} columns={columns} hiddenColumns={hiddenColumns} />
        )}

        {densityControl && <DensityMenu state={state} update={update} />}

        {exportControl && (
          <Menu
            align="end"
            label="Export"
            trigger={(props) => (
              <button type="button" className="tpz-btn tpz-btn-icon" aria-label="Export" {...props}>
                <Icon name="download" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Icon name="download" />}
                  onSelect={() => {
                    exportControl.onDownload()
                    close()
                  }}
                >
                  Download CSV
                </MenuItem>
                {exportControl.onCopy && (
                  <MenuItem
                    icon={<Icon name="copy" />}
                    onSelect={() => {
                      exportControl.onCopy?.()
                      close()
                    }}
                  >
                    Copy to clipboard
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  )
}

/**
 * The way back from a sort.
 *
 * A link when the table's controls are links, so a server-rendered table can
 * be put back in order before its JavaScript has arrived.
 */
function SortReset({
  reset,
  linkComponent: Link,
  onNavigate,
}: {
  reset: { onReset: () => void; href?: string }
  linkComponent?: LinkComponent
  onNavigate?: (href: string, event: React.MouseEvent) => void
}) {
  const props = {
    className: "tpz-btn tpz-btn-icon tpz-sort-reset",
    "aria-label": "Reset sort",
    title: "Reset sort",
    children: <Icon name="reset" />,
  }

  if (!reset.href) {
    return (
      <button
        type="button"
        {...props}
        onClick={(event) => {
          /*
            Pressing it takes it off the screen, and focus with it. For someone
            working the keyboard that is being dropped at the top of the
            document, so focus is handed to the control beside it first. A
            mouse has no such problem, and would only be puzzled by the search
            box lighting up.
          */
          const next = isKeyboardFocused(event.currentTarget) ? controlAfter(event.currentTarget) : undefined
          reset.onReset()
          next?.focus()
        }}
      />
    )
  }

  if (Link) return <Link href={reset.href} {...props} />
  return <a href={reset.href} {...props} onClick={routeClick(reset.href, onNavigate)} />
}

/** Whether an element has the kind of focus a keyboard gives, as far as the browser will say. */
function isKeyboardFocused(element: Element): boolean {
  try {
    return element.matches(":focus-visible")
  } catch {
    // An engine that does not know the selector cannot tell, and then nothing is moved.
    return false
  }
}

/** The next control along in the same group that can take focus. */
function controlAfter(element: Element): HTMLElement | undefined {
  const focusable = "button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]"

  for (let sibling = element.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    const control = sibling.matches(focusable) ? sibling : sibling.querySelector(focusable)
    if (control instanceof HTMLElement) return control
  }
  return undefined
}

/**
 * The search box.
 *
 * Debounced, and the debounce is here rather than in the core because it is a
 * property of a person typing, not of a table. Typing is local state until it
 * settles, so the table is not re-rendered on every keystroke.
 */
function SearchBox({
  state,
  update,
  options,
  className,
}: {
  state: TableState
  update: (next: (current: TableState) => TableState) => void
  options: SearchOptions
  className: string
}) {
  const [value, setValue] = useState(state.search)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const committed = useRef(state.search)

  // The search can also be changed from outside — a cleared filter set, the
  // back button, a saved view — and the box has to follow when it is.
  useEffect(() => {
    if (state.search !== committed.current) {
      committed.current = state.search
      setValue(state.search)
    }
  }, [state.search])

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = (next: string) => {
    committed.current = next
    update((current) => setSearch(current, next))
  }

  return (
    <div className={className}>
      <Icon name="search" className="tpz-search-icon" />
      <input
        type="search"
        className="tpz-input"
        placeholder={options.placeholder ?? "Search"}
        aria-label={options.placeholder ?? "Search"}
        value={value}
        onChange={(event) => {
          const next = event.target.value
          setValue(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => commit(next), options.debounce ?? 150)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            clearTimeout(timer.current)
            commit(value)
          }
          if (event.key === "Escape" && value !== "") {
            // Stopped and prevented: a native dialog closes on the key's
            // default action, which stopping its propagation does not touch.
            event.stopPropagation()
            event.preventDefault()
            setValue("")
            clearTimeout(timer.current)
            commit("")
          }
        }}
      />
    </div>
  )
}

/** Which columns are shown, and in what order. */
function ColumnMenu<TRow extends AnyRow>({
  update,
  columns,
  hiddenColumns,
}: {
  update: (next: (current: TableState) => TableState) => void
  columns: TableColumn<TRow>[]
  hiddenColumns: TableColumn<TRow>[]
}) {
  return (
    <Menu
      align="end"
      label="Columns"
      width={220}
      trigger={(props) => (
        <button type="button" className="tpz-btn" {...props}>
          <Icon name="columns" />
          Columns
        </button>
      )}
    >
      {() => (
        <div className="tpz-menu-scroll">
          <MenuLabel>Shown</MenuLabel>
          {columns.map((column) => (
            <ShownColumn
              key={column.key}
              column={column}
              columns={columns}
              update={update}
            />
          ))}

          {hiddenColumns.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>Hidden</MenuLabel>
              {hiddenColumns.map((column) => (
                <label key={column.key} className="tpz-filter-option">
                  <input
                    type="checkbox"
                    className="tpz-checkbox"
                    checked={false}
                    onChange={() => update((current) => showColumn(current, column.key))}
                  />
                  <Icon name={column.icon} />
                  <span className="tpz-filter-option-label">{column.header || column.key}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </Menu>
  )
}

function DensityMenu({
  state,
  update,
}: {
  state: TableState
  update: (next: (current: TableState) => TableState) => void
}) {
  const options: Array<{ value: Density; label: string }> = [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "relaxed", label: "Relaxed" },
  ]

  return (
    <Menu
      align="end"
      label="Row height"
      trigger={(props) => (
        <button type="button" className="tpz-btn tpz-btn-icon" aria-label="Row height" {...props}>
          <Icon name="longText" />
        </button>
      )}
    >
      {(close) => (
        <>
          {options.map((option) => (
            <MenuItem
              key={option.value}
              icon={state.density === option.value ? <Icon name="check" /> : <span style={{ width: 14 }} />}
              onSelect={() => {
                update((current) => setDensity(current, option.value))
                close()
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  )
}

/**
 * The filters currently applied, as removable chips.
 *
 * Written as a sentence — "Plan is any of Pro, Team" — because that is how
 * people read them back, and a row of `plan in [pro,team]` is a query, not an
 * explanation.
 */
function FilterChips<TRow extends AnyRow>({
  state,
  update,
  columns,
}: {
  state: TableState
  update: (next: (current: TableState) => TableState) => void
  columns: TableColumn<TRow>[]
}) {
  if (state.filters.length === 0) return null

  const describe = (filter: ColumnFilter): string => {
    const column = columns.find((entry) => entry.key === filter.key)
    const name = column?.header ?? filter.key
    const operator = OPERATOR_LABELS[filter.operator] ?? filter.operator
    if (filter.value === undefined) return `${name} ${operator}`

    const options = column?.formatOptions?.options
    const value = Array.isArray(filter.value)
      ? filter.value.map((entry) => optionLabel(entry, options)).join(", ")
      : optionLabel(filter.value, options)

    return `${name} ${operator} ${value}`
  }

  return (
    <div className="tpz-chips">
      {state.filters.map((filter, index) => (
        <span key={`${filter.key}-${String(index)}`} className="tpz-chip">
          {describe(filter)}
          <button
            type="button"
            className="tpz-chip-remove"
            aria-label={`Remove filter on ${columns.find((entry) => entry.key === filter.key)?.header ?? filter.key}`}
            onClick={() => update((current) => removeFilterAt(current, index))}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}

      {state.filters.length > 1 && (
        <button
          type="button"
          className="tpz-btn"
          onClick={() =>
            update((current) => ({ ...current, match: current.match === "all" ? "any" : "all", page: 1 }))
          }
        >
          {/* Reads as the rule being applied, not as a setting to decode. */}
          {state.match === "all" ? "Match all" : "Match any"}
        </button>
      )}

      <button type="button" className="tpz-btn" onClick={() => update(clearFilters)}>
        Clear
      </button>
    </div>
  )
}

/**
 * One row of the column list.
 *
 * Draggable, because a list of columns is the other place people expect to be
 * able to reorder them — and the one that works when the column you want to
 * move is scrolled off the side of the table.
 */
function ShownColumn<TRow extends AnyRow>({
  column,
  columns,
  update,
}: {
  column: TableColumn<TRow>
  columns: TableColumn<TRow>[]
  update: (next: (current: TableState) => TableState) => void
}) {
  const [dropEdge, setDropEdge] = useState<"before" | "after" | undefined>()
  const [dragging, setDragging] = useState(false)

  const keys = columns.map((entry) => entry.key)
  const reorderable = column.reorderable !== false && !column.pin

  return (
    <label
      className="tpz-filter-option"
      draggable={reorderable}
      data-dragging={dragging ? "true" : undefined}
      data-drop={dropEdge}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/tpz-column", column.key)
        event.dataTransfer.effectAllowed = "move"
        setDragging(true)
      }}
      onDragEnd={() => {
        setDragging(false)
        setDropEdge(undefined)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        setDropEdge(event.clientY < rect.top + rect.height / 2 ? "before" : "after")
      }}
      onDragLeave={() => setDropEdge(undefined)}
      onDrop={(event) => {
        event.preventDefault()
        const edge = dropEdge ?? "before"
        setDropEdge(undefined)

        const dragged = event.dataTransfer.getData("text/tpz-column")
        if (!dragged || dragged === column.key) return

        update((current) => setOrder(current, reorderColumnTo(keys, dragged, column.key, edge)))
      }}
    >
      {reorderable && <Icon name="grip" className="tpz-grip" />}
      <input
        type="checkbox"
        className="tpz-checkbox"
        checked
        // The last visible column cannot be hidden: a table with no columns is
        // a box of nothing, and the way back is not obvious.
        disabled={columns.length === 1}
        onChange={() => update((current) => toggleColumn(current, column.key))}
      />
      <Icon name={column.icon} />
      <span className="tpz-filter-option-label">{column.header || column.key}</span>
    </label>
  )
}
