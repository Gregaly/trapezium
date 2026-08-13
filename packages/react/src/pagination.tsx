import { useEffect, useRef } from "react"
import { setPage, setPageSize, type TableState } from "@trapezium/core"

import { Icon } from "./icon.js"
import type { LinkComponent } from "./types.js"

/**
 * Moving through the rows.
 *
 * Four behaviours from one prop, because which one is right depends entirely on
 * the product — and nobody should have to change table library to change their
 * mind about it.
 *
 * All four keep a keyboard-reachable way forward. An infinite list that can
 * only be advanced by scrolling with a mouse is not a design decision, it is an
 * inaccessible one, so even infinite mode keeps a real button behind the
 * observer.
 */
export function Pagination({
  mode,
  state,
  update,
  total,
  pageCount,
  shown,
  pageSizeOptions,
  siblings,
  loading,
  buildHref,
  linkComponent,
  className,
}: {
  mode: "pages" | "simple" | "loadMore" | "infinite"
  state: TableState
  update: (next: (current: TableState) => TableState) => void
  total: number
  pageCount: number
  /** Rows on screen right now, which differs from the page size in append modes. */
  shown: number
  pageSizeOptions?: number[]
  siblings: number
  loading?: boolean
  buildHref?: (state: TableState) => string
  linkComponent?: LinkComponent
  className: string
}) {
  const hasMore = state.page < pageCount

  if (mode === "loadMore" || mode === "infinite") {
    return (
      <LoadMore
        hasMore={hasMore}
        loading={loading}
        shown={shown}
        total={total}
        onMore={() => update((current) => setPage(current, current.page + 1))}
      />
    )
  }

  // Nothing to page through, and nothing to configure: say nothing at all.
  if (pageCount <= 1 && !pageSizeOptions?.length) return null

  const first = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1
  const last = Math.min(state.page * state.pageSize, total)

  return (
    <div className={className}>
      <div className="tpz-toolbar-group">
        <span className="tpz-count" aria-live="polite">
          {total === 0 ? "No rows" : `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`}
        </span>

        {pageSizeOptions && pageSizeOptions.length > 0 && (
          <label className="tpz-count">
            <span className="tpz-sr">Rows per page</span>
            <select
              className="tpz-input"
              value={state.pageSize}
              onChange={(event) => update((current) => setPageSize(current, Number(event.target.value)))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav className="tpz-pages" aria-label="Pagination">
        <PageButton
          page={state.page - 1}
          disabled={state.page <= 1}
          label="Previous page"
          update={update}
          buildHref={buildHref}
          state={state}
          linkComponent={linkComponent}
        >
          <Icon name="chevronLeft" />
        </PageButton>

        {mode === "pages" &&
          pageNumbers(state.page, pageCount, siblings).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${String(index)}`} className="tpz-ellipsis" aria-hidden="true">
                …
              </span>
            ) : (
              <PageButton
                key={entry}
                page={entry}
                current={entry === state.page}
                label={`Page ${String(entry)}`}
                update={update}
                buildHref={buildHref}
                state={state}
                linkComponent={linkComponent}
              >
                {entry.toLocaleString()}
              </PageButton>
            ),
          )}

        {mode === "simple" && (
          <span className="tpz-count">
            {state.page.toLocaleString()} / {pageCount.toLocaleString()}
          </span>
        )}

        <PageButton
          page={state.page + 1}
          disabled={!hasMore}
          label="Next page"
          update={update}
          buildHref={buildHref}
          state={state}
          linkComponent={linkComponent}
        >
          <Icon name="chevronRight" />
        </PageButton>
      </nav>
    </div>
  )
}

function PageButton({
  page,
  children,
  label,
  current,
  disabled,
  update,
  state,
  buildHref,
  linkComponent: Link,
}: {
  page: number
  children: React.ReactNode
  label: string
  current?: boolean
  disabled?: boolean
  update: (next: (current: TableState) => TableState) => void
  state: TableState
  buildHref?: (state: TableState) => string
  linkComponent?: LinkComponent
}) {
  const className = "tpz-btn tpz-page"

  if (buildHref && !disabled) {
    const href = buildHref(setPage(state, page))
    const props = {
      href,
      className,
      "aria-label": label,
      "aria-current": current ? ("page" as const) : undefined,
      children,
    }
    return Link ? <Link {...props} /> : <a {...props} />
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={() => update((currentState) => setPage(currentState, page))}
    >
      {children}
    </button>
  )
}

function LoadMore({
  hasMore,
  loading,
  shown,
  total,
  onMore,
}: {
  hasMore: boolean
  loading?: boolean
  shown: number
  total: number
  onMore: () => void
}) {
  if (!hasMore && shown >= total) return null

  return (
    <div className="tpz-load-more">
      {hasMore && (
        <button type="button" className="tpz-btn" data-variant="outline" onClick={onMore} disabled={loading}>
          {loading ? <Icon name="spinner" className="tpz-spinner" /> : null}
          {loading ? "Loading" : `Load more (${shown.toLocaleString()} of ${total.toLocaleString()})`}
        </button>
      )}
    </div>
  )
}

/**
 * What infinite scrolling watches.
 *
 * It has to sit at the end of the rows, **inside the scroll container**, and be
 * observed against that container — not the viewport. A sentinel in the
 * pagination bar below the table is visible whenever the table is on screen, so
 * it fires immediately and again on every re-render, which loads the entire
 * dataset the moment the table appears. That is the bug this component exists
 * to make impossible.
 *
 * It also loads at most one page per render: the observer is disconnected as
 * soon as it fires, and the effect re-runs once the new rows are in. If the
 * sentinel is still visible after that — a short page in a tall container — it
 * fires again, which is the right answer to "there is still empty space".
 */
export function InfiniteSentinel({
  hasMore,
  loading,
  onMore,
  /** Re-observes when this changes, which is what makes it one page per render. */
  page,
}: {
  hasMore: boolean
  loading?: boolean
  onMore: () => void
  page: number
}) {
  const sentinel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // No observer, no automatic loading — the "load more" button below the
    // table is still there, so the feature degrades rather than disappearing.
    if (!hasMore || loading || typeof IntersectionObserver === "undefined") return

    const node = sentinel.current
    if (!node) return

    /*
      The scroll container when the table has its own height, and the viewport
      when it grows with the page. Watching the viewport for a table that
      scrolls internally is what makes a sentinel fire while the user is
      nowhere near the end of the rows.
    */
    const scroll = node.closest(".tpz-scroll")
    const scrolls = scroll instanceof HTMLElement && scroll.scrollHeight > scroll.clientHeight + 1

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        onMore()
      },
      {
        root: scrolls ? scroll : null,
        // Enough to start the next page just before the user reaches the end,
        // and not so much that a table sitting on screen loads everything.
        rootMargin: "96px",
      },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, onMore, page])

  return <div ref={sentinel} className="tpz-sentinel" aria-hidden="true" />
}

/**
 * Which page numbers to show.
 *
 * Always the first and last, always the current one and its neighbours, and a
 * gap where numbers were left out. The window is a fixed width, so the control
 * does not resize as the user pages through — which is what makes "next" stay
 * under the cursor.
 */
export function pageNumbers(page: number, pageCount: number, siblings: number): Array<number | "gap"> {
  const window = siblings * 2 + 5
  if (pageCount <= window) return range(1, pageCount)

  const start = Math.max(2, page - siblings)
  const end = Math.min(pageCount - 1, page + siblings)

  const pages: Array<number | "gap"> = [1]
  if (start > 2) pages.push("gap")
  pages.push(...range(start, end))
  if (end < pageCount - 1) pages.push("gap")
  pages.push(pageCount)

  return pages
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)
}
