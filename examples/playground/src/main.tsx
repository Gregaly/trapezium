import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { Table } from "@trapezium/react"
import "@trapezium/react/styles.css"

import { makeInvoices, STATUS_OPTIONS, type Invoice } from "./data.js"
import "./playground.css"

const invoices = makeInvoices()

/**
 * Four tables, from the least configured to the most.
 *
 * The first one is the whole pitch: one prop, and everything below it is
 * something you only write when the default is not what you wanted.
 */
function Playground() {
  const [selected, setSelected] = useState<string[]>([])
  const [theme, setTheme] = useState<"light" | "dark" | undefined>(undefined)

  // The page follows the toggle too, so the tables are not the only thing that
  // changes when it is pressed.
  document.documentElement.dataset["theme"] = theme ?? ""

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
          Search, per-column filters, selection, export, pinned and resizable columns, and a custom
          cell.
        </p>
        <Table
          theme={theme}
          data={invoices}
          getRowId={(invoice) => invoice.id}
          search={{ placeholder: "Search invoices" }}
          selection
          onSelectionChange={setSelected}
          export
          densityControl
          maxHeight={420}
          format={{ currency: "AUD", locale: "en-AU", timeZone: "Australia/Sydney" }}
          columns={[
            { key: "reference", header: "Invoice", pin: "start", type: "id" },
            { key: "customer.name", header: "Customer" },
            { key: "customer.email", header: "Email" },
            { key: "amount", type: "currency", filter: "range" },
            { key: "status", type: "badge", formatOptions: { options: STATUS_OPTIONS } },
            { key: "tags", type: "tags" },
            { key: "issued_at", header: "Issued", type: "datetime" },
            { key: "due_date", header: "Due", type: "date" },
            { key: "paid", type: "boolean" },
            { key: "owner", filter: "set" },
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
          ]}
        />
        <p className="note">{selected.length} selected</p>
      </section>

      <section>
        <h2>Infinite scroll</h2>
        <p className="note">Same table, one prop different.</p>
        <Table
          theme={theme}
          data={invoices}
          getRowId={(invoice) => invoice.id}
          pagination={{ mode: "infinite", pageSize: 20 }}
          maxHeight={320}
          columns={["reference", "customer.name", "amount", "status"]}
        />
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
          <Table theme={theme} data={[] as Invoice[]} columns={["reference", "amount"]} error="Could not reach the server" />
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
