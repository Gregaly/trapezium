import { useEffect, useMemo, useState } from "react"
import {
  OPERATOR_LABELS,
  distinctValues,
  filterInputType,
  isListOperator,
  needsValue,
  rangeFilter,
  toSelectOptions,
  type AnyRow,
  type ColumnFilter,
  type FilterOperator,
  type FilterOptionsProvider,
  type SelectOption,
} from "@trapezium/core"

import type { TableColumn } from "./types.js"

/**
 * The filter for one column.
 *
 * Which control appears is decided by the column's type, and which comparisons
 * it offers are too — a checkbox never offers "is more than". Offering a
 * question the data cannot answer is worse than offering none. (A column that
 * is searched from its header does offer "contains", whatever its type: that
 * search is answered from the text the cells show, so the question has an
 * answer.)
 *
 * It edits a draft and applies on a deliberate action, rather than filtering on
 * every keystroke: a table that reflows under the cursor while somebody is
 * still typing the value is unusable on any real amount of data.
 */
export function FilterControl<TRow extends AnyRow>({
  column,
  filter,
  rows,
  label,
  fetchOptions,
  onApply,
  onClear,
  onDone,
}: {
  column: TableColumn<TRow>
  /** The filter already on this column, if any. */
  filter: ColumnFilter | undefined
  /** Every row the table was given, for deriving the choices in a set filter. */
  rows: readonly TRow[]
  /**
   * How a stored value reads on screen.
   *
   * The same function the cells use, so a set filter offers "Blocker" rather
   * than "blocker" — including for a custom type, whose formatter is the only
   * thing that knows the difference.
   */
  label: (value: unknown) => string
  /** Asks the server what values this column has, when the table knows how. */
  fetchOptions?: FilterOptionsProvider
  onApply: (filter: ColumnFilter) => void
  onClear: () => void
  /**
   * Called after the control's own "Clear" button, once the filter has gone —
   * for a panel that should close behind it. Not called when a set filter's
   * last box is unticked, which clears the filter but is not somebody saying
   * they have finished.
   */
  onDone?: () => void
}) {
  if (column.filterKind === "set") {
    return (
      <SetFilter
        column={column}
        filter={filter}
        rows={rows}
        label={label}
        fetchOptions={fetchOptions}
        onApply={onApply}
        onClear={onClear}
        onDone={onDone}
      />
    )
  }
  if (column.filterKind === "boolean") {
    return <BooleanFilter filter={filter} column={column} onApply={onApply} onClear={onClear} />
  }
  return <ValueFilter column={column} filter={filter} onApply={onApply} onClear={onClear} onDone={onDone} />
}

/** Operator plus a value, for text, numbers and dates. */
function ValueFilter<TRow extends AnyRow>({
  column,
  filter,
  onApply,
  onClear,
  onDone,
}: {
  column: TableColumn<TRow>
  filter: ColumnFilter | undefined
  onApply: (filter: ColumnFilter) => void
  onClear: () => void
  onDone?: () => void
}) {
  const [operator, setOperator] = useState<FilterOperator>(filter?.operator ?? column.operators[0] ?? "contains")
  const [value, setValue] = useState(() => firstValue(filter))
  const [second, setSecond] = useState(() => secondValue(filter))

  /*
    The filter on the column may be one its type does not list — a link somebody
    edited, or a `contains` that a header search made before the column's
    configuration changed. It is offered here anyway: a panel that silently
    showed a different operator from the one in force would be describing a
    filter that is not the one applied.
  */
  const operators =
    filter && !column.operators.includes(filter.operator) ? [...column.operators, filter.operator] : column.operators

  // A date picker cannot hold "Aug", a number box cannot hold "1,2" or a time
  // of day: the box follows the operator and the column, by the core's rule.
  const inputType = filterInputType(column, operator)
  const wantsValue = needsValue(operator)
  const isBetween = operator === "between"
  const isList = isListOperator(operator)

  const apply = () => {
    if (!wantsValue) {
      onApply({ key: column.key, operator })
      return
    }

    if (isBetween) {
      // One end filled in is "at least" or "at most"; neither is no filter.
      const range = rangeFilter(column.key, value, second)
      if (range) onApply(range)
      else onClear()
      return
    }

    if (value.trim() === "") {
      onClear()
      return
    }

    onApply({
      key: column.key,
      operator,
      value: isList ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : value.trim(),
    })
  }

  return (
    <div className="tpz-filter" onKeyDown={(event) => event.key === "Enter" && apply()}>
      <select
        className="tpz-input"
        aria-label={`How to filter ${column.header}`}
        value={operator}
        onChange={(event) => setOperator(event.target.value as FilterOperator)}
      >
        {operators.map((entry) => (
          <option key={entry} value={entry}>
            {/* An operator nobody defined can still arrive in a link; it is shown as written. */}
            {OPERATOR_LABELS[entry] ?? entry}
          </option>
        ))}
      </select>

      {wantsValue && (
        <input
          className="tpz-input"
          type={inputType}
          inputMode={inputType === "number" ? "decimal" : undefined}
          aria-label={`Filter ${column.header} by`}
          placeholder={isList ? "Separate with commas" : "Value"}
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
        />
      )}

      {wantsValue && isBetween && (
        <input
          className="tpz-input"
          type={inputType}
          aria-label={`Filter ${column.header} up to`}
          placeholder="and"
          value={second}
          onChange={(event) => setSecond(event.target.value)}
        />
      )}

      <div className="tpz-filter-actions">
        <button type="button" className="tpz-btn" data-variant="primary" onClick={apply}>
          Apply
        </button>
        {filter && (
          <button
            type="button"
            className="tpz-btn"
            onClick={() => {
              onClear()
              onDone?.()
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The checkbox list of values actually present in the column.
 *
 * The thing spreadsheet users reach for first, and the one most table libraries
 * leave out. The choices come from the data rather than from configuration, so
 * a column nobody described still gets a useful filter.
 */
function SetFilter<TRow extends AnyRow>({
  column,
  filter,
  rows,
  label,
  fetchOptions,
  onApply,
  onClear,
  onDone,
}: {
  column: TableColumn<TRow>
  filter: ColumnFilter | undefined
  rows: readonly TRow[]
  label: (value: unknown) => string
  fetchOptions?: FilterOptionsProvider
  onApply: (filter: ColumnFilter) => void
  onClear: () => void
  onDone?: () => void
}) {
  const [query, setQuery] = useState("")
  // The column's own list first; failing that, whatever the table was told to
  // ask the server.
  const fetched = useFetchedOptions(column.filterOptions ?? fetchOptions)

  const choices = useMemo(() => {
    /*
      Three places choices can come from, in order of how much they know:
      the column's own list (or one it fetched), the labels it renders cells
      with, and — failing both — the values actually in the data, which is
      everything in client mode and one page in server mode.
    */
    const given = Array.isArray(column.filterOptions) ? column.filterOptions : fetched.options
    const configured = given ?? column.formatOptions?.options

    if (configured?.length) {
      return configured.map((option) => ({ value: option.value, label: option.label ?? option.value }))
    }

    return distinctValues(rows.map((row) => column.accessor(row))).map((entry) => ({
      value: entry.value,
      label: label(entry.value) || entry.value,
    }))
  }, [column, rows, label, fetched.options])

  /*
    Only a filter this panel could have made is read back as ticks. A column
    searched from its header carries `contains "act"`, and reading that as a
    choice called "act" would tick nothing — and then fold the stray word into
    the list the moment a real box was ticked.
  */
  const chosen = filter && (filter.operator === "eq" || filter.operator === "in") ? filter.value : undefined
  const selected = new Set(Array.isArray(chosen) ? chosen.map(String) : chosen !== undefined ? [String(chosen)] : [])

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)

    if (next.size === 0) onClear()
    else onApply({ key: column.key, operator: next.size === 1 ? "eq" : "in", value: [...next] })
  }

  /*
    Filtered over every distinct value, then cut down to what is worth drawing.
    Cutting the other way round — capping the list and searching the cap — is
    what makes a rare value impossible to find, which is the one thing a set
    filter must never do.
  */
  const matching = query
    ? choices.filter((choice) => matchesQuery(choice.label, query) || matchesQuery(choice.value, query))
    : choices

  const visible = matching.slice(0, RENDER_LIMIT)
  const hidden = matching.length - visible.length

  return (
    <div className="tpz-filter">
      {choices.length > 8 && (
        <input
          className="tpz-input"
          type="search"
          aria-label={`Search ${column.header} values`}
          placeholder="Search values"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />
      )}

      <div className="tpz-menu-scroll tpz-filter-list">
        {fetched.loading && <p className="tpz-menu-label">Loading values…</p>}
        {fetched.error && <p className="tpz-menu-label">Could not load the values</p>}
        {!fetched.loading && visible.length === 0 && <p className="tpz-menu-label">No values</p>}
        {visible.map((choice) => (
          <label key={choice.value} className="tpz-filter-option">
            <input
              type="checkbox"
              className="tpz-checkbox"
              checked={selected.has(choice.value)}
              onChange={() => toggle(choice.value)}
            />
            <span className="tpz-filter-option-label">{choice.label}</span>
          </label>
        ))}
      </div>

      {hidden > 0 && (
        <p className="tpz-menu-label">
          {`${hidden.toLocaleString()} more — keep typing to narrow them down`}
        </p>
      )}

      {filter && (
        <div className="tpz-filter-actions">
          <button
            type="button"
            className="tpz-btn"
            onClick={() => {
              onClear()
              onDone?.()
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * How many choices are drawn at once.
 *
 * Enough that a normal column shows all of it, few enough that a column of ten
 * thousand distinct values does not put ten thousand checkboxes in the
 * document. Everything beyond it is still searchable.
 */
const RENDER_LIMIT = 200

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

function BooleanFilter<TRow extends AnyRow>({
  column,
  filter,
  onApply,
  onClear,
}: {
  column: TableColumn<TRow>
  filter: ColumnFilter | undefined
  onApply: (filter: ColumnFilter) => void
  onClear: () => void
}) {
  // "Any" unless the filter is one this control makes: a search typed into
  // the header is not a yes or a no.
  const current = filter?.operator === "eq" && filter.value !== undefined ? String(filter.value) : ""

  return (
    <div className="tpz-filter">
      <select
        className="tpz-input"
        aria-label={`Filter ${column.header}`}
        value={current}
        onChange={(event) => {
          const value = event.target.value
          if (value === "") onClear()
          else onApply({ key: column.key, operator: "eq", value })
        }}
      >
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  )
}

function firstValue(filter: ColumnFilter | undefined): string {
  if (!filter || filter.value === undefined || filter.value === null) return ""
  if (!Array.isArray(filter.value)) return String(filter.value)

  // A range keeps its bounds in two inputs; a list shares one, comma separated.
  return filter.operator === "between"
    ? String(filter.value[0] ?? "")
    : filter.value.map(String).join(", ")
}

function secondValue(filter: ColumnFilter | undefined): string {
  return Array.isArray(filter?.value) && filter.value.length > 1 ? String(filter.value[1]) : ""
}

/**
 * Choices fetched on demand.
 *
 * A server-side table cannot know a column's domain — it holds one page — so
 * the caller supplies a function and it is called the first time the panel is
 * opened. The answer is remembered against the function itself, so opening the
 * panel again is free and changing the function fetches afresh.
 */
const remembered = new WeakMap<FilterOptionsProvider, SelectOption[]>()

function useFetchedOptions(source: TableColumn["filterOptions"]): {
  options: SelectOption[] | undefined
  loading: boolean
  error: boolean
} {
  const provider = typeof source === "function" ? source : undefined

  const [state, setState] = useState<{ options: SelectOption[] | undefined; loading: boolean; error: boolean }>(
    () => ({ options: provider ? remembered.get(provider) : undefined, loading: false, error: false }),
  )

  useEffect(() => {
    if (!provider || remembered.has(provider)) return

    let live = true
    setState({ options: undefined, loading: true, error: false })

    Promise.resolve(provider())
      .then((options) => {
        const choices = toSelectOptions(options)
        remembered.set(provider, choices)
        if (live) setState({ options: choices, loading: false, error: false })
      })
      .catch(() => {
        // Left unremembered, so opening the panel again tries once more.
        if (live) setState({ options: undefined, loading: false, error: true })
      })

    return () => {
      live = false
    }
  }, [provider])

  return state
}
