# Examples

Every example runs against the packages in this repository, not against a published version — so a change to the library shows up here immediately.

```sh
pnpm install
pnpm build       # the packages first; the examples import their built output
```

| | Framework | Run it | What it shows |
|---|---|---|---|
| [`playground`](playground) | React | `pnpm --filter @trapezium/playground build` then open `dist/index.html` | Every feature on one page: zero-config, everything switched on, infinite scroll, the card layout, and the empty, loading and error states |
| [`next-server`](next-server) | Next.js 15 | `pnpm --filter @trapezium/example-next-server dev` → [localhost:4300](http://localhost:4300) | Sorting, filtering and paging in the database; the whole view in the URL; server-rendered on the first paint; controls that work as links |
| [`vue-app`](vue-app) | Vue 3 | `pnpm --filter @trapezium/example-vue dev` → [localhost:4310](http://localhost:4310) | The same table bound with Vue reactivity, including a cell that renders a real Vue component |
| [`svelte-app`](svelte-app) | Svelte 5 | `pnpm --filter @trapezium/example-svelte dev` → [localhost:4320](http://localhost:4320) | Runes, `bind:tableState`, and the `use:trapezium` action |
| [`plain-html`](plain-html) | None | Serve this directory over HTTP and open `plain-html/index.html` | One stylesheet, one script tag, no build step at all |

`plain-html` needs a server rather than `file://`, because it loads its data with `fetch`. Anything will do:

```sh
npx serve .        # from the repository root
```

Each example is deliberately small and reads top to bottom. If something in the library is hard to use, it should be visible here first.
