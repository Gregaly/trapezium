<script lang="ts">
  /**
   * The Svelte example.
   *
   * Two tables: one with nothing configured, and one with everything. The
   * actions column returns a DOM node — which is all a renderer has to be —
   * and `bind:tableState` keeps the arrangement in a rune you can read.
   */
  import { Table, type TableState } from "@trapezium/svelte"

  import { makePeople, type Person } from "./data"

  const people = makePeople()

  let selected = $state<string[]>([])
  let tableState = $state<TableState | undefined>()

  const columns = [
    { key: "name", pin: "start" },
    { key: "email" },
    { key: "team", filter: "set" },
    { key: "salary", type: "currency" },
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
  ]
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
    <Table
      data={people}
      {columns}
      getRowId={(person) => person.id}
      search={{ placeholder: "Search people" }}
      selection="multiple"
      export={true}
      pagination={{ mode: "pages", pageSize: 15, pageSizeOptions: [15, 30, 60] }}
      format={{ currency: "GBP", locale: "en-GB" }}
      maxHeight={420}
      onSelectionChange={(ids) => (selected = ids)}
      bind:tableState
    />
    <p>{selected.length} selected · sorted by {tableState?.sort[0]?.key ?? "nothing"}</p>
  </section>
</main>
