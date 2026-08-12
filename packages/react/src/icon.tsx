import { ICONS, iconPath, type IconName } from "@trapezium/core"

/**
 * An icon.
 *
 * Stroked paths from the core's own set, rendered inline. No icon library, no
 * sprite sheet, no font — a table should not make anyone install a dependency
 * to get a sort arrow.
 *
 * Always `aria-hidden`: every icon in this library sits beside a label or
 * inside a control that has one of its own, so announcing it would be noise.
 */
export function Icon({
  name,
  size = 14,
  className,
}: {
  name: IconName | string | false | undefined
  /** Pixels. The default matches the header row's optical weight. */
  size?: number
  className?: string
}) {
  const path = iconPath(name)
  if (!path) return null

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  )
}

export { ICONS }
export type { IconName }
