import { defineConfig } from "tsup"

/**
 * Svelte packages ship source rather than a bundle, so a consumer's own
 * compiler handles the component. The TypeScript beside it is transpiled but
 * not bundled, the component is copied in next to it, and the entry's
 * declarations are hand-written — generating them would need the Svelte
 * language tooling inside the TypeScript program.
 */
export default defineConfig({
  entry: ["src/index.ts", "src/action.ts"],
  format: ["esm"],
  bundle: false,
  dts: { entry: ["src/action.ts"] },
  clean: true,
  sourcemap: true,
  target: "es2022",
})
