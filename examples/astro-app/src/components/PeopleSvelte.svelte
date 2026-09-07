<script lang="ts">
  /** The Svelte island. An island has no router, so a change is a page load. */
  import { Table, applyStateToUrl, pickUrlState, stateFromUrl, type TableState } from "@trapezium/svelte"

  import { makePeople } from "../data"
  import { COLUMNS, queryOf, urlOptions } from "../view"

  let { url }: { url: string } = $props()

  const OPTIONS = urlOptions("s_")
  const people = makePeople()

  const state = $derived(stateFromUrl(queryOf(url), OPTIONS))
  const href = (next: TableState) => applyStateToUrl(url, next, OPTIONS)
  const go = (next: string) => {
    if (next !== href(state)) window.location.assign(next)
  }
</script>

<Table
  data={people}
  columns={COLUMNS}
  getRowId={(person) => person.id}
  state={pickUrlState(state, OPTIONS)}
  onStateChange={(next) => go(href(next))}
  buildHref={href}
  onNavigate={go}
  search={{ placeholder: "Search people" }}
  selection={{ isSelectable: (person) => person.team !== "Sales" }}
  pagination={{ mode: "pages", pageSize: 15 }}
  format={{ currency: "GBP", locale: "en" }}
  ariaLabel="People, in Svelte"
/>
