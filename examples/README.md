# Examples

Every example runs against the packages in this repository, not a published version — so a change to the library shows up here immediately.

Once, from the repository root:

```sh
pnpm install
pnpm build      # the packages; the examples import their built output
```

Then pick one. Each runs on its own port, so several can be open at the same time.

| | Framework | Run it | |
|---|---|---|---|
| [`playground`](playground) | React | `pnpm --filter @trapezium/playground build` | Then open `examples/playground/dist/index.html` |
| [`next-server`](next-server) | Next.js 15 | `pnpm --filter @trapezium/example-next-server dev` | [localhost:4300](http://localhost:4300) |
| [`vue-app`](vue-app) | Vue 3 | `pnpm --filter @trapezium/example-vue dev` | [localhost:4310](http://localhost:4310) |
| [`svelte-app`](svelte-app) | Svelte 5 | `pnpm --filter @trapezium/example-svelte dev` | [localhost:4320](http://localhost:4320) |
| [`plain-html`](plain-html) | None | `pnpm --filter @trapezium/example-plain-html dev` | [localhost:4330](http://localhost:4330) |

## What each one is for

**`playground`** — every feature on one page: the zero-configuration table, one with everything switched on, infinite scroll, the card layout, and the empty, loading and error states. There is a light/dark/system switch at the top right. Built with esbuild and opened as a file, so there is no dev server to leave running.

**`next-server`** — the one to look at for a real application. Sorting, filtering and paging happen in the "database" (`invoices.ts`), the whole view lives in the query string, and the first paint is server-rendered and already correct. Sort a column and watch the address bar; then reload, or press back. Every control is also a real link, so it works before the client bundle loads.

**`vue-app`** and **`svelte-app`** — the same table, the same markup, the same stylesheet, bound with each framework's reactivity. The Vue one includes a cell that renders a real Vue component; the Svelte one uses `bind:tableState` and the `use:trapezium` action.

**`plain-html`** — one stylesheet, one script tag, no build step and no framework. It needs a server rather than `file://` because it loads its data with `fetch`; the `dev` script is a twenty-line Node static server with no dependencies, serving the repository root so the page can reach `packages/vanilla`.

## Testing the library itself

```sh
pnpm test        # 185 tests: core, React, Vue, Svelte, vanilla, plus an axe pass
pnpm test:watch
pnpm typecheck
pnpm check       # typecheck and test together
```

Each example is deliberately small and reads top to bottom. If something in the library is awkward to use, it should be visible here first.
