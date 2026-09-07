export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  telemetry: false,
  devServer: { port: 4350 },
  css: ["@trapezium/vue/styles.css", "~/app.css"],
})
