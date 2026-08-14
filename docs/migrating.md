# Migrating

## From TanStack Table

TanStack is headless: you wrote the markup, the styling, the pagination controls and the filter UI. Trapezium brings those with it, so most of a migration is deleting.

| TanStack | Trapezium |
|---|---|
| `useReactTable({ data, columns })` | `<Table data={data} columns={columns} />` |
| `columnHelper.accessor("name", …)` | `{ key: "name" }` |
| `accessorFn` | `accessor` |
| `header: "Name"` | `header: "Name"` (defaults to the humanised key) |
| `cell: (info) => …` | `render: ({ value, row, text }) => …` |
| `getSortedRowModel()` | on by default |
| `getFilteredRowModel()` | on by default |
| `getPaginationRowModel()` | `pagination` |
| `globalFilter` | `state.search`, or the `search` prop |
| `columnVisibility` | `state.hidden` |
| `columnOrder` | `state.order` |
| `rowSelection` | `state.selection` (an array of ids, not a record) |
| `manualPagination` / `manualSorting` / `manualFiltering` | `server` |
| `getRowId` | `getRowId` |
| `flexRender` | not needed |

The biggest difference: TanStack's state is several objects, Trapezium's is one. `onStateChange` gives you all of it, and it serialises.

## From AG Grid

| AG Grid | Trapezium |
|---|---|
| `columnDefs` | `columns` |
| `field` | `key` |
| `headerName` | `header` |
| `valueGetter` | `accessor` |
| `valueFormatter` | `format` |
| `cellRenderer` | `render` |
| `cellClass` | `className` |
| `pinned: "left"` | `pin: "start"` |
| `sortable`, `resizable` | the same, per column or per table |
| `filter: "agSetColumnFilter"` | `filter: "set"` |
| `filter: "agNumberColumnFilter"` | `filter: "range"` |
| `filter: "agDateColumnFilter"` | `filter: "date"` |
| `rowSelection: "multiple"` | `selection` |
| `getRowId` | `getRowId` |
| `onGridReady` / the grid API | state and `onStateChange` |
| `serverSideDatasource` / `IServerSideDatasource` | `server={{ distinct, all }}` and `onStateChange` |
| `setFilterParams.values` (a callback) | `server.distinct`, or `filter: { kind: "set", options }` |
| `exportDataAsCsv` | `export`, and `server.all` when the rows are on a server |
| `pagination: true` | `pagination` |
| `domLayout`, `rowHeight` | `density`, `maxHeight` |
| Enterprise: pivoting, grouping, aggregation | not offered, on purpose |

The API-object habit is the thing to unlearn: there is no imperative grid handle to grab. Everything is state, and you already know how to change state.

## From MUI DataGrid

| MUI | Trapezium |
|---|---|
| `columns={[{ field, headerName, width }]}` | `columns={[{ key, header, width }]}` |
| `renderCell` | `render` |
| `valueFormatter` | `format` |
| `checkboxSelection` | `selection` |
| `onRowSelectionModelChange` | `onSelectionChange` |
| `sortModel` / `filterModel` | `state.sort` / `state.filters` |
| `paginationModel` | `state.page`, `state.pageSize` |
| `slots` / `slotProps` | `classNames`, `toolbar`, `footer`, `emptyState` |
| `sx` | CSS tokens, or `classNames` |
| `getRowId` | `getRowId` |

You also stop shipping MUI, Emotion and their peer dependencies to get a table.

## What no longer exists

Grouping, aggregation, pivoting, tree data, spreadsheet-style formulas and Excel export are not in Trapezium and are not planned. If you rely on those, AG Grid Enterprise is genuinely the right tool and this is the wrong migration.
