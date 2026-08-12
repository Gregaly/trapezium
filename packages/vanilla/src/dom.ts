import { ICONS, iconPath } from "@trapezium/core"

/**
 * The smallest possible DOM helpers.
 *
 * No virtual DOM, no template language, no dependency. A table this size is
 * cheaper to rebuild than to diff, and the code stays something a person can
 * read in one sitting.
 */

type Attributes = Record<string, string | number | boolean | null | undefined>

/**
 * Creates an element.
 *
 * `class` and `text` are handled specially because they are what almost every
 * call needs; anything else is set as an attribute, and `false`, `null` and
 * `undefined` mean "leave it off" rather than "set it to the string false".
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: Array<Node | string | null | undefined> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)

  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue
    if (name === "class") node.className = String(value)
    else if (name === "text") node.textContent = String(value)
    else if (name === "html") node.innerHTML = String(value)
    else node.setAttribute(name, value === true ? "" : String(value))
  }

  for (const child of children) {
    if (child === null || child === undefined) continue
    node.append(typeof child === "string" ? document.createTextNode(child) : child)
  }

  return node
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

/** An icon from the core's set, stroked in `currentColor`. */
export function icon(name: string | false | undefined, size = 14, className?: string): SVGSVGElement | null {
  const path = iconPath(name)
  if (!path) return null

  const svg = document.createElementNS(SVG_NAMESPACE, "svg")
  svg.setAttribute("viewBox", "0 0 16 16")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.5")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute("aria-hidden", "true")
  if (className) svg.setAttribute("class", className)

  const shape = document.createElementNS(SVG_NAMESPACE, "path")
  shape.setAttribute("d", path)
  svg.append(shape)

  return svg
}

export { ICONS }

/** Replaces everything inside a node. */
export function fill(node: Element, children: Array<Node | string | null | undefined>): void {
  node.replaceChildren(...children.filter((child): child is Node | string => child !== null && child !== undefined))
}
