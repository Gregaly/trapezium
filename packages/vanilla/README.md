# @trapezium/vanilla

A data table for plain JavaScript, with no framework and no dependencies.

```js
import { createTable } from "@trapezium/vanilla"
import "@trapezium/vanilla/styles.css"

const table = createTable("#people", {
  data: users,
  search: true,
  selection: "multiple",
  pagination: { mode: "pages", pageSize: 25 },
})
```

Or from a script tag, with no build step at all:

```html
<link rel="stylesheet" href="https://unpkg.com/@trapezium/vanilla/styles.css" />
<script src="https://unpkg.com/@trapezium/vanilla/dist/trapezium.global.js"></script>
<script>
  Trapezium.createTable("#people", { data: users, search: true })
</script>
```

Columns, types, formatting, sorting, search and pagination are all inferred from the data. A cell renderer returns a DOM node or a string.

The instance is yours: `setData`, `setOptions`, `getState`, `setState`, `getRows`, `getSelection`, `refresh`, `destroy`.

Full documentation: [github.com/Gregaly/trapezium](https://github.com/Gregaly/trapezium#readme) · MIT
