import type { ReactNode } from "react"

/**
 * The switches above each example.
 *
 * Deliberately part of the example rather than the library: a table library has
 * no business shipping a settings panel. What it is for is trying the props
 * without editing code — flip pagination to infinite, turn a column's filter
 * into a set filter, and watch what changes.
 */

export type Choice<T extends string> = { value: T; label: string }

export function Controls({ children }: { children: ReactNode }) {
  return <div className="controls">{children}</div>
}

/** An on/off switch. */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

/** A row of mutually exclusive choices, which reads better than a select for three or four. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Choice<T>[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      <span className="segmented-label">{label}</span>
      <div className="segmented-options" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-active={option.value === value}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
