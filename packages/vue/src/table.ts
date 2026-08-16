import {
  defineComponent,
  h,
  isVNode,
  onBeforeUnmount,
  onMounted,
  ref,
  render as renderVNode,
  watch,
  type PropType,
  type VNode,
} from "vue"
import { createTable, type TableInstance, type TableOptions } from "@trapezium/vanilla"
import type {
  AnyRow,
  CellContext,
  ColumnDef,
  Density,
  FormatContext,
  PaginationOptions,
  PartialTableState,
  TableState,
  TypeDef,
} from "@trapezium/core"

/**
 * The table, for Vue 3.
 *
 * It wraps the DOM renderer rather than reimplementing it, which is a
 * deliberate choice: one implementation of the markup means a fix to a border,
 * a sticky offset or a keyboard path lands in every framework at once, instead
 * of four copies drifting apart. Vue's job here is reactivity and lifecycle,
 * which is exactly what Vue is for.
 *
 * A cell renderer may return a VNode, a DOM node or a string. VNodes are
 * rendered into their own container with Vue's own renderer, so a custom cell
 * is a real Vue component with props, events and the app's context — not a
 * string of HTML.
 */

export type VueColumn<TRow extends AnyRow = AnyRow> = Omit<ColumnDef<TRow, unknown>, "render" | "renderHeader"> & {
  render?: (context: CellContext<TRow, unknown>) => VNode | Node | string
}

export const Table = defineComponent({
  name: "TrapeziumTable",

  props: {
    data: { type: Array as PropType<readonly AnyRow[]>, required: true },
    columns: { type: Array as PropType<readonly (VueColumn | string)[]>, default: undefined },
    getRowId: { type: Function as PropType<(row: AnyRow, index: number) => string>, default: undefined },

    state: { type: Object as PropType<PartialTableState>, default: undefined },

    /**
     * The rows have already been filtered, sorted and paginated by a server.
     *
     * Pass an object instead of `true` to say where the values behind a set
     * filter and the rows behind an export come from — `{ distinct, all }`.
     */
    server: { type: [Boolean, Object] as PropType<TableOptions["server"]>, default: false },
    total: { type: Number, default: undefined },
    loading: { type: Boolean, default: false },
    error: { type: String, default: undefined },

    search: { type: [Boolean, Object] as PropType<TableOptions["search"]>, default: false },
    filters: { type: Boolean, default: true },
    sortable: { type: Boolean, default: true },
    resizable: { type: Boolean, default: true },
    reorderable: { type: Boolean, default: true },
    columnMenu: { type: Boolean, default: true },
    columnControl: { type: Boolean, default: true },
    pagination: { type: [Boolean, Object] as PropType<boolean | PaginationOptions>, default: true },
    selection: { type: [Boolean, String] as PropType<boolean | "single" | "multiple">, default: false },
    export: { type: [Boolean, Object] as PropType<TableOptions["export"]>, default: false },

    types: { type: Object as PropType<Record<string, TypeDef>>, default: undefined },
    format: { type: Object as PropType<Partial<FormatContext>>, default: undefined },
    density: { type: String as PropType<Density>, default: undefined },
    /** Offer the row-height switch in the toolbar. Defaults to false. */
    densityControl: { type: Boolean, default: false },
    responsive: { type: String as PropType<"scroll" | "cards">, default: "scroll" },
    stickyHeader: { type: Boolean, default: true },
    maxHeight: { type: [Number, String], default: undefined },
    theme: { type: String as PropType<"light" | "dark">, default: undefined },

    rowHref: { type: Function as PropType<(row: AnyRow) => string>, default: undefined },
    rowClassName: { type: Function as PropType<(row: AnyRow, index: number) => string | undefined>, default: undefined },
    emptyMessage: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
  },

  emits: {
    "update:state": (state: TableState) => true,
    selectionChange: (ids: string[], rows: AnyRow[]) => true,
    rowClick: (row: AnyRow, event: MouseEvent) => true,
  },

  setup(props, { emit }) {
    const host = ref<HTMLElement | null>(null)
    let table: TableInstance | undefined

    /*
      Containers holding a mounted VNode. Vue will not unmount them on its own —
      they are outside its tree — so they are tracked and torn down before every
      rebuild. Without this a table that re-renders a thousand times leaks a
      thousand component instances.
    */
    let mounted: HTMLElement[] = []

    const releaseVNodes = () => {
      for (const container of mounted) renderVNode(null, container)
      mounted = []
    }

    /** Wraps the caller's renderers so a VNode becomes a real DOM node. */
    const adaptColumns = () =>
      props.columns?.map((column) => {
        if (typeof column === "string" || !column.render) return column
        const render = column.render

        return {
          ...column,
          render: (context: CellContext<AnyRow, unknown>) => {
            const result = render(context)
            if (!isVNode(result)) return result

            const container = document.createElement("span")
            renderVNode(result, container)
            mounted.push(container)
            return container
          },
        }
      })

    const options = (): TableOptions => ({
      data: props.data,
      columns: adaptColumns() as TableOptions["columns"],
      getRowId: props.getRowId,
      state: props.state,
      server: props.server,
      total: props.total,
      loading: props.loading,
      error: props.error,
      search: props.search,
      filters: props.filters,
      sortable: props.sortable,
      resizable: props.resizable,
      reorderable: props.reorderable,
      columnMenu: props.columnMenu,
      columnControl: props.columnControl,
      pagination: props.pagination,
      selection: props.selection,
      export: props.export,
      types: props.types,
      format: props.format,
      density: props.density,
      densityControl: props.densityControl,
      responsive: props.responsive,
      stickyHeader: props.stickyHeader,
      maxHeight: props.maxHeight,
      theme: props.theme,
      rowHref: props.rowHref,
      rowClassName: props.rowClassName,
      emptyMessage: props.emptyMessage,
      ariaLabel: props.ariaLabel,
      onStateChange: (state) => emit("update:state", state),
      onSelectionChange: (ids, rows) => emit("selectionChange", ids, rows),
      onRowClick: (row, event) => emit("rowClick", row, event),
    })

    onMounted(() => {
      if (host.value) table = createTable(host.value, options())
    })

    // Data changes far more often than anything else, and replacing it must not
    // disturb the arrangement — so it has its own watcher and its own path.
    watch(
      () => props.data,
      (data) => {
        releaseVNodes()
        table?.setData(data)
      },
    )

    watch(
      () => [
        props.columns,
        props.state,
        props.loading,
        props.error,
        props.total,
        props.search,
        props.pagination,
        props.selection,
        props.density,
        props.densityControl,
        props.theme,
        props.responsive,
        props.format,
        props.types,
      ],
      () => {
        releaseVNodes()
        table?.setOptions(options())
      },
      { deep: true },
    )

    onBeforeUnmount(() => {
      releaseVNodes()
      table?.destroy()
      table = undefined
    })

    return { host, instance: () => table }
  },

  render() {
    return h("div", { ref: "host", class: "tpz-host" })
  },
})
