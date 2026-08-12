import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "react-dom"],
  // Kept out of the bundle so a consumer resolves one copy of the core, and so
  // a fix there does not need every adapter republished.
  banner: { js: '"use client";' },
})
