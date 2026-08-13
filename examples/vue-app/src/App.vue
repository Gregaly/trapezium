<script setup lang="ts">
import { computed, h, ref } from "vue"
import { TrapeziumTable, type TableState } from "@trapezium/vue"

import Controls from "./Controls.vue"
import { makePeople, type Person } from "./data"

/**
 * The Vue example.
 *
 * Two tables: one with nothing configured, and one with everything — including
 * a cell that renders a real Vue component, and switches that change the props
 * live.
 */

const people = makePeople()
const selected = ref<string[]>([])
const state = ref<TableState>()

const mode = ref("pages")
const setFilters = ref(false)
const selection = ref(true)
const cards = ref(false)

function greet(person: Person) {
  window.alert(`${person.name} — ${person.email}`)
}

const columns = computed(() => [
  { key: "name", pin: "start" },
  { key: "email" },
  { key: "team", filter: setFilters.value ? "set" : true },
  { key: "salary", type: "currency", filter: setFilters.value ? "set" : "range" },
  { key: "started", type: "date" },
  { key: "remote", type: "boolean" },
  {
    key: "actions",
    header: "",
    sortable: false,
    filter: false,
    exportable: false,
    width: 110,
    // A renderer may return a VNode, and it is mounted as a real component.
    render: ({ row }: { row: Person }) =>
      h("span", { class: "chip" }, [h("button", { type: "button", onClick: () => greet(row) }, "Say hello")]),
  },
])

const pagination = computed(() =>
  mode.value === "none" ? false : { mode: mode.value, pageSize: 15, pageSizeOptions: [15, 30, 60] },
)

function onSegment(label: string, value: string) {
  if (label === "Pagination") mode.value = value
}

function onSwitch(label: string, value: boolean) {
  if (label === "Set filters") setFilters.value = value
  if (label === "Selection") selection.value = value
  if (label === "Card layout") cards.value = value
}
</script>

<template>
  <main>
    <h1>Trapezium in Vue</h1>
    <p>The same table, the same markup, the same stylesheet — bound with Vue's reactivity.</p>

    <section>
      <h2>Nothing configured</h2>
      <TrapeziumTable :data="people.slice(0, 6)" :pagination="false" />
    </section>

    <section>
      <h2>Everything switched on</h2>
      <p>Drag a column header sideways to move it, or out of the table to remove it.</p>

      <Controls
        :segments="[
          {
            label: 'Pagination',
            value: mode,
            options: [
              { value: 'pages', label: 'Pages' },
              { value: 'simple', label: 'Prev / next' },
              { value: 'loadMore', label: 'Load more' },
              { value: 'infinite', label: 'Infinite' },
              { value: 'none', label: 'All rows' },
            ],
          },
        ]"
        :switches="[
          { label: 'Set filters', value: setFilters },
          { label: 'Selection', value: selection },
          { label: 'Card layout', value: cards },
        ]"
        @segment="onSegment"
        @switch="onSwitch"
      />

      <TrapeziumTable
        :data="people"
        :columns="columns"
        :get-row-id="(person) => person.id"
        :search="{ placeholder: 'Search people' }"
        :selection="selection ? 'multiple' : false"
        :responsive="cards ? 'cards' : 'scroll'"
        export
        :pagination="pagination"
        :format="{ currency: 'GBP', locale: 'en-GB' }"
        :max-height="420"
        @selection-change="(ids) => (selected = ids)"
        @update:state="(next) => (state = next)"
      />
      <p>{{ selected.length }} selected · sorted by {{ state?.sort[0]?.key ?? "nothing" }}</p>
    </section>
  </main>
</template>
