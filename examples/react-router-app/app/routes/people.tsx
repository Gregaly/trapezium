import { useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router"
import {
  Table,
  applyStateToUrl,
  pickUrlState,
  stateFromUrl,
  type Column,
  type TableState,
  type UrlOptions,
} from "@trapezium/react"

import { makePeople, type Person } from "../data"

/**
 * Server-rendered, and every control is a link.
 *
 * The loader reads the view out of the URL — on the server for the first
 * request, in the browser for every navigation after — so the rows arrive in
 * the HTML already sorted and paged. `buildHref` makes the header and the
 * pagination links that work before any script has loaded; `onNavigate` hands
 * those same links to the router once it has.
 */

/*
  The table shows fifteen rows a page, so fifteen is its resting size: a URL
  with no size means fifteen, and a size of fifteen writes nothing.
*/
const URL_OPTIONS: UrlOptions = { defaults: { pageSize: 15 } }

const people = makePeople()

export function loader({ request }: LoaderFunctionArgs) {
  return { state: stateFromUrl(new URL(request.url).searchParams, URL_OPTIONS) }
}

const columns: Column<Person>[] = [
  { key: "name", pin: "start" },
  { key: "email" },
  { key: "team", filter: "set" },
  { key: "salary", type: "currency", filter: "range" },
  { key: "started", type: "date" },
  { key: "remote", type: "boolean" },
]

export default function People() {
  const { state } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const href = (next: TableState) => applyStateToUrl("/", next, URL_OPTIONS)

  // Only the keys the URL carries are controlled from it; the selection and
  // any dragged widths stay with the table.
  const controlled = pickUrlState(state)
  const onStateChange = (next: TableState) => {
    const url = href(next)
    if (url !== href(state)) void navigate(url)
  }

  return (
    <main>
      <h1>Trapezium in React Router</h1>
      <p>
        Server-rendered, with every control a real link. Disable JavaScript and the header still sorts
        and the pagination still pages; sort a column and look at the address bar.
      </p>

      <Table
        data={people}
        columns={columns}
        getRowId={(person) => person.id}
        state={controlled}
        onStateChange={onStateChange}
        buildHref={href}
        onNavigate={(url) => void navigate(url)}
        search={{ placeholder: "Search people" }}
        selection={{ isSelectable: (person) => person.team !== "Sales" }}
        export
        pagination={{ mode: "pages", pageSize: 15, pageSizeOptions: [15, 30, 60] }}
        format={{ currency: "GBP", locale: "en" }}
        aria-label="People"
      />
    </main>
  )
}
