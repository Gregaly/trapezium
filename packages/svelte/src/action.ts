import { createTable, type TableInstance, type TableOptions } from "@trapezium/vanilla"
import type { AnyRow } from "@trapezium/core"

/**
 * The table as a Svelte action.
 *
 * ```svelte
 * <div use:trapezium={{ data: users, search: true }}></div>
 * ```
 *
 * The component in this package is a thin wrapper around this, and the action
 * is exported in its own right because it needs no compiler, works in any
 * Svelte version, and is the right primitive when you want the table inside
 * markup you already control.
 */
export function trapezium<TRow extends AnyRow>(
  node: HTMLElement,
  options: TableOptions<TRow>,
): { update(next: TableOptions<TRow>): void; destroy(): void } {
  let table: TableInstance<TRow> | undefined = createTable(node, options)
  let previous = options

  return {
    update(next) {
      // Replacing data is the common case and must not disturb the user's
      // sorting, filters or page — so it takes the cheaper path.
      if (next.data !== previous.data && shallowSameOptions(previous, next)) table?.setData(next.data)
      else table?.setOptions(next)

      previous = next
    },
    destroy() {
      table?.destroy()
      table = undefined
    },
  }
}

/** True when only `data` differs, so the arrangement can be left alone. */
function shallowSameOptions<TRow extends AnyRow>(a: TableOptions<TRow>, b: TableOptions<TRow>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  keys.delete("data")

  for (const key of keys) {
    if (a[key as keyof TableOptions<TRow>] !== b[key as keyof TableOptions<TRow>]) return false
  }

  return true
}
