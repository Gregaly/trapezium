import { defineConfig } from "tsup"

export default defineConfig({
  /*
    The testing entry ships the full-spectrum dataset and the custom types the
    conformance suite uses, so an adapter — or a consumer checking their own
    integration — can exercise every type without inventing data first.
  */
  entry: ["src/index.ts", "src/testing/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
})
