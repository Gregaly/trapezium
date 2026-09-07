<script lang="ts">
  /**
   * The table, for Svelte 5.
   *
   * It wraps the DOM renderer rather than reimplementing it, so a fix to a
   * border, a sticky offset or a keyboard path lands in every framework at
   * once. Svelte's job here is reactivity and lifecycle.
   *
   * A cell renderer returns a DOM node or a string. To render a Svelte
   * component in a cell, mount it yourself:
   *
   *     import { mount } from "svelte"
   *     render: ({ row }) => {
   *       const host = document.createElement("span")
   *       mount(Chip, { target: host, props: { row } })
   *       return host
   *     }
   */
  import { trapezium } from "./action.js"
  import { renderToString, type TableOptions } from "@trapezium/vanilla"
  import type { AnyRow, CellContext, TableState } from "@trapezium/core"

  type Props = TableOptions<AnyRow> & {
    /** Bindable: the table writes its state here whenever anything changes. */
    tableState?: TableState
  }

  let { tableState = $bindable(), onStateChange, ...options }: Props = $props()

  /*
    One handler for the life of the component. The action takes the cheap path
    — replace the rows, keep the arrangement — only when every option but
    `data` is the same object as before, and a handler made afresh on every
    change would make that never true.
  */
  const reportState = (next: TableState) => {
    tableState = next
    onStateChange?.(next)
  }

  const settings = $derived({ ...options, onStateChange: reportState })

  /*
    The table as HTML, for the first paint.

    Written once, the same way on the server and in the browser, so the markup
    Svelte hydrates is the markup it rendered; the action then replaces it with
    the live table — the same bytes, so nothing moves. A cell renderer that
    builds a DOM node cannot run on a server, so a cell is written as its text
    unless the renderer returned a string.
  */
  const initial = renderToString({
    ...options,
    columns: options.columns?.map((column) => {
      if (typeof column === "string" || !column.render) return column
      const render = column.render
      return {
        ...column,
        render: (context: CellContext<AnyRow, Node | string>) => {
          try {
            const result = render(context)
            return typeof result === "string" ? result : context.text
          } catch {
            return context.text
          }
        },
      }
    }),
  })
</script>

<div use:trapezium={settings}>{@html initial}</div>
