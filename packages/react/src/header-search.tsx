import { useEffect, useRef, useState } from "react"

import { Icon } from "./icon.js"

/**
 * Searching a column from its header.
 *
 * Two pieces, because they live in different places: the magnifier sits in the
 * header beside the sort control, and the box it opens is laid over the whole
 * header cell. Nothing here knows what a search *does* — it is handed the text
 * the column is being searched for and says when that should change, so the
 * filter it becomes is decided in one place, by the core.
 */

/** The magnifier. Out of sight until the header is hovered, focused or already searched. */
export function HeaderSearchTrigger({
  header,
  text,
  onOpen,
  buttonRef,
}: {
  /** The column's header text, which names the control. */
  header: string
  /** What the column is being searched for, or `""`. */
  text: string
  onOpen: () => void
  buttonRef: React.Ref<HTMLButtonElement>
}) {
  const label = text === "" ? `Search ${header}` : `Search ${header}, searching for ${text}`

  return (
    <button
      ref={buttonRef}
      type="button"
      className="tpz-th-search"
      aria-label={label}
      title={label}
      data-active={text === "" ? undefined : "true"}
      onClick={onOpen}
    >
      <Icon name="search" size={12} />
    </button>
  )
}

/**
 * The box.
 *
 * Typing is local until it settles, the same way the toolbar's search is: the
 * table is not re-filtered on every keystroke, and the wait belongs to a
 * person typing rather than to the table.
 *
 * It closes when focus leaves it, keeping whatever was typed as the column's
 * search. Enter applies at once and closes; Escape empties a box that has
 * something in it and closes one that does not — the same two steps the
 * toolbar's search takes.
 */
export function HeaderSearchBox({
  header,
  text,
  debounce,
  onSearch,
  onClose,
}: {
  /** The column's header text: the box's placeholder, and its name. */
  header: string
  /** What the column is being searched for now, according to the table. */
  text: string
  /** Milliseconds to wait after a keystroke. */
  debounce: number
  onSearch: (text: string) => void
  /** `true` when focus should go back to the magnifier — the keyboard put it here. */
  onClose: (returnFocus: boolean) => void
}) {
  const [value, setValue] = useState(text)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const committed = useRef(text)

  // The search can change from outside while the box is open — its chip
  // removed, the back button pressed — and the box has to follow when it does.
  useEffect(() => {
    if (text !== committed.current) {
      committed.current = text
      setValue(text)
    }
  }, [text])

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = (next: string) => {
    clearTimeout(timer.current)
    const query = next.trim()
    if (query === committed.current) return
    committed.current = query
    onSearch(query)
  }

  return (
    <div
      className="tpz-th-searchbox"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        // The window lost focus, not the box: it is still where the person
        // will be typing when they come back.
        if (!event.currentTarget.ownerDocument.hasFocus()) return
        commit(value)
        onClose(false)
      }}
    >
      <span className="tpz-th-icon" aria-hidden="true">
        <Icon name="search" />
      </span>
      <input
        type="text"
        role="searchbox"
        className="tpz-th-search-input"
        placeholder={header}
        aria-label={`Search ${header}`}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        autoFocus
        onChange={(event) => {
          const next = event.target.value
          setValue(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => commit(next), debounce)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(value)
            onClose(true)
          }
          if (event.key === "Escape") {
            // Handled here either way, so a dialog the table sits in does not
            // close because somebody dismissed a search box.
            event.stopPropagation()
            if (value === "") {
              // Emptied by hand a moment ago, perhaps, with the wait still running.
              commit("")
              onClose(true)
              return
            }
            setValue("")
            commit("")
          }
        }}
      />
      <button
        type="button"
        className="tpz-th-search-clear"
        aria-label={`Clear search on ${header}`}
        onClick={() => {
          commit("")
          onClose(true)
        }}
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  )
}
