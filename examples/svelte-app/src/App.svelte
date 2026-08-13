<script lang="ts">
  /**
   * The Svelte example.
   *
   * Two tables: one with nothing configured, and one with everything. The
   * actions column returns a DOM node — which is all a renderer has to be —
   * `bind:tableState` keeps the arrangement in a rune, and the switches change
   * the props live.
   */
  import { Table, type TableState } from "@trapezium/svelte"

  import Controls from "./Controls.svelte"
  import { makePeople, type Person } from "./data"

  const people = makePeople()

  let selected = $state<string[]>([])
  let tableState = $state<TableState | undefined>()

  let mode = $state("pages")
  let setFilters = $state(false)
  let selection = $state(true)
  let cards = $state(false)

  const columns = $derived([
    { key: "name", pin: "start" },
    { key: "email" },
    { key: "team", filter: setFilters ? "set" : true },
    { key: "salary", type: "currency", filter: setFilters ? "set" : "range" },
    { key: "started", type: "date" },
    { key: "remote", type: "boolean" },
    {
      key: "actions",
      header: "",
      sortable: false,
      filter: false,
      exportable: false,
      width: 110,
      render: ({ row }: { row: Person }) => {
        const button = document.createElement("button")
        button.className = "tpz-btn"
        button.textContent = "Say hello"
        button.addEventListener("click", () => window.alert(`${row.name} — ${row.email}`))
        return button
      },
    },
  ])

  const pagination = $derived(
    mode === "none" ? false : { mode, pageSize: 15, pageSizeOptions: [15, 30, 60] },
  )
</script>

<main>
  <h1>Trapezium in Svelte</h1>
  <p>The same table, the same markup, the same stylesheet — bound with runes.</p>

  <section>
    <h2>Nothing configured</h2>
    <Table data={people.slice(0, 6)} pagination={false} />
  </section>

  <section>
    <h2>Everything switched on</h2>
    <p>Drag a column header sideways to move it, or out of the table to remove it.</p>

    <Controls
      segments={[
        {
          label: "Pagination",
          value: mode,
          options: [
            { value: "pages", label: "Pages" },
            { value: "simple", label: "Prev / next" },
            { value: "loadMore", label: "Load more" },
            { value: "infinite", label: "Infinite" },
            { value: "none", label: "All rows" },
          ],
        },
      ]}
      switches={[
        { label: "Set filters", value: setFilters },
        { label: "Selection", value: selection },
        { label: "Card layout", value: cards },
      ]}
      onsegment={(label, value) => {
        if (label === "Pagination") mode = value
      }}
      onswitch={(label, value) => {
        if (label === "Set filters") setFilters = value
        if (label === "Selection") selection = value
        if (label === "Card layout") cards = value
      }}
    />

    <Table
      data={people}
      {columns}
      getRowId={(person) => person.id}
      search={{ placeholder: "Search people" }}
      selection={selection ? "multiple" : false}
      responsive={cards ? "cards" : "scroll"}
      export={true}
      {pagination}
      format={{ currency: "GBP", locale: "en-GB" }}
      maxHeight={420}
      onSelectionChange={(ids) => (selected = ids)}
      bind:tableState
    />
    <p>{selected.length} selected · sorted by {tableState?.sort[0]?.key ?? "nothing"}</p>
  </section>
</main>
