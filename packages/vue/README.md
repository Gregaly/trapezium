# @trapezium/vue

A data table for Vue 3 that looks right before you configure anything.

```vue
<script setup>
import { TrapeziumTable } from "@trapezium/vue"
import "@trapezium/vue/styles.css"

const users = [/* … */]
</script>

<template>
  <TrapeziumTable :data="users" search selection="multiple" />
</template>
```

Columns, types, formatting, sorting, search and pagination all come from the data. Filters, selection, export, pinning, resizing, CSV export and URL state are all there; see the full documentation for the options.

A cell renderer may return a **VNode**, which is mounted as a real Vue component — props, events and all:

```js
{ key: "actions", header: "", render: ({ row }) => h(RowMenu, { id: row.id }) }
```

Events: `@update:state`, `@selection-change`, `@row-click`.

Vue 3.4+, Nuxt 3, Vite, Astro.

Full documentation: [github.com/Gregaly/trapezium](https://github.com/Gregaly/trapezium#readme) · MIT
