<script setup lang="ts">
/**
 * Server-rendered, and every control is a link.
 *
 * The rows arrive in the HTML already sorted, filtered and paged. With
 * `buildHref` the header sorts and the pagination pages by navigation, so the
 * table works before its JavaScript has loaded. Once it has, the links are
 * caught and turned into router navigations, so nothing reloads.
 */
import { computed } from "vue"
import { TrapeziumTable, applyStateToUrl, pickUrlState, stateFromUrl, type TableState } from "@trapezium/vue"

import { makePeople } from "./data"

const route = useRoute()
const router = useRouter()

const people = makePeople()

const columns = [
  { key: "name", pin: "start" },
  { key: "email" },
  { key: "team", filter: "set" },
  { key: "salary", type: "currency", filter: "range" },
  { key: "started", type: "date" },
  { key: "remote", type: "boolean" },
]

const state = computed(() => stateFromUrl(route.query as Record<string, string | string[] | undefined>))

const href = (next: TableState) => applyStateToUrl("/", next)

/*
  Only the keys the URL carries are controlled from it; the selection and any
  dragged widths stay with the table. A change that would leave the URL where
  it is — a selection — is not a navigation.
*/
const controlled = computed(() => pickUrlState(state.value))
const onStateChange = (next: TableState) => {
  const url = href(next)
  if (url !== href(state.value)) void router.push(url)
}

/** The table's own links go through the router rather than reloading the page. */
const followLink = (event: MouseEvent) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(".tpz a[href^='/']")
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
  event.preventDefault()
  void router.push(link.getAttribute("href") ?? "/")
}
</script>

<template>
  <main @click="followLink">
    <h1>Trapezium in Nuxt</h1>
    <p>
      Server-rendered, with every control a real link. Disable JavaScript and the header still
      sorts and the pagination still pages; sort a column and look at the address bar.
    </p>

    <TrapeziumTable
      :data="people"
      :columns="columns"
      :get-row-id="(person) => person.id"
      :state="controlled"
      :build-href="href"
      :search="{ placeholder: 'Search people' }"
      :selection="{ isSelectable: (person) => person.team !== 'Sales' }"
      export
      :pagination="{ mode: 'pages', pageSize: 15, pageSizeOptions: [15, 30, 60] }"
      :format="{ currency: 'GBP', locale: 'en-GB' }"
      aria-label="People"
      @update:state="onStateChange"
    />
  </main>
</template>
