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
  import type { TableOptions } from "@trapezium/vanilla"
  import type { AnyRow, TableState } from "@trapezium/core"

  type Props = TableOptions<AnyRow> & {
    /** Bindable: the table writes its state here whenever anything changes. */
    tableState?: TableState
  }

  let { tableState = $bindable(), ...options }: Props = $props()

  const settings = $derived({
    ...options,
    onStateChange: (next: TableState) => {
      tableState = next
      options.onStateChange?.(next)
    },
  })
</script>

<div use:trapezium={settings}></div>
