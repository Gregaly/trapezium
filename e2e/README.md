# End-to-end tests

The examples, driven the way a person drives them, in Chromium, Firefox and
WebKit.

```sh
pnpm test:e2e                      # everything
pnpm test:e2e --project=chromium    # one engine, while iterating
pnpm test:e2e --ui                  # watch it happen
```

Nothing needs to be running first: the config starts each example itself and
reuses one that is already up.

| | What it covers |
|---|---|
| `next-server.spec.ts` | Server-side data: the first paint, sorting and paging with **no JavaScript at all**, the URL as the whole view, the back button, set filters that ask the server, and an export that contains every matching row. |
| `adapters.spec.ts` | The same script against Vue, Svelte and plain JavaScript — sort, search, filter, page, select, export, reorder, hide. They share a renderer, so this is what catches the day one of them stops. |
| `playground.spec.ts` | The things that only exist with real layout: load more, infinite scroll, the card layout at 375px, dragging a column out of the table, density, and the empty, loading and error states. |
| `accessibility.spec.ts` | An axe pass (WCAG 2.1 AA) over every example, with a menu open as well as closed, plus the keyboard paths. |
| `visual.spec.ts` | Screenshots at three widths in both themes, and an open menu. |

## Screenshots

Baselines are per platform, because text is not rasterised identically on macOS
and in a Linux container. A platform with no baseline **skips** rather than
failing on a picture nobody has agreed to.

```sh
pnpm test:e2e:visual --update-snapshots   # accept a deliberate change
```

To record the Linux baselines CI compares against, run it in the same container
CI uses:

```sh
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -c "corepack enable && pnpm install && pnpm build && \
           pnpm --filter @trapezium/playground build && \
           pnpm test:e2e:visual --update-snapshots"
```

## Two things are deliberately not tested here

**Dragging a column out of the table** runs in Chromium only. Playwright can
only synthesise native HTML5 drag-and-drop there; elsewhere the test would be
testing the harness.

**Tab order** is skipped in WebKit, which does not move focus to buttons unless
the operating system has "Full Keyboard Access" switched on — that is Safari's
setting, not this table's markup.
