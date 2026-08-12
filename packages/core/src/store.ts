/**
 * A minimal observable store.
 *
 * Exists so every adapter binds to state the same way: React through
 * `useSyncExternalStore`, Vue through a `shallowRef`, Svelte through the store
 * contract, vanilla through `subscribe`. One implementation of the transitions,
 * four bindings, no divergence.
 *
 * Deliberately tiny. A table does not need a reducer framework, and shipping
 * one in a dependency-free core would be a joke at the user's expense.
 */

import { DEFAULT_STATE } from "./state.js"
import type { PartialTableState, TableState } from "./types.js"
import { shallowEqual } from "./util.js"

export type Store<T> = {
  /** The current value. Safe to call during render, including on a server. */
  get(): T
  /** Replaces the value, or derives the next one from the current. */
  set(next: T | ((current: T) => T)): void
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(value) : next
      // Identity is the contract every framework binding relies on: an update
      // that changes nothing must not be published, or a controlled table
      // re-renders on every keystroke it ignored.
      if (Object.is(resolved, value)) return
      value = resolved
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type TableStore = Store<TableState> & {
  /** Applies a partial update, leaving everything else alone. */
  patch(partial: PartialTableState): void
  /** Runs a transition from `state.ts` against the current state. */
  apply(transition: (state: TableState) => TableState): void
  /** Back to the state the table started with. */
  reset(): void
}

/** A store holding table state, with the conveniences an adapter needs. */
export function createTableStore(initial?: PartialTableState): TableStore {
  const start: TableState = { ...DEFAULT_STATE, ...initial }
  const store = createStore(start)

  return {
    ...store,
    patch(partial) {
      store.set((current) => {
        const next = { ...current, ...partial }
        return shallowEqual(current, next) ? current : next
      })
    },
    apply(transition) {
      store.set((current) => {
        const next = transition(current)
        return shallowEqual(current, next) ? current : next
      })
    },
    reset() {
      store.set(start)
    },
  }
}
