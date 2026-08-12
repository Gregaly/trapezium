import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { cx } from "./classes.js"

/**
 * A dropdown menu.
 *
 * Written rather than pulled from a component library on purpose: a table
 * library that depends on Radix forces that dependency, and its version, on
 * every React consumer — and a Vue user cannot have it at all. What is here is
 * the part that actually matters: it opens on click, closes on escape, on an
 * outside pointer press and on selection, moves focus with the arrow keys,
 * returns focus to the trigger, and describes itself to a screen reader.
 *
 * Two details worth keeping:
 *
 * - It renders into `document.body`. The table body is a scroll container with
 *   `overflow: auto`, and a menu positioned inside one is clipped by it.
 * - Nothing is measured or portalled until it opens, and it can only open in a
 *   browser, so a server render never touches any of this.
 */

export type MenuAlign = "start" | "end"

export function Menu({
  trigger,
  children,
  align = "start",
  label,
  className,
  width,
}: {
  /** Rendered with the props a trigger needs — spread them onto your button. */
  trigger: (props: TriggerProps, open: boolean) => ReactNode
  /** Called with a function that closes the menu, for items that should. */
  children: (close: () => void) => ReactNode
  align?: MenuAlign
  /** Names the menu for a screen reader. */
  label?: string
  className?: string
  width?: number | string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | undefined>()

  const close = useCallback(() => {
    setOpen(false)
    // Focus goes back where it came from, or the user is stranded at the top of
    // the document after every menu they close.
    triggerRef.current?.focus()
  }, [])

  const place = useCallback(() => {
    const anchor = triggerRef.current
    const menu = menuRef.current
    if (!anchor || !menu) return

    const rect = anchor.getBoundingClientRect()
    const size = menu.getBoundingClientRect()
    const margin = 4

    let left = align === "end" ? rect.right - size.width : rect.left
    left = Math.min(Math.max(margin, left), window.innerWidth - size.width - margin)

    // Flips above the trigger when there is not room below it.
    const below = rect.bottom + margin
    const top = below + size.height > window.innerHeight - margin && rect.top - size.height - margin > 0
      ? rect.top - size.height - margin
      : below

    setPosition({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        close()
      }
    }

    const reposition = () => place()

    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    // `true` on scroll, so the menu follows an ancestor scrolling rather than
    // only the window — the table's own scroll container is one.
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
    }
  }, [open, close, place])

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return

    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]:not([disabled])") ?? [])]
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

  const triggerProps: TriggerProps = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": open ? id : undefined,
    onClick: (event) => {
      event.stopPropagation()
      setOpen((current) => !current)
    },
    onKeyDown: (event) => {
      if (event.key === "ArrowDown" && !open) {
        event.preventDefault()
        setOpen(true)
      }
    },
  }

  return (
    <>
      {trigger(triggerProps, open)}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            ref={menuRef}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            className={cx("tpz-menu", className)}
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width,
              // Hidden for the single frame between mounting and measuring, so
              // the menu never appears in the corner and jumps.
              visibility: position ? "visible" : "hidden",
            }}
            onKeyDown={onMenuKeyDown}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  )
}

export type TriggerProps = {
  ref: (node: HTMLElement | null) => void
  "aria-haspopup": "menu"
  "aria-expanded": boolean
  "aria-controls": string | undefined
  onClick: (event: React.MouseEvent) => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

export function MenuItem({
  children,
  onSelect,
  disabled,
  icon,
  className,
}: {
  children: ReactNode
  onSelect?: () => void
  disabled?: boolean
  icon?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item=""
      disabled={disabled}
      className={cx("tpz-menu-item", className)}
      onClick={onSelect}
    >
      {icon}
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="tpz-menu-separator" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="tpz-menu-label">{children}</div>
}
