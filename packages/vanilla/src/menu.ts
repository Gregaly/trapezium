import { el } from "./dom.js"

/**
 * A dropdown panel, in about eighty lines.
 *
 * `role="group"` rather than `role="menu"`: an ARIA menu may only contain menu
 * items, and a column's panel holds a filter form as well as actions.
 *
 * Appended to the document body, because a popover inside the table's scroll
 * container is clipped by it — and wrapped in an element carrying the table's
 * own class and theme, so every `--tpz-*` token still resolves out there.
 *
 * Only one is open at a time, which is what people expect and what stops a
 * screenful of orphaned menus after some enthusiastic clicking.
 */

let openMenu: { node: HTMLElement; dispose: () => void } | undefined

export type MenuOptions = {
  /** The element the menu is positioned against. */
  anchor: HTMLElement
  /** Which edge to line up with. */
  align?: "start" | "end"
  /** Names the menu for a screen reader. */
  label?: string
  /** Copied onto the wrapper so the menu is themed like the table it came from. */
  theme?: string
  width?: number
}

export function closeMenu(): void {
  openMenu?.dispose()
  openMenu = undefined
}

/**
 * Opens a menu and returns a function that closes it.
 *
 * `build` receives the close function so an item can dismiss the menu it lives
 * in without the caller threading state around.
 */
export function openMenuAt(
  options: MenuOptions,
  build: (close: () => void) => Array<Node | string | null | undefined>,
): () => void {
  closeMenu()

  const menu = el("div", { class: "tpz-menu", role: "group", "aria-label": options.label, tabindex: "-1" })
  const wrapper = el("div", { class: "tpz tpz-portal", "data-theme": options.theme }, [menu])
  if (options.width) menu.style.width = `${String(options.width)}px`

  const close = () => {
    if (openMenu?.node === wrapper) openMenu = undefined
    dispose()
  }

  menu.append(...(build(close).filter((child): child is Node | string => child !== null && child !== undefined)))
  document.body.append(wrapper)
  place()

  function place() {
    const rect = options.anchor.getBoundingClientRect()
    const size = menu.getBoundingClientRect()
    const margin = 4

    const left = Math.min(
      Math.max(margin, options.align === "end" ? rect.right - size.width : rect.left),
      window.innerWidth - size.width - margin,
    )

    // Flips above the anchor when there is not room below it.
    const below = rect.bottom + margin
    const top =
      below + size.height > window.innerHeight - margin && rect.top - size.height - margin > 0
        ? rect.top - size.height - margin
        : below

    wrapper.style.top = `${String(top)}px`
    wrapper.style.left = `${String(left)}px`
  }

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node
    if (wrapper.contains(target) || options.anchor.contains(target)) return
    close()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      close()
      options.anchor.focus()
      return
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return

    const items = [...menu.querySelectorAll<HTMLElement>("[data-menu-item]:not([disabled])")]
    if (items.length === 0) return

    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length

    items[next]?.focus()
  }

  document.addEventListener("pointerdown", onPointerDown, true)
  document.addEventListener("keydown", onKeyDown)
  // `true`, so the menu follows an ancestor scrolling and not only the window.
  window.addEventListener("scroll", place, true)
  window.addEventListener("resize", place)

  function dispose() {
    document.removeEventListener("pointerdown", onPointerDown, true)
    document.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("scroll", place, true)
    window.removeEventListener("resize", place)
    wrapper.remove()
  }

  openMenu = { node: wrapper, dispose }
  return close
}

export function menuItem(
  label: string,
  onSelect: () => void,
  options: { icon?: Node | null; disabled?: boolean } = {},
): HTMLElement {
  const item = el(
    "button",
    { type: "button", class: "tpz-menu-item", "data-menu-item": true, disabled: options.disabled },
    [options.icon, label],
  )
  item.addEventListener("click", onSelect)
  return item
}

export function menuSeparator(): HTMLElement {
  return el("div", { class: "tpz-menu-separator", role: "separator" })
}

export function menuLabel(text: string): HTMLElement {
  return el("div", { class: "tpz-menu-label", text })
}
