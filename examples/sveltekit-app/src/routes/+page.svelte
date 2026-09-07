<script lang="ts">
  /**
   * Server-rendered, and every control is a link.
   *
   * The rows arrive in the HTML already sorted, filtered and paged. With
   * `buildHref` the header sorts and the pagination pages by navigation, so
   * the table works before its JavaScript has loaded — and once it has,
   * SvelteKit turns those same links into client-side navigations.
   */
  import { goto } from "$app/navigation"
  import { Table, applyStateToUrl, pickUrlState, type TableState } from "@trapezium/svelte"
  import "@trapezium/svelte/styles.css"

  import { makePeople } from "$lib/data"
  import { URL_OPTIONS } from "$lib/url"
  import "../app.css"

  let { data } = $props()

  const people = makePeople()

  const columns = [
    { key: "name", pin: "start" },
    { key: "email" },
    { key: "team", filter: "set" },
    { key: "salary", type: "currency", filter: "range" },
    { key: "started", type: "date" },
    { key: "remote", type: "boolean" },
  ]

  const href = (next: TableState) => applyStateToUrl("/", next, URL_OPTIONS)

  /*
    Only the keys the URL carries are controlled from it; the selection and
    any dragged widths stay with the table. A change that would leave the URL
    where it is — a selection — is not a navigation.
  */
  const controlled = $derived(pickUrlState(data.state))
  const onStateChange = (next: TableState) => {
    const url = href(next)
    if (url !== href(data.state)) void goto(url, { keepFocus: true, noScroll: true })
  }
</script>

<main>
  <h1>Trapezium in SvelteKit</h1>
  <p>
    Server-rendered, with every control a real link. Disable JavaScript and the header still sorts
    and the pagination still pages; sort a column and look at the address bar.
  </p>

  <Table
    data={people}
    {columns}
    getRowId={(person) => person.id}
    state={controlled}
    {onStateChange}
    buildHref={href}
    search={{ placeholder: "Search people" }}
    selection={{ isSelectable: (person) => person.team !== "Sales" }}
    export={true}
    pagination={{ mode: "pages", pageSize: 15, pageSizeOptions: [15, 30, 60] }}
    format={{ currency: "GBP", locale: "en" }}
    ariaLabel="People"
  />
</main>
