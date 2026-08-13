import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { Table, type Column, type Density, type PaginationOptions } from "@trapezium/react"
import "@trapezium/react/styles.css"

import { Controls, Segmented, Switch } from "./controls.js"
import { makeInvoices, STATUS_OPTIONS, type Invoice } from "./data.js"
import "./playground.css"

const invoices = makeInvoices()

/**
 * The playground.
 *
 * Every table below is the same component with different props, and the
 * switches above the big one change those props live — which is the fastest way
 * to find out what a prop actually does.
 */
function Playground() {
  const [selected, setSelected] = useState<string[]>([])
  const [theme, setTheme] = useState<"light" | "dark" | undefined>(undefined)

  // The page follows the toggle too, so the tables are not the only thing that
  // changes when it is pressed.
  document.documentElement.dataset["theme"] = theme ?? ""

  /* What the switches control. */
  const [mode, setMode] = useState<NonNullable<PaginationOptions["mode"]> | "none">("pages")
  const [pageSize, setPageSize] = useState(25)
  const [setFilters, setSetFilters] = useState(false)
  const [selection, setSelection] = useState(true)
  const [density, setDensity] = useState<Density>("normal")
  const [cards, setCards] = useState(false)
  const [sticky, setSticky] = useState(true)

  const columns: Column<Invoice>[] = [
    { key: "reference", header: "Invoice", pin: "start", type: "id" },
    { key: "customer.name", header: "Customer", filter: setFilters ? "set" : true },
    { key: "customer.email", header: "Email" },
    { key: "amount", type: "currency", filter: setFilters ? "set" : "range" },
    {
      key: "status",
      type: "badge",
      formatOptions: { options: STATUS_OPTIONS },
      filter: setFilters ? "set" : true,
    },
    { key: "tags", type: "tags" },
    { key: "issued_at", header: "Issued", type: "datetime" },
    { key: "due_date", header: "Due", type: "date" },
    { key: "paid", type: "boolean" },
    { key: "owner", filter: setFilters ? "set" : true },
    { key: "notes", type: "longText", wrap: true, width: 280 },
    {
      key: "actions",
      header: "",
      sortable: false,
      filter: false,
      exportable: false,
      width: 90,
      render: ({ row }) => (
        <button type="button" className="row-action" onClick={() => alert(row.reference)}>
          Open
        </button>
      ),
    },
  ]

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Trapezium</h1>
          <p>A data table that looks right before you configure anything.</p>
        </div>
        <div className="themes">
          {(["light", "dark", undefined] as const).map((option) => (
            <button
              key={option ?? "system"}
              type="button"
              data-active={theme === option}
              onClick={() => setTheme(option)}
            >
              {option ?? "system"}
            </button>
          ))}
        </div>
      </header>

      <section>
        <h2>Nothing configured</h2>
        <p className="note">
          <code>{`<Table data={invoices} />`}</code> — columns, types, formatting, sorting and
          pagination all come from the data.
        </p>
        <Table theme={theme} data={invoices.slice(0, 8)} pagination={false} />
      </section>

      <section>
        <h2>Everything switched on</h2>
        <p className="note">
          Drag a column header sideways to move it, or out of the table to remove it. The switches
          change the props live.
        </p>

        <Controls>
          <Segmented
            label="Pagination"
            value={mode}
            onChange={setMode}
            options={[
              { value: "pages", label: "Pages" },
              { value: "simple", label: "Prev / next" },
              { value: "loadMore", label: "Load more" },
              { value: "infinite", label: "Infinite" },
              { value: "none", label: "All rows" },
            ]}
          />
          <Segmented
            label="Per page"
            value={String(pageSize)}
            onChange={(next) => setPageSize(Number(next))}
            options={[
              { value: "10", label: "10" },
              { value: "25", label: "25" },
              { value: "50", label: "50" },
            ]}
          />
          <Segmented
            label="Density"
            value={density}
            onChange={setDensity}
            options={[
              { value: "compact", label: "Compact" },
              { value: "normal", label: "Normal" },
              { value: "relaxed", label: "Relaxed" },
            ]}
          />
          <Switch label="Set filters" checked={setFilters} onChange={setSetFilters} />
          <Switch label="Selection" checked={selection} onChange={setSelection} />
          <Switch label="Card layout" checked={cards} onChange={setCards} />
          <Switch label="Sticky header" checked={sticky} onChange={setSticky} />
        </Controls>

        <Table
          theme={theme}
          data={invoices}
          getRowId={(invoice) => invoice.id}
          search={{ placeholder: "Search invoices" }}
          selection={selection}
          onSelectionChange={setSelected}
          export
          densityControl
          density={density}
          responsive={cards ? "cards" : "scroll"}
          stickyHeader={sticky}
          maxHeight={420}
          pagination={mode === "none" ? false : { mode, pageSize, pageSizeOptions: [10, 25, 50, 100] }}
          format={{ currency: "AUD", locale: "en-AU", timeZone: "Australia/Sydney" }}
          columns={columns}
        />
        <p className="note">
          {selected.length} selected · filters are {setFilters ? "set filters" : "whatever each type deserves"}
        </p>
      </section>

      <section>
        <h2>Narrow: the same table as cards</h2>
        <p className="note">
          <code>responsive="cards"</code> — a container query, so it depends on the room the table
          has rather than the size of the window.
        </p>
        <div className="narrow">
          <Table
            theme={theme}
            data={invoices.slice(0, 4)}
            responsive="cards"
            pagination={false}
            columns={["reference", "customer.name", "amount", "status", "due_date"]}
          />
        </div>
      </section>

      <section>
        <h2>Empty, loading, and error</h2>
        <div className="grid">
          <Table theme={theme} data={[] as Invoice[]} columns={["reference", "amount"]} />
          <Table theme={theme} data={[] as Invoice[]} columns={["reference", "amount"]} loading />
          <Table
            theme={theme}
            data={[] as Invoice[]}
            columns={["reference", "amount"]}
            error="Could not reach the server"
          />
        </div>
      </section>
    </main>
  )
}

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
)
