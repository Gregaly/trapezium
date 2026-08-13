import type { NextConfig } from "next"

const config: NextConfig = {
  // The packages are TypeScript sources in this repository rather than
  // published builds, so Next compiles them along with the app.
  transpilePackages: ["@trapezium/react", "@trapezium/core"],
}

export default config
