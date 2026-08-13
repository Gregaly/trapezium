/**
 * Enough of a declaration for `tsc` to accept the component import.
 *
 * Svelte consumers get the real types from the component's own source, which
 * ships in the package — this exists so building the library does not require
 * the Svelte language tooling in the TypeScript program.
 */
declare module "*.svelte" {
  const component: unknown
  export default component
}
