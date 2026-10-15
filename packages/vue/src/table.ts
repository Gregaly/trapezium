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
  CellEdit,
  EditorContext,
  ColumnDef,
  Density,
  DetailContext,
  DetailOptions,
  HeaderContext,
  FormatContext,
  PaginationOptions,
  PartialTableState,
  PinnedRows,
  RowHeight,
  RowContextMenuInfo,
  RowInfo,
  RowReorderOptions,
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

export type VueColumn<TRow extends AnyRow = AnyRow> = Omit<
  ColumnDef<TRow, unknown>,
  "render" | "renderHeader" | "renderHeaderControls" | "renderEditor"
> & {
  render?: (context: CellContext<TRow, unknown>) => VNode | Node | string
  /** Your own editor for the column's cells — a VNode, so it can be a real component. */
  renderEditor?: (context: EditorContext<TRow, unknown>) => VNode | Node | string
  /** The header's text, drawn your way — a VNode, inside the sort control, so phrasing content only. */
  renderHeader?: (context: HeaderContext<TRow, unknown>) => VNode | Node | string
  /**
   * Controls of your own in the header, beside its text — a VNode, so a real
   * component: a search box, a filter button. Patched in place as the table
   * changes, so an input keeps its focus and what was typed.
   */
  renderHeaderControls?: (context: HeaderContext<TRow, unknown>) => VNode | Node | string
}

/** Detail rows, with a renderer that may return a VNode — a real component, below its row. */
export type VueDetail<TRow extends AnyRow = AnyRow> = Omit<DetailOptions<TRow, unknown>, "render"> & {
  render(context: DetailContext<TRow>): VNode | Node | string
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
    /**
     * Search each column from its header, without opening its menu.
     *
     * A magnifier appears in a header on hover and turns it into a text box;
     * what is typed filters that column as "contains", against the text its
     * cells show. `true` switches it on for every column that can be
     * filtered, and `{ debounce }` sets how long it waits after a keystroke.
     * Off by default — and a single column can opt in or out with its own
     * `headerSearch`, whatever is said here.
     */
    headerSearch: { type: [Boolean, Object] as PropType<TableOptions["headerSearch"]>, default: false },
    /**
     * Column sorting. Defaults to true.
     *
     * A shift-click on a header adds a level to the sort, and a reset control
     * appears in the toolbar while a sort is applied. Pass an object to change
     * either: `{ multiple: false }` for a backend that orders by one column
     * only, `{ reset: false }` to leave the control out, or
     * `{ reset: [{ key, direction }] }` to name the order the table rests in.
     */
    sortable: { type: [Boolean, Object] as PropType<TableOptions["sortable"]>, default: true },
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
    /**
     * Detail rows: content that opens below a row and spans the table's width.
     * `render` may return a VNode, so a detail is a real component. Which rows
     * are open is `state.expanded`; the server renders open rows open.
     */
    detail: { type: Object as PropType<VueDetail>, default: undefined },
    /**
     * Cells the keyboard can move between, with the arrows, Home, End and the
     * Page keys. The active cell is `state.focus`, so setting it from outside
     * scrolls there and puts the keyboard on it. Makes the table a grid.
     */
    cellNavigation: { type: Boolean as PropType<boolean | undefined>, default: undefined },
    /**
     * Receives every committed edit of an `editable` column — `@cell-edit`.
     * A prop rather than an event so it can return a promise: the cell shows
     * that it is saving until it settles, and goes back if it rejects. Update
     * your data with `edit.value`.
     */
    onCellEdit: { type: Function as PropType<(edit: CellEdit<AnyRow>) => void | Promise<unknown>>, default: undefined },
    /** What opens an editable cell with the mouse: `"doubleClick"` (the default) or `"click"`. */
    editTrigger: { type: String as PropType<"click" | "doubleClick">, default: undefined },
    rowClassName: {
      type: Function as PropType<(row: AnyRow, index: number, info?: RowInfo) => string | undefined>,
      default: undefined,
    },
    /**
     * One level of child rows: the id of the row this one belongs under, or
     * `null`. Children are drawn under their parent, fold away with a toggle
     * on it (`state.collapsed`), and stay with it through sorting, filtering
     * and paging.
     */
    getParentId: { type: Function as PropType<(row: AnyRow) => string | null | undefined>, default: undefined },
    /**
     * Rows held at the top or bottom, outside `data` — a "new entry" row, a
     * totals row. Same columns, renderers and editors; never filtered, sorted,
     * paged, counted, selected or exported.
     */
    pinnedRows: { type: Object as PropType<PinnedRows<AnyRow>>, default: undefined },
    /**
     * Rows moved by hand, with a drag handle or Alt and an arrow key.
     * `onReorder` gets the row and its new neighbours and may return a promise.
     * Offered only while the table is unsorted.
     */
    rowReorder: { type: Object as PropType<RowReorderOptions<AnyRow>>, default: undefined },
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
    /**
     * Base for the ids the table gives its own elements, such as a detail row
     * its expander points at. Give each table on a page its own when more than
     * one has detail rows.
     */
    id: { type: String, default: undefined },
  },

  emits: {
    "update:state": (state: TableState) => true,
    selectionChange: (ids: string[], rows: AnyRow[]) => true,
    rowClick: (row: AnyRow, event: MouseEvent) => true,
    /**
     * A context menu asked for on a row, with the cell under the pointer — its
     * column and the text it shows. Call `event.preventDefault()` to keep the
     * browser's own menu closed.
     */
    rowContextMenu: (row: AnyRow, event: MouseEvent, info: RowContextMenuInfo<AnyRow, Node | string>) => true,
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
      Likewise for the state. A table whose controls are links sends a
      shift-click to whoever turns state into an address — and when nobody is
      listening, to the address itself. It can only tell the two apart if it is
      not handed a listener that leads nowhere.
    */
    const listensForState = () => Boolean(instance?.vnode.props?.["onUpdate:state"])

    /*
      Containers holding a mounted VNode. Vue will not unmount them on its own —
      they are outside its tree — so they are tracked and torn down before every
      rebuild. Without this a table that re-renders a thousand times leaks a
      thousand component instances.
    */
    let mounted: HTMLElement[] = []

    /*
      Header controls, one container per column, made once and patched each
      time the table asks again: a fresh container on every change of state
      would be a fresh input, and the person typing in it would lose their
      place. `display: contents`, so the controls lay out in the header's slot
      as if the container were not there.
    */
    const headerControls = new Map<string, HTMLElement>()

    const toHeaderControls = (key: string, result: VNode | Node | string): Node | string => {
      if (!isVNode(result)) return result
      let container = headerControls.get(key)
      if (!container) {
        container = document.createElement("span")
        container.style.display = "contents"
        headerControls.set(key, container)
      }
      renderVNode(result, container)
      return container
    }

    /** Everything, for when the component itself is going away. */
    const releaseVNodes = () => {
      for (const container of mounted) renderVNode(null, container)
      mounted = []
      for (const container of headerControls.values()) renderVNode(null, container)
      headerControls.clear()
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
      // A column no longer shown takes its controls with it; shown again, it gets new ones.
      for (const [key, container] of headerControls) {
        if (container.isConnected) continue
        renderVNode(null, container)
        headerControls.delete(key)
      }
    }

    /** Wraps the caller's renderers so a VNode becomes a real DOM node. */
    /** A VNode as a DOM node the renderer can place, kept track of so it can be unmounted. */
    const toNode = (result: VNode | Node | string): Node | string => {
      if (!isVNode(result)) return result
      const container = document.createElement("span")
      renderVNode(result, container)
      mounted.push(container)
      return container
    }

    const adaptColumns = () =>
      props.columns?.map((column) => {
        if (
          typeof column === "string" ||
          (!column.render && !column.renderEditor && !column.renderHeader && !column.renderHeaderControls)
        )
          return column
        const { render, renderEditor, renderHeader, renderHeaderControls } = column

        return {
          ...column,
          render: render ? (context: CellContext<AnyRow, unknown>) => toNode(render(context)) : undefined,
          renderEditor: renderEditor ? (context: EditorContext<AnyRow, unknown>) => toNode(renderEditor(context)) : undefined,
          renderHeader: renderHeader ? (context: HeaderContext<AnyRow, unknown>) => toNode(renderHeader(context)) : undefined,
          renderHeaderControls: renderHeaderControls
            ? (context: HeaderContext<AnyRow, unknown>) =>
                toHeaderControls(context.column.key, renderHeaderControls(context))
            : undefined,
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

    /** The detail's renderer, wrapped the same way a cell's is. */
    const adaptedDetail = computed((): TableOptions["detail"] => {
      const detail = props.detail
      if (!detail) return undefined
      return {
        ...detail,
        render: (context) => {
          const result = detail.render(context)
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
      headerSearch: props.headerSearch,
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
      detail: adaptedDetail.value,
      cellNavigation: props.cellNavigation,
      onCellEdit: props.onCellEdit,
      editTrigger: props.editTrigger,
      id: props.id,
      rowClassName: props.rowClassName,
      getParentId: props.getParentId,
      pinnedRows: props.pinnedRows,
      rowReorder: props.rowReorder,
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
      onStateChange: listensForState() ? (state) => emit("update:state", state) : undefined,
      onSelectionChange: (ids, rows) => emit("selectionChange", ids, rows),
      onRowClick: listensForRowClick() ? (row, event) => emit("rowClick", row, event) : undefined,
      onRowContextMenu: (row, event, info) => emit("rowContextMenu", row, event, info),
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
          if (typeof column === "string" || (!column.render && !column.renderHeader && !column.renderHeaderControls))
            return column
          const { render, renderHeader, renderHeaderControls } = column
          /** A VNode as a marker in the server tree, to be filled with it when the tree becomes VNodes. */
          const mark = (result: VNode) => {
            const key = String(cellVNodes.size)
            cellVNodes.set(key, result)
            return el("span", { "data-tpz-vnode": key })
          }
          return {
            ...column,
            render: render
              ? (context: CellContext<AnyRow, unknown>) => {
                  const result = render(context)
                  if (!isVNode(result)) return typeof result === "string" ? result : context.text
                  return mark(result)
                }
              : undefined,
            renderHeader: renderHeader
              ? (context: HeaderContext<AnyRow, unknown>) => {
                  const result = renderHeader(context)
                  if (!isVNode(result)) return typeof result === "string" ? result : context.column.header
                  return mark(result)
                }
              : undefined,
            renderHeaderControls: renderHeaderControls
              ? (context: HeaderContext<AnyRow, unknown>) => {
                  const result = renderHeaderControls(context)
                  if (!isVNode(result)) return typeof result === "string" ? result : ""
                  return mark(result)
                }
              : undefined,
          }
        }) as TableOptions["columns"],
        detail: props.detail
          ? {
              ...props.detail,
              render: (context: DetailContext<AnyRow>) => {
                const result = props.detail?.render(context)
                if (!isVNode(result)) return typeof result === "string" ? result : ""
                const key = String(cellVNodes.size)
                cellVNodes.set(key, result)
                return el("span", { "data-tpz-vnode": key })
              },
            }
          : undefined,
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
