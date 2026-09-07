/**
 * Enough of a DOM to build a table on a server.
 *
 * The DOM renderer is the one implementation of the markup for Vue, Svelte and
 * plain JavaScript, and a second, string-based copy of it would drift — that
 * is the failure that turns four packages into four products. So on a server
 * the same rendering code runs unchanged against these classes, and the tree
 * it builds is written out as HTML.
 *
 * Only what the renderer touches while building is here: elements, text,
 * attributes, `style`, `dataset`, the reflected form properties, the few
 * selectors the layout pass uses, and no-op listeners. Nothing measures, so a
 * frozen column is written with an offset of zero — which is where it is
 * before anyone scrolls. The live table replaces this markup on mount and
 * measures for itself.
 *
 * Serialisation follows the HTML fragment serialisation algorithm exactly,
 * because the promise is that a server render and a client render are the same
 * bytes, and a test compares them.
 */

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
])

/** Attribute-reflecting boolean properties, with the attribute each one writes. */
const REFLECTED_BOOLEANS: Record<string, string> = {
  disabled: "disabled",
  defaultChecked: "checked",
  defaultSelected: "selected",
  hidden: "hidden",
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttribute(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/"/g, "&quot;")
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function camel(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export class ServerNode {
  parentNode: ServerElement | null = null

  get textContent(): string {
    return ""
  }

  set textContent(_value: string) {}

  get nextSibling(): ServerNode | null {
    const siblings = this.parentNode?.childNodes
    if (!siblings) return null
    return siblings[siblings.indexOf(this) + 1] ?? null
  }

  get previousSibling(): ServerNode | null {
    const siblings = this.parentNode?.childNodes
    if (!siblings) return null
    return siblings[siblings.indexOf(this) - 1] ?? null
  }

  get isConnected(): boolean {
    let node: ServerNode | null = this
    while (node) {
      if (node instanceof ServerElement && node.tagName === "#document") return true
      node = node.parentNode
    }
    return false
  }

  remove(): void {
    const siblings = this.parentNode?.childNodes
    if (!siblings) return
    siblings.splice(siblings.indexOf(this), 1)
    this.parentNode = null
  }

  before(...nodes: Array<ServerNode | string>): void {
    const parent = this.parentNode
    if (!parent) return
    parent.insertAt(parent.childNodes.indexOf(this), nodes)
  }

  after(...nodes: Array<ServerNode | string>): void {
    const parent = this.parentNode
    if (!parent) return
    parent.insertAt(parent.childNodes.indexOf(this) + 1, nodes)
  }

  serialize(): string {
    return ""
  }
}

export class ServerText extends ServerNode {
  constructor(public data: string) {
    super()
  }

  override get textContent(): string {
    return this.data
  }

  override set textContent(value: string) {
    this.data = value
  }

  override serialize(): string {
    return escapeText(this.data)
  }
}

/**
 * The inline style of one element.
 *
 * Property order is insertion order and a cleared property leaves the
 * attribute behind, empty — which is what a browser does, and what the client
 * markup therefore contains.
 */
class ServerStyle {
  private readonly declarations = new Map<string, string>()
  touched = false

  constructor(private readonly owner: ServerElement) {
    return new Proxy(this, {
      get: (target, key) => {
        if (typeof key === "symbol" || key in target) return Reflect.get(target, key)
        return target.declarations.get(kebab(key)) ?? ""
      },
      set: (target, key, value) => {
        if (typeof key === "symbol" || key in target) return Reflect.set(target, key, value)
        target.setProperty(kebab(key), String(value))
        return true
      },
    })
  }

  setProperty(name: string, value: string): void {
    // Clearing what was never set changes nothing, and a browser then leaves
    // the element without a `style` attribute at all.
    if (value === "" && !this.declarations.has(name)) return
    this.touched = true
    if (value === "") this.declarations.delete(name)
    else this.declarations.set(name, value)
    this.owner.styleChanged()
  }

  removeProperty(name: string): void {
    if (!this.declarations.has(name)) return
    this.touched = true
    this.declarations.delete(name)
    this.owner.styleChanged()
  }

  getPropertyValue(name: string): string {
    return this.declarations.get(name) ?? ""
  }

  get cssText(): string {
    return [...this.declarations].map(([name, value]) => `${name}: ${value};`).join(" ")
  }
}

export class ServerElement extends ServerNode {
  readonly attributes = new Map<string, string>()
  readonly childNodes: ServerNode[] = []
  readonly style: ServerStyle & Record<string, string>
  readonly dataset: Record<string, string | undefined>

  constructor(
    readonly tagName: string,
    readonly namespaceURI: string | null = null,
  ) {
    super()
    this.style = new ServerStyle(this) as ServerStyle & Record<string, string>

    this.dataset = new Proxy({} as Record<string, string | undefined>, {
      get: (_, key) => (typeof key === "string" ? this.getAttribute(`data-${kebab(key)}`) ?? undefined : undefined),
      set: (_, key, value) => {
        if (typeof key === "string") this.setAttribute(`data-${kebab(key)}`, String(value))
        return true
      },
      deleteProperty: (_, key) => {
        if (typeof key === "string") this.removeAttribute(`data-${kebab(key)}`)
        return true
      },
      has: (_, key) => typeof key === "string" && this.hasAttribute(`data-${kebab(key)}`),
      ownKeys: () =>
        [...this.attributes.keys()].filter((name) => name.startsWith("data-")).map((name) => camel(name.slice(5))),
    })

    return new Proxy(this, {
      set: (target, key, value) => {
        // The reflected booleans: `box.disabled = true` writes the attribute.
        if (typeof key === "string" && key in REFLECTED_BOOLEANS) {
          const attribute = REFLECTED_BOOLEANS[key] ?? key
          if (value) target.setAttribute(attribute, "")
          else target.removeAttribute(attribute)
          return true
        }
        if (key === "draggable") {
          target.setAttribute("draggable", value ? "true" : "false")
          return true
        }
        return Reflect.set(target, key, value)
      },
      get: (target, key) => {
        if (typeof key === "string" && key in REFLECTED_BOOLEANS) {
          return target.hasAttribute(REFLECTED_BOOLEANS[key] ?? key)
        }
        if (key === "draggable") return target.getAttribute("draggable") === "true"
        return Reflect.get(target, key)
      },
    })
  }

  /* ── Attributes ────────────────────────────────────────────────────────── */

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }

  get className(): string {
    return this.getAttribute("class") ?? ""
  }

  set className(value: string) {
    this.setAttribute("class", value)
  }

  get classList(): { contains(name: string): boolean } {
    return { contains: (name) => this.className.split(/\s+/).includes(name) }
  }

  get id(): string {
    return this.getAttribute("id") ?? ""
  }

  /** Called by the style object: a browser writes `style` when it first changes. */
  styleChanged(): void {
    this.setAttribute("style", this.style.cssText)
  }

  /*
    Form state that is not an attribute. `checked` and `indeterminate` are
    remembered but not written; the renderer writes `defaultChecked`, which is
    the attribute, alongside them.
  */
  checked = false
  indeterminate = false

  get value(): string {
    if (this.tagName === "select") {
      const chosen = this.elements().find((option) => option.hasAttribute("selected"))
      return chosen?.getAttribute("value") ?? this.elements()[0]?.getAttribute("value") ?? ""
    }
    return this.getAttribute("value") ?? ""
  }

  set value(next: string) {
    if (this.tagName === "select") {
      for (const option of this.elements()) {
        if (option.getAttribute("value") === next) option.setAttribute("selected", "")
        else option.removeAttribute("selected")
      }
      return
    }
    this.setAttribute("value", next)
  }

  /* ── Tree ──────────────────────────────────────────────────────────────── */

  private adopt(node: ServerNode | string): ServerNode {
    const child = typeof node === "string" ? new ServerText(node) : node
    if (child instanceof ServerElement && child.tagName === "#fragment") return child
    child.remove()
    child.parentNode = this
    return child
  }

  /** Inserts, unwrapping a fragment into its children the way a browser does. */
  insertAt(index: number, nodes: Array<ServerNode | string>): void {
    const flat: ServerNode[] = []
    for (const node of nodes) {
      const adopted = this.adopt(node)
      if (adopted instanceof ServerElement && adopted.tagName === "#fragment") {
        for (const child of [...adopted.childNodes]) {
          child.remove()
          child.parentNode = this
          flat.push(child)
        }
      } else {
        flat.push(adopted)
      }
    }
    this.childNodes.splice(index, 0, ...flat)
  }

  append(...nodes: Array<ServerNode | string>): void {
    this.insertAt(this.childNodes.length, nodes)
  }

  appendChild<T extends ServerNode>(node: T): T {
    this.append(node)
    return node
  }

  prepend(...nodes: Array<ServerNode | string>): void {
    this.insertAt(0, nodes)
  }

  replaceChildren(...nodes: Array<ServerNode | string>): void {
    for (const child of [...this.childNodes]) child.remove()
    this.append(...nodes)
  }

  contains(node: ServerNode | null): boolean {
    let current: ServerNode | null = node
    while (current) {
      if (current === this) return true
      current = current.parentNode
    }
    return false
  }

  elements(): ServerElement[] {
    return this.childNodes.filter((child): child is ServerElement => child instanceof ServerElement)
  }

  get children(): ServerElement[] {
    return this.elements()
  }

  get firstChild(): ServerNode | null {
    return this.childNodes[0] ?? null
  }

  get lastChild(): ServerNode | null {
    return this.childNodes[this.childNodes.length - 1] ?? null
  }

  get firstElementChild(): ServerElement | null {
    return this.elements()[0] ?? null
  }

  get childElementCount(): number {
    return this.elements().length
  }

  override get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("")
  }

  override set textContent(value: string) {
    this.replaceChildren(value)
  }

  /* ── Queries ───────────────────────────────────────────────────────────── */

  /**
   * Compound selectors only — `tag`, `.class`, `[attr]`, `[attr="value"]`,
   * chained — which is every selector the renderer uses while building.
   */
  matches(selector: string): boolean {
    const parts = selector.match(/[a-z][\w-]*|\.[\w-]+|\[[^\]]+\]/gi) ?? []
    return parts.every((part) => {
      if (part.startsWith(".")) return this.classList.contains(part.slice(1))
      if (part.startsWith("[")) {
        const [, name, , value] = /^\[([^=\]]+)(=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]$/.exec(part) ?? []
        if (!name) return false
        if (value === undefined && !part.includes("=")) return this.hasAttribute(name)
        const expected = /^\[[^=\]]+=(?:"([^"]*)"|'([^']*)'|([^\]]*))\]$/.exec(part)
        const wanted = expected?.[1] ?? expected?.[2] ?? expected?.[3] ?? ""
        return this.getAttribute(name) === wanted
      }
      return this.tagName === part.toLowerCase()
    })
  }

  querySelectorAll(selector: string): ServerElement[] {
    const found: ServerElement[] = []
    const walk = (node: ServerElement) => {
      for (const child of node.elements()) {
        if (child.matches(selector)) found.push(child)
        walk(child)
      }
    }
    walk(this)
    return found
  }

  querySelector(selector: string): ServerElement | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  closest(selector: string): ServerElement | null {
    let node: ServerElement | null = this
    while (node) {
      if (node.matches(selector)) return node
      node = node.parentNode
    }
    return null
  }

  /* ── Things a server cannot do ─────────────────────────────────────────── */

  addEventListener(): void {}
  removeEventListener(): void {}
  setPointerCapture(): void {}
  releasePointerCapture(): void {}
  focus(): void {}

  getBoundingClientRect(): { x: number; y: number; width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }
  }

  get scrollHeight(): number {
    return 0
  }

  get clientHeight(): number {
    return 0
  }

  /* ── Serialisation ─────────────────────────────────────────────────────── */

  get innerHTML(): string {
    return this.childNodes.map((child) => child.serialize()).join("")
  }

  get outerHTML(): string {
    return this.serialize()
  }

  override serialize(): string {
    if (this.tagName === "#fragment" || this.tagName === "#document") return this.innerHTML

    const attributes = [...this.attributes]
      .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
      .join("")

    if (VOID_ELEMENTS.has(this.tagName) && this.namespaceURI === null) {
      return `<${this.tagName}${attributes}>`
    }

    return `<${this.tagName}${attributes}>${this.innerHTML}</${this.tagName}>`
  }
}

/** The document the renderer builds against on a server. */
export class ServerDocument extends ServerElement {
  constructor() {
    super("#document")
  }

  createElement(tag: string): ServerElement {
    return new ServerElement(tag.toLowerCase())
  }

  createElementNS(namespace: string, tag: string): ServerElement {
    return new ServerElement(tag, namespace)
  }

  createTextNode(text: string): ServerText {
    return new ServerText(text)
  }

  createDocumentFragment(): ServerElement {
    return new ServerElement("#fragment")
  }

  /** A server has no page to search; the renderer is always given an element. */
  override querySelector(): null {
    return null
  }
}
