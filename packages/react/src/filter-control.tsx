import { useMemo, useState } from "react"
import {
  OPERATOR_LABELS,
  distinctValues,
  isListOperator,
  needsValue,
  type AnyRow,
  type ColumnFilter,
  type FilterOperator,
} from "@trapezium/core"

import type { TableColumn } from "./types.js"

/**
 * The filter for one column.
 *
 * Which control appears is decided by the column's type, and which comparisons
 * it offers are too — a checkbox never offers "is more than", a date never
 * offers "contains". Offering a question the data cannot answer is worse than
 * offering none.
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
  onApply,
  onClear,
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
  onApply: (filter: ColumnFilter) => void
  onClear: () => void
}) {
  if (column.filterKind === "set") {
    return <SetFilter column={column} filter={filter} rows={rows} label={label} onApply={onApply} onClear={onClear} />
  }
  if (column.filterKind === "boolean") {
    return <BooleanFilter filter={filter} column={column} onApply={onApply} onClear={onClear} />
  }
  return <ValueFilter column={column} filter={filter} onApply={onApply} onClear={onClear} />
}

/** Operator plus a value, for text, numbers and dates. */
function ValueFilter<TRow extends AnyRow>({
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
  const [operator, setOperator] = useState<FilterOperator>(filter?.operator ?? column.operators[0] ?? "contains")
  const [value, setValue] = useState(() => firstValue(filter))
  const [second, setSecond] = useState(() => secondValue(filter))

  const inputType = column.filterKind === "date" ? "date" : column.filterKind === "range" ? "number" : "text"
  const wantsValue = needsValue(operator)
  const isBetween = operator === "between"
  const isList = isListOperator(operator)

  const apply = () => {
    if (!wantsValue) {
      onApply({ key: column.key, operator })
      return
    }
    if (value.trim() === "") {
      onClear()
      return
    }

    onApply({
      key: column.key,
      operator,
      value: isBetween
        ? [value.trim(), second.trim()]
        : isList
          ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
          : value.trim(),
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
        {column.operators.map((entry) => (
          <option key={entry} value={entry}>
            {OPERATOR_LABELS[entry]}
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
          <button type="button" className="tpz-btn" onClick={onClear}>
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
  onApply,
  onClear,
}: {
  column: TableColumn<TRow>
  filter: ColumnFilter | undefined
  rows: readonly TRow[]
  label: (value: unknown) => string
  onApply: (filter: ColumnFilter) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState("")

  const choices = useMemo(() => {
    const configured = column.formatOptions?.options
    if (configured?.length) {
      return configured.map((option) => ({ value: option.value, label: option.label ?? option.value }))
    }

    // Otherwise the choices are the values actually present, labelled the way
    // the column labels them.
    return distinctValues(rows.map((row) => column.accessor(row))).map((entry) => ({
      value: entry.value,
      label: label(entry.value) || entry.value,
    }))
  }, [column, rows, label])

  const selected = new Set(
    filter && Array.isArray(filter.value) ? filter.value.map(String) : filter?.value !== undefined ? [String(filter.value)] : [],
  )

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)

    if (next.size === 0) onClear()
    else onApply({ key: column.key, operator: next.size === 1 ? "eq" : "in", value: [...next] })
  }

  const visible = query
    ? choices.filter((choice) => choice.label.toLowerCase().includes(query.toLowerCase()))
    : choices

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
        {visible.length === 0 && <p className="tpz-menu-label">No values</p>}
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

      {filter && (
        <div className="tpz-filter-actions">
          <button type="button" className="tpz-btn" onClick={onClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
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
  const current = filter?.value === undefined ? "" : String(filter.value)

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
