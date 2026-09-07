import { Table, applyStateToUrl, pickUrlState, stateFromUrl, type Column, type TableState } from "@trapezium/react"

import { makePeople, type Person } from "../data"
import { COLUMNS, queryOf, urlOptions } from "../view"

const OPTIONS = urlOptions("r_")
const people = makePeople()

/** The React island. An island has no router, so a change is a page load. */
export default function PeopleReact({ url }: { url: string }) {
  const state = stateFromUrl(queryOf(url), OPTIONS)
  const href = (next: TableState) => applyStateToUrl(url, next, OPTIONS)
  const go = (next: string) => {
    if (next !== href(state)) window.location.assign(next)
  }

  return (
    <Table
      data={people}
      columns={COLUMNS as Column<Person>[]}
      getRowId={(person) => person.id}
      state={pickUrlState(state, OPTIONS)}
      onStateChange={(next) => go(href(next))}
      buildHref={href}
      onNavigate={go}
      search={{ placeholder: "Search people" }}
      selection={{ isSelectable: (person) => person.team !== "Sales" }}
      pagination={{ mode: "pages", pageSize: 15 }}
      format={{ currency: "GBP", locale: "en" }}
      aria-label="People, in React"
    />
  )
}
