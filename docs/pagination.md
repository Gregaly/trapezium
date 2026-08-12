# Pagination

One prop, four behaviours, because which one is right depends entirely on the product — and nobody should have to change table library to change their mind about it.

```tsx
<Table data={rows} pagination={{ mode: "pages", pageSize: 25 }} />    // numbered
<Table data={rows} pagination={{ mode: "simple" }} />                  // previous / next
<Table data={rows} pagination={{ mode: "loadMore" }} />                // a button that appends
<Table data={rows} pagination={{ mode: "infinite" }} />                // appends on scroll
<Table data={rows} pagination={false} />                              // every row
```

`pagination` defaults to numbered pages of 25. `true` is the same thing.

## Options

```tsx
pagination={{
  mode: "pages",
  pageSize: 50,                        // also the load size in append modes
  pageSizeOptions: [25, 50, 100, 250], // adds the "rows per page" picker
  siblings: 2,                         // page buttons either side of the current one
}}
```

The numbered control always shows the first and last page, the current one and its neighbours, and a gap where numbers were left out. The window is a fixed width, so "next" stays under the cursor as you page.

## Append modes

`loadMore` and `infinite` keep every page loaded so far on screen rather than replacing one with the next. `infinite` watches a sentinel with an `IntersectionObserver` and starts loading 200px before the bottom, so the list feels continuous.

Both keep a real button. An infinite list that can only be advanced by scrolling with a mouse is not a design decision, it is an inaccessible one.

## With server data

In server mode the table does not slice anything — it asks. Give it the total so it knows how many pages there are:

```tsx
<Table data={page} total={2840} server pagination={{ pageSize: 50 }} onStateChange={fetchPage} />
```

For `loadMore` and `infinite` in server mode, append the new rows to the array you pass as `data` when the fetch resolves. The table renders what it is given.

## Changing the page size

Returns to page one, deliberately. Trying to keep the user's position across a size change sounds considerate and produces nonsense: row 130 is on page 6 at 25 a page and page 2 at 100, and neither is where they were looking.

## The invariant

Anything that changes which rows match — a filter, a search, a sort, a page size — resets to page one. Filtering while on page seven and landing on an empty page is the most common bug in hand-rolled tables, and it cannot happen here.
