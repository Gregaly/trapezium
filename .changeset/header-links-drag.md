---
"@trapezium/core": patch
"@trapezium/react": patch
"@trapezium/vanilla": patch
"@trapezium/vue": patch
"@trapezium/svelte": patch
---

- A header that is a link (`buildHref`) no longer drags as a URL: dragging it moves the column, as it does for a header that is a button.
- "Download CSV" exports the selected rows when there are any, as "Copy to clipboard" already did. `rowsToExport` in the core is the rule, for anyone building their own control.
- Tests pin down that global search matches part of any element of an array (a `tags` column), by raw value and by label.
