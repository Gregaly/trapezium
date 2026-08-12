import { createContext, useContext } from "react"

/**
 * What a portalled menu needs to know about the table it belongs to.
 *
 * Menus render into `document.body`, because a popover inside the table's
 * scroll container is clipped by it. That takes them outside the element every
 * design token is defined on, so they carry the theme with them instead — a
 * wrapper with the same class and the same `data-theme`, and the tokens
 * resolve exactly as they do inside the table.
 */
export type TableContextValue = {
  theme: "light" | "dark" | undefined
  density: string
}

export const TableContext = createContext<TableContextValue>({ theme: undefined, density: "normal" })

export function useTableContext(): TableContextValue {
  return useContext(TableContext)
}
