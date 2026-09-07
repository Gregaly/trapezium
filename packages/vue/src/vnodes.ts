import { h, type VNode, type VNodeChild } from "vue"
import { ServerElement, ServerText, type ServerNode } from "@trapezium/vanilla"

/**
 * The renderer's server tree as Vue VNodes.
 *
 * Rendering the tree through Vue rather than as a string is what lets the
 * table's server markup carry things only Vue can render: a template slot in
 * the toolbar, a component in a cell. Where the tree holds a marker for one,
 * the VNode the caller supplied goes in its place.
 */

/** What replaces a marker element in the tree. */
export type Fillings = {
  /** Keyed by the marker's `data-tpz-vnode` value. */
  cells: ReadonlyMap<string, VNodeChild>
  /** Keyed by the marker's `data-tpz-slot` value. */
  slots: ReadonlyMap<string, () => VNodeChild>
}

/** Attributes that are boolean on their element, which Vue writes as bare names. */
const BOOLEAN_ATTRIBUTES = new Set(["checked", "disabled", "selected", "hidden", "readonly", "required", "multiple"])

export function toVNodes(node: ServerNode, fillings: Fillings): VNodeChild {
  if (node instanceof ServerText) return node.data
  if (!(node instanceof ServerElement)) return null

  const cell = node.getAttribute("data-tpz-vnode")
  if (cell !== null) return h("span", {}, [fillings.cells.get(cell) ?? null])

  const slot = node.getAttribute("data-tpz-slot")
  if (slot !== null) return h("span", { style: "display: contents;" }, [fillings.slots.get(slot)?.() ?? null])

  const props: Record<string, unknown> = {}
  for (const [name, value] of node.attributes) {
    props[name] = BOOLEAN_ATTRIBUTES.has(name) ? true : value
  }

  const children = node.childNodes.map((child) => toVNodes(child, fillings))
  return h(node.tagName, props, children)
}

/** The whole tree, from its root. */
export function treeToVNode(root: ServerElement, fillings: Fillings): VNode {
  const vnode = toVNodes(root, fillings)
  if (vnode === null || typeof vnode !== "object" || Array.isArray(vnode)) {
    throw new Error("Trapezium: the table rendered no element")
  }
  return vnode as VNode
}
