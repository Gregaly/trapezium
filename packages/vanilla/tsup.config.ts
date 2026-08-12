import { defineConfig } from "tsup"

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
  },
  /*
    A second, self-contained build for a script tag. The core is bundled in
    rather than external, because "no build step" has to mean no build step —
    one URL, one file, a table.
  */
  {
    entry: { trapezium: "src/index.ts" },
    format: ["iife"],
    globalName: "Trapezium",
    outExtension: () => ({ js: ".global.js" }),
    minify: true,
    target: "es2022",
    noExternal: ["@trapezium/core"],
  },
])
