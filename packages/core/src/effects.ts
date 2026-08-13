/**
 * The one flourish in the library.
 *
 * Dragging a column out of the table removes it, and a removal with no
 * animation reads as a bug — the eye has nothing to follow, so the column
 * appears to have vanished by accident. macOS solved this for the dock decades
 * ago: a small puff of smoke where the thing was, which says *deliberately
 * removed* in about four hundred milliseconds.
 *
 * It lives in the core because every adapter needs it and the alternative is
 * four copies. Like the CSV download, it touches the DOM only when called —
 * never at module scope — so importing the core on a server stays safe.
 */

export type PoofOptions = {
  /** Where the puff appears, in viewport coordinates. */
  x: number
  y: number
  /** Roughly the width of the thing that disappeared. Defaults to 48. */
  size?: number
  /** Copied onto the element so the puff is themed like the table it came from. */
  theme?: string
}

/**
 * Puffs a small cloud at a point and cleans up after itself.
 *
 * Does nothing where there is no document, and nothing for anyone who has asked
 * for reduced motion — for whom an unexpected animation is not a delight.
 */
export function poof(options: PoofOptions): void {
  if (typeof document === "undefined") return
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return

  const size = options.size ?? 48
  const node = document.createElement("div")
  node.className = "tpz tpz-poof"
  if (options.theme) node.dataset["theme"] = options.theme
  node.setAttribute("aria-hidden", "true")
  node.style.left = `${String(options.x - size / 2)}px`
  node.style.top = `${String(options.y - size / 2)}px`
  node.style.width = `${String(size)}px`
  node.style.height = `${String(size)}px`

  document.body.append(node)

  // Both, because `animationend` does not fire if the element is never painted
  // — a tab in the background, a reduced-motion override, a stylesheet that
  // failed to load — and a stray div left in the body would be worse than no
  // animation at all.
  node.addEventListener("animationend", () => node.remove(), { once: true })
  setTimeout(() => node.remove(), 800)
}
