import type { ReactNode } from "react"

import "@trapezium/react/styles.css"
import "./globals.css"

export const metadata = {
  title: "Trapezium — server-side data",
  description: "Sorting, filtering and paging in the database, with the state in the URL.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
