<script setup lang="ts">
import { h, ref } from "vue"
import { TrapeziumTable, type TableState } from "@trapezium/vue"

import { makePeople, type Person } from "./data"

/**
 * The Vue example.
 *
 * Two tables: one with nothing configured, and one with everything — including
 * a cell that renders a real Vue component, with props and an event handler,
 * rather than a string of HTML.
 */

const people = makePeople()
const selected = ref<string[]>([])
const state = ref<TableState>()

function greet(person: Person) {
  window.alert(`${person.name} — ${person.email}`)
}

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
    // A renderer may return a VNode, and it is mounted as a real component.
    render: ({ row }: { row: Person }) =>
      h("span", { class: "chip" }, [
        h("button", { type: "button", onClick: () => greet(row) }, "Say hello"),
      ]),
  },
]
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
      <TrapeziumTable
        :data="people"
        :columns="columns"
        :get-row-id="(person) => person.id"
        :search="{ placeholder: 'Search people' }"
        selection="multiple"
        export
        :pagination="{ mode: 'pages', pageSize: 15, pageSizeOptions: [15, 30, 60] }"
        :format="{ currency: 'GBP', locale: 'en-GB' }"
        :max-height="420"
        @selection-change="(ids) => (selected = ids)"
        @update:state="(next) => (state = next)"
      />
      <p>{{ selected.length }} selected · sorted by {{ state?.sort[0]?.key ?? "nothing" }}</p>
    </section>
  </main>
</template>
