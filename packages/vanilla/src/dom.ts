import { ICONS, iconPath } from "@trapezium/core"

/**
 * The smallest possible DOM helpers.
 *
 * No virtual DOM, no template language, no dependency. A table this size is
 * cheaper to rebuild than to diff, and the code stays something a person can
 * read in one sitting.
 */

type Attributes = Record<string, string | number | boolean | null | undefined>

/*
  Where elements come from. The browser's document, unless a server render has
  put its own in place for the duration of a build — see `renderToString`.
  Looked up on every call rather than once, because the core rule is that
  nothing touches `document` at module scope.
*/
let serverDocument: Document | undefined

/** The document to build against right now. */
export function currentDocument(): Document {
  return serverDocument ?? document
}

/** Runs `build` with every element created against `doc` instead of the page. */
export function withDocument<T>(doc: Document, build: () => T): T {
  const previous = serverDocument
  serverDocument = doc
  try {
    return build()
  } finally {
    serverDocument = previous
  }
}

/**
 * Creates an element.
 *
 * `class` and `text` are handled specially because they are what almost every
 * call needs; anything else is set as an attribute, and `false`, `null` and
 * `undefined` mean "leave it off" rather than "set it to the string false".
 *
 * There is deliberately no way to pass markup. Everything a table renders comes
 * from somebody's database, and a helper that writes `innerHTML` is how a name
 * field ends up executing a script. Values become text; a caller who wants
 * richer output supplies a node from their own renderer.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: Array<Node | string | null | undefined> = [],
): HTMLElementTagNameMap[K] {
  const node = currentDocument().createElement(tag)

  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue
    if (name === "class") node.className = String(value)
    else if (name === "text") node.textContent = String(value)
    else node.setAttribute(name, value === true ? "" : String(value))
  }

  for (const child of children) {
    if (child === null || child === undefined) continue
    node.append(typeof child === "string" ? text(child) : child)
  }

  return node
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

/** An icon from the core's set, stroked in `currentColor`. */
export function icon(name: string | false | undefined, size = 14, className?: string): SVGSVGElement | null {
  const path = iconPath(name)
  if (!path) return null

  const svg = currentDocument().createElementNS(SVG_NAMESPACE, "svg")
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

  const shape = currentDocument().createElementNS(SVG_NAMESPACE, "path")
  shape.setAttribute("d", path)
  svg.append(shape)

  return svg
}

export { ICONS }

/** A text node, from whichever document is current. */
export function text(value: string): Text {
  return currentDocument().createTextNode(value)
}

/** An empty fragment, from whichever document is current. */
export function fragment(): DocumentFragment {
  return currentDocument().createDocumentFragment()
}

/** Replaces everything inside a node. */
export function fill(node: Element, children: Array<Node | string | null | undefined>): void {
  node.replaceChildren(...children.filter((child): child is Node | string => child !== null && child !== undefined))
}
