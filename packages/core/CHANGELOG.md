# @trapezium/core

## 0.1.1

### Patch Changes

- bf50f78: - A header that is a link (`buildHref`) no longer drags as a URL: dragging it moves the column, as it does for a header that is a button.
  - "Download CSV" exports the selected rows when there are any, as "Copy to clipboard" already did. `rowsToExport` in the core is the rule, for anyone building their own control.
  - Tests pin down that global search matches part of any element of an array (a `tags` column), by raw value and by label.

## 0.1.0

### Minor Changes

- 6fc1b51: Dynamic row height.
  
  `rowHeight="auto"` sizes every row to its tallest cell — wrapped prose, a stack
  of tags, or whatever a cell renderer returned. It needs no measuring pass: the
  table is a real `<table>` in normal flow, so the browser has already done it,
  and the server and the first client paint agree. `rowHeight={64}` sets an exact
  height, wrapping into it and ending what will not fit in an ellipsis. Only
  `"fixed"`, the default, truncates to a single line. Under `"auto"` the `--tpz-row-height` token
  becomes the minimum rather than the height, so density goes on meaning what it
  meant.
  
  Per column, `wrap` now takes a number as well as a boolean: `wrap: 3` wraps and
  stops after three lines, and `wrap: false` keeps a column on one line while the
  rest of the table wraps.
  
  Append pagination got the change that makes this affordable. `loadMore` and
  `infinite` keep every page loaded so far on screen, and reaching the end used to
  rebuild all of them to add one page. Now only the new rows are rendered: the
  rows already there keep their elements, their cell renderers are not re-run,
  the header is not replaced and the scroll position is not disturbed. Selecting a
  row updates that row rather than the table around it.
  
  The header now has a height of its own, `--tpz-header-height`, rather than
  reading the row's — a table of 64px rows was getting a 64px header, and a short
  one a header too small for its own controls. Density still moves both.
- b3a91f3: first public release
