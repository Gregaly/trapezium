# @trapezium/svelte

A data table for Svelte 5 that looks right before you configure anything.

```svelte
<script>
  import { Table } from "@trapezium/svelte"
  import "@trapezium/svelte/styles.css"

  let users = [/* … */]
  let tableState = $state()
</script>

<Table data={users} search selection="multiple" bind:tableState />
```

Columns, types, formatting, sorting, search and pagination all come from the data. Filters, selection, export, pinning, resizing and URL state are all there; see the full documentation for the options.

There is an action too, for when you want the table inside markup you already control:

```svelte
<script>
  import { trapezium } from "@trapezium/svelte"
</script>

<div use:trapezium={{ data: users, search: true }}></div>
```

A cell renderer returns a DOM node or a string. To render a Svelte component in a cell, mount it yourself:

```js
import { mount } from "svelte"

render: ({ row }) => {
  const host = document.createElement("span")
  mount(Chip, { target: host, props: { row } })
  return host
}
```

Svelte 5, SvelteKit, Vite, Astro.

Full documentation: [github.com/Gregaly/trapezium](https://github.com/Gregaly/trapezium#readme) · MIT
