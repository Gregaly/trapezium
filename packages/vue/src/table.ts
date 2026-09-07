import {
  Teleport,
  computed,
  getCurrentInstance,
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
  type VNodeChild,
} from "vue"
import { createTable, el, renderToTree, type TableInstance, type TableOptions } from "@trapezium/vanilla"

import { treeToVNode } from "./vnodes.js"
import type {
  AnyRow,
  CellContext,
  ColumnDef,
  Density,
  FormatContext,
  PaginationOptions,
  PartialTableState,
  RowHeight,
  SelectionInput,
  TableSlots,
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
 *
 * The slots — `toolbar`, `appendRow`, `footer` and `empty` — are ordinary Vue
 * slots, teleported into the place the table keeps for them, so they stay
 * reactive like any other template.
 */

export type VueColumn<TRow extends AnyRow = AnyRow> = Omit<ColumnDef<TRow, unknown>, "render" | "renderHeader"> & {
  render?: (context: CellContext<TRow, unknown>) => VNode | Node | string
}

/** The slots a template can fill. `empty` lands in the table's `emptyState`. */
const SLOTS = ["toolbar", "appendRow", "footer", "empty"] as const
type SlotName = (typeof SLOTS)[number]

export const Table = defineComponent({
  name: "TrapeziumTable",

  props: {
    data: { type: Array as PropType<readonly AnyRow[]>, required: true },
    columns: { type: Array as PropType<readonly (VueColumn | string)[]>, default: undefined },
    getRowId: { type: Function as PropType<(row: AnyRow, index: number) => string>, default: undefined },

    /** Controlled state. Use `v-model:state`, or `:state` with `@update:state`. */
    state: { type: Object as PropType<PartialTableState>, default: undefined },
    /** Starting state for a table that manages its own — a saved view, a URL. Read once. */
    defaultState: { type: Object as PropType<PartialTableState>, default: undefined },

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
    /**
     * `true` means multiple. The object form adds `isSelectable`, for rows
     * that must stay unselected, and `onChange`.
     */
    selection: { type: [Boolean, String, Object] as PropType<SelectionInput<AnyRow>>, default: false },
    export: { type: [Boolean, Object] as PropType<TableOptions["export"]>, default: false },

    types: { type: Object as PropType<Record<string, TypeDef>>, default: undefined },
    format: { type: Object as PropType<Partial<FormatContext>>, default: undefined },
    density: { type: String as PropType<Density>, default: undefined },
    /** Offer the row-height switch in the toolbar. Defaults to false. */
    densityControl: { type: Boolean, default: false },
    responsive: { type: String as PropType<"scroll" | "cards">, default: "scroll" },
    stickyHeader: { type: Boolean, default: true },
    maxHeight: { type: [Number, String], default: undefined },
    /**
     * How tall a row is: `"fixed"` (the default), `"auto"`, or a number of
     * pixels.
     */
    rowHeight: { type: [String, Number] as PropType<RowHeight>, default: undefined },
    theme: { type: String as PropType<"light" | "dark">, default: undefined },

    rowHref: { type: Function as PropType<(row: AnyRow) => string>, default: undefined },
    rowClassName: { type: Function as PropType<(row: AnyRow, index: number) => string | undefined>, default: undefined },
    emptyMessage: { type: String, default: undefined },

    /**
     * Renders every control that changes the view as a link to this URL
     * instead of a button, so a server-rendered table sorts and pages before
     * its JavaScript arrives. Pair it with `stateFromUrl` for the state.
     */
    buildHref: { type: Function as PropType<(state: TableState) => string>, default: undefined },

    /** Added to the root element. */
    className: { type: String, default: undefined },
    /** Added per slot, on top of the defaults. */
    classNames: { type: Object as PropType<Partial<TableSlots>>, default: undefined },
    /** Drops the default classes so your own styling is the only styling. */
    unstyled: { type: Boolean, default: false },

    /** A visible caption above the table. */
    caption: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
  },

  emits: {
    "update:state": (state: TableState) => true,
    selectionChange: (ids: string[], rows: AnyRow[]) => true,
    rowClick: (row: AnyRow, event: MouseEvent) => true,
    /**
     * A plain click on one of the table's links, with the URL it points at.
     * Listening prevents the browser's navigation; hand the URL to the router.
     */
    navigate: (href: string, event: MouseEvent) => true,
  },

  setup(props, { emit, slots }) {
    const host = ref<HTMLElement | null>(null)
    let table: TableInstance | undefined

    /*
      Whether anyone is listening for a row click. A row with a click handler
      is marked and styled as clickable, so the handler is only passed on when
      the template has `@row-click` — otherwise every Vue table would have
      pointer cursors that React and plain JavaScript do not.
    */
    const instance = getCurrentInstance()
    const listensForRowClick = () => Boolean(instance?.vnode.props?.["onRowClick"])
    const listensForNavigate = () => Boolean(instance?.vnode.props?.["onNavigate"])

    /*
      Containers holding a mounted VNode. Vue will not unmount them on its own —
      they are outside its tree — so they are tracked and torn down before every
      rebuild. Without this a table that re-renders a thousand times leaks a
      thousand component instances.
    */
    let mounted: HTMLElement[] = []

    /** Everything, for when the component itself is going away. */
    const releaseVNodes = () => {
      for (const container of mounted) renderVNode(null, container)
      mounted = []
    }

    /*
      One element per slot, made once the component is on a page. The table is
      handed the element; the template's content is teleported into it, so the
      slot re-renders with the rest of the component rather than once.
    */
    const ready = ref(false)
    const slotHosts: Partial<Record<SlotName, HTMLElement>> = {}

    const slotHost = (name: SlotName): HTMLElement | undefined => {
      // A server has no elements to teleport into; the slots arrive on mount.
      if (!slots[name] || typeof document === "undefined") return undefined
      let element = slotHosts[name]
      if (!element) {
        element = document.createElement("span")
        element.style.display = "contents"
        slotHosts[name] = element
      }
      return element
    }

    /**
     * Unmounts only the components whose cells the table has thrown away.
     *
     * Run *after* a render rather than before one. The DOM renderer keeps the
     * rows it already had when a page is appended to the end — that is what
     * makes an infinite list affordable — so those containers are still on
     * screen and still need their components alive. What is safe to tear down
     * is whatever is no longer in the document, and asking each container is
     * both exact and cheap.
     */
    const releaseDetachedVNodes = () => {
      const kept: HTMLElement[] = []
      for (const container of mounted) {
        if (container.isConnected) kept.push(container)
        else renderVNode(null, container)
      }
      mounted = kept
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

    /*
      Once per `columns` prop rather than once per call. The wrapped renderers
      are new functions each time this runs, so adapting again for a change to
      an unrelated prop — `loading` flipping while a page is fetched — would
      look to the DOM renderer like a new set of columns, and it would rebuild
      every row it had been carefully keeping.
    */
    const adaptedColumns = computed(adaptColumns)

    const options = (): TableOptions => ({
      data: props.data,
      columns: adaptedColumns.value as TableOptions["columns"],
      getRowId: props.getRowId,
      state: props.state,
      defaultState: props.defaultState,
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
      rowHeight: props.rowHeight,
      theme: props.theme,
      rowHref: props.rowHref,
      rowClassName: props.rowClassName,
      emptyMessage: props.emptyMessage,
      buildHref: props.buildHref,
      className: props.className,
      classNames: props.classNames,
      unstyled: props.unstyled,
      caption: props.caption,
      ariaLabel: props.ariaLabel,
      toolbar: slotHost("toolbar"),
      appendRow: slotHost("appendRow"),
      footer: slotHost("footer"),
      emptyState: slotHost("empty"),
      onStateChange: (state) => emit("update:state", state),
      onSelectionChange: (ids, rows) => emit("selectionChange", ids, rows),
      onRowClick: listensForRowClick() ? (row, event) => emit("rowClick", row, event) : undefined,
      onNavigate: listensForNavigate() ? (href, event) => emit("navigate", href, event) : undefined,
    })

    /*
      The table for the first paint, as VNodes.

      The DOM renderer builds the table against an in-memory document, and
      that tree is turned into VNodes here — so Vue renders it on the server
      itself, and everything only Vue can render comes along: a template slot
      in the toolbar, a component in a cell. Where the renderer would have put
      one, the tree holds a marker, and the VNode goes in its place.

      Computed the same way on the server and in the browser, so the markup
      Vue hydrates is the markup it rendered. The live table replaces it on
      mount, and these VNodes are then unmounted — the same bytes, so nothing
      moves, and no component is left running twice.
    */
    const cellVNodes = new Map<string, VNodeChild>()
    const initial = treeToVNode(
      renderToTree(() => ({
        ...options(),
        columns: props.columns?.map((column) => {
          if (typeof column === "string" || !column.render) return column
          const render = column.render
          return {
            ...column,
            render: (context: CellContext<AnyRow, unknown>) => {
              const result = render(context)
              if (!isVNode(result)) return typeof result === "string" ? result : context.text
              const key = String(cellVNodes.size)
              cellVNodes.set(key, result)
              return el("span", { "data-tpz-vnode": key })
            },
          }
        }) as TableOptions["columns"],
        toolbar: slots["toolbar"] ? el("span", { "data-tpz-slot": "toolbar" }) : undefined,
        appendRow: slots["appendRow"] ? el("span", { "data-tpz-slot": "appendRow" }) : undefined,
        footer: slots["footer"] ? el("span", { "data-tpz-slot": "footer" }) : undefined,
        emptyState: slots["empty"] ? el("span", { "data-tpz-slot": "empty" }) : undefined,
      })),
      {
        cells: cellVNodes,
        slots: new Map(SLOTS.filter((name) => slots[name]).map((name) => [name, () => slots[name]?.()])),
      },
    )

    onMounted(() => {
      if (host.value) table = createTable(host.value, options())
      // The live table is in; the first-paint VNodes can go.
      ready.value = true
    })

    // Data changes far more often than anything else, and replacing it must not
    // disturb the arrangement — so it has its own watcher and its own path.
    watch(
      () => props.data,
      (data) => {
        table?.setData(data)
        releaseDetachedVNodes()
      },
    )

    // Every other prop, so nothing a template can change is ignored once the
    // table is on screen.
    watch(
      () => Object.fromEntries(Object.entries(props).filter(([key]) => key !== "data")),
      () => {
        table?.setOptions(options())
        releaseDetachedVNodes()
      },
      { deep: true },
    )

    onBeforeUnmount(() => {
      releaseVNodes()
      table?.destroy()
      table = undefined
    })

    return { host, ready, initial, slotHost, instance: () => table }
  },

  render() {
    const teleports = this.ready
      ? SLOTS.flatMap((name) => {
          const target = this.slotHost(name)
          const content = this.$slots[name]
          return target && content ? [h(Teleport, { to: target, key: name }, content())] : []
        })
      : []

    /*
      Until the live table is in, the inner element holds the first-paint
      VNodes — on the server, and through hydration. Once it is, they are
      dropped and the element is the live table's. The slots' teleports sit
      beside it, into the elements the live table was given.
    */
    return h("div", { class: "tpz-host" }, [h("div", { ref: "host" }, this.ready ? [] : [this.initial]), ...teleports])
  },
})
