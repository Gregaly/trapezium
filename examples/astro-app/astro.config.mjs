import node from "@astrojs/node"
import react from "@astrojs/react"
import svelte from "@astrojs/svelte"
import vue from "@astrojs/vue"
import { defineConfig } from "astro/config"

/**
 * Three islands on one page, one per framework, rendered on the server per
 * request so the view in the URL is the view in the markup.
 */
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), vue(), svelte()],
  server: { port: 4370 },
  devToolbar: { enabled: false },
})
