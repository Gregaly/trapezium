<script setup lang="ts">
import { computed } from "vue"
import { TrapeziumTable, applyStateToUrl, pickUrlState, stateFromUrl, type TableState } from "@trapezium/vue"

import { makePeople } from "../data"
import { COLUMNS, queryOf, urlOptions } from "../view"

/** The Vue island. An island has no router, so a change is a page load. */
const props = defineProps<{ url: string }>()

const OPTIONS = urlOptions("v_")
const people = makePeople()

const state = computed(() => stateFromUrl(queryOf(props.url), OPTIONS))
const href = (next: TableState) => applyStateToUrl(props.url, next, OPTIONS)
const go = (next: string) => {
  if (next !== href(state.value)) window.location.assign(next)
}
</script>

<template>
  <TrapeziumTable
    :data="people"
    :columns="COLUMNS"
    :get-row-id="(person) => person.id"
    :state="pickUrlState(state, OPTIONS)"
    :build-href="href"
    :search="{ placeholder: 'Search people' }"
    :selection="{ isSelectable: (person) => person.team !== 'Sales' }"
    :pagination="{ mode: 'pages', pageSize: 15 }"
    :format="{ currency: 'GBP', locale: 'en' }"
    aria-label="People, in Vue"
    @update:state="(next) => go(href(next))"
    @navigate="go"
  />
</template>
