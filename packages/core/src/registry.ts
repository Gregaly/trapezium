/**
 * The type registry.
 *
 * A type knows five things about a value: how to render it as text, how to
 * order it, how to compare it against a filter, which control that filter
 * should be, and which icon labels its column. Everything else about a table
 * follows from those.
 *
 * Types are data in a map rather than branches in a switch, which is the whole
 * point: `defineType` gives a user's own type every capability a built-in has,
 * everywhere — cells, headers, sorting, filtering, search and export.
 */

import {
  DEFAULT_FORMAT,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  optionLabel,
  toDate,
  toNumber,
  toText,
} from "./format.js"
import type {
  Align,
  FilterKind,
  FilterOperator,
  FormatContext,
  FormatOptions,
} from "./types.js"
import { compareUnknown, isEmpty } from "./util.js"

/** What a value is normalised to before it is ordered or compared. */
export type Comparable = string | number | boolean | null

/**
 * Everything the library knows about one data type.
 *
 * Only `name` is required. An omitted property falls back to the behaviour of
 * `text`, so a minimal custom type is three lines.
 */
export type TypeDef = {
  name: string
  /** Cell and header alignment. Defaults to `start`. */
  align?: Align
  /** Monospaced cells. Suits identifiers and code, not prose. */
  mono?: boolean
  /** Whether columns of this type can be ordered. Defaults to true. */
  sortable?: boolean
  /** Whether global search looks inside columns of this type. Defaults to true. */
  searchable?: boolean
  /** The filter control this type deserves. Defaults to `text`. */
  filter?: FilterKind
  /** Comparisons that make sense for this type. */
  operators?: readonly FilterOperator[]
  /** Header icon name from the built-in set, or `false` for none. */
  icon?: string | false

  /** Value to display. Defaults to plain text. */
  format?: (value: unknown, context: FormatContext & FormatOptions) => string

  /**
   * Reduces a value to something orderable and comparable — a number for money
   * and dates, a lower-cased string for text.
   *
   * One function shared by sorting and filtering, so a date column that sorts
   * chronologically also filters chronologically, and neither has to know how
   * the other parses a value.
   */
  normalise?: (value: unknown, context: FormatContext & FormatOptions) => Comparable

  /** Full control of ordering, when normalising to one value is not enough. */
  compare?: (a: unknown, b: unknown, context: FormatContext & FormatOptions) => number
}

const TEXTUAL: readonly FilterOperator[] = [
  "contains",
  "notContains",
  "eq",
  "ne",
  "startsWith",
  "endsWith",
  "empty",
  "notEmpty",
]

const ORDERED: readonly FilterOperator[] = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "empty",
  "notEmpty",
]

const CHOICE: readonly FilterOperator[] = ["eq", "ne", "in", "notIn", "empty", "notEmpty"]

const LIST: readonly FilterOperator[] = ["in", "notIn", "contains", "empty", "notEmpty"]

const PRESENCE: readonly FilterOperator[] = ["empty", "notEmpty"]

/** Lower-cased text, so `eq` and sorting are case-insensitive like a person expects. */
function asText(value: unknown, context: FormatContext & FormatOptions): Comparable {
  if (isEmpty(value)) return null
  return toText(value, context).toLowerCase()
}

function asNumber(value: unknown): Comparable {
  if (isEmpty(value)) return null
  return toNumber(value) ?? null
}

function asTime(value: unknown): Comparable {
  if (isEmpty(value)) return null
  const date = toDate(value)
  return date ? date.getTime() : null
}

/** Minutes since midnight, so `"9:30"` and `"14:05"` order correctly as strings never would. */
function asClock(value: unknown): Comparable {
  if (isEmpty(value)) return null
  if (typeof value === "string") {
    const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
    if (match) return Number(match[1]) * 60 + Number(match[2])
  }
  const date = toDate(value)
  return date ? date.getUTCHours() * 60 + date.getUTCMinutes() : null
}

/**
 * The built-in types.
 *
 * Deliberately the ones a real application has, and deliberately not more. Each
 * one earns its place by being something people would otherwise write by hand
 * in every project.
 */
export const BUILT_IN_TYPES: Record<string, TypeDef> = {
  text: {
    name: "text",
    filter: "text",
    operators: TEXTUAL,
    icon: "text",
    normalise: asText,
  },

  longText: {
    name: "longText",
    filter: "text",
    operators: TEXTUAL,
    icon: "longText",
    normalise: asText,
  },

  number: {
    name: "number",
    align: "end",
    filter: "range",
    operators: ORDERED,
    icon: "number",
    format: formatNumber,
    normalise: asNumber,
  },

  currency: {
    name: "currency",
    align: "end",
    filter: "range",
    operators: ORDERED,
    icon: "currency",
    format: formatCurrency,
    normalise: asNumber,
  },

  percent: {
    name: "percent",
    align: "end",
    filter: "range",
    operators: ORDERED,
    icon: "percent",
    format: formatPercent,
    normalise: asNumber,
  },

  boolean: {
    name: "boolean",
    align: "center",
    filter: "boolean",
    operators: ["eq", "empty", "notEmpty"],
    icon: "boolean",
    searchable: false,
    format: (value) => (isEmpty(value) ? "" : value ? "Yes" : "No"),
    normalise: (value) => (isEmpty(value) ? null : Boolean(value)),
  },

  date: {
    name: "date",
    filter: "date",
    operators: ORDERED,
    icon: "date",
    format: formatDate,
    normalise: asTime,
  },

  datetime: {
    name: "datetime",
    filter: "date",
    operators: ORDERED,
    icon: "datetime",
    format: formatDateTime,
    normalise: asTime,
  },

  time: {
    name: "time",
    filter: "range",
    operators: ORDERED,
    icon: "time",
    format: formatTime,
    normalise: asClock,
  },

  relativeTime: {
    name: "relativeTime",
    filter: "date",
    operators: ORDERED,
    icon: "relativeTime",
    format: formatRelativeTime,
    normalise: asTime,
  },

  select: {
    name: "select",
    filter: "set",
    operators: CHOICE,
    icon: "select",
    format: (value, context) => optionLabel(value, context.options),
    // Sorted and filtered by the label, because that is the word on screen. A
    // list ordered by a hidden key looks arbitrary to the person reading it.
    normalise: (value, context) =>
      isEmpty(value) ? null : optionLabel(value, context.options).toLowerCase(),
  },

  badge: {
    name: "badge",
    filter: "set",
    operators: CHOICE,
    icon: "badge",
    format: (value, context) => optionLabel(value, context.options),
    normalise: (value, context) =>
      isEmpty(value) ? null : optionLabel(value, context.options).toLowerCase(),
  },

  tags: {
    name: "tags",
    filter: "set",
    operators: LIST,
    icon: "tags",
    format: (value, context) =>
      Array.isArray(value)
        ? value.map((entry) => optionLabel(entry, context.options)).join(", ")
        : optionLabel(value, context.options),
    // Ordered by how many tags there are, then alphabetically — the only
    // ordering of a set that means anything to a reader.
    normalise: (value, context) =>
      Array.isArray(value)
        ? value.map((entry) => optionLabel(entry, context.options).toLowerCase()).sort().join(" ")
        : asText(value, context),
  },

  email: { name: "email", filter: "text", operators: TEXTUAL, icon: "email", normalise: asText },
  url: { name: "url", filter: "text", operators: TEXTUAL, icon: "url", normalise: asText },
  phone: { name: "phone", filter: "text", operators: TEXTUAL, icon: "phone", normalise: asText },

  image: {
    name: "image",
    align: "center",
    filter: "none",
    operators: PRESENCE,
    icon: "image",
    searchable: false,
    sortable: false,
    format: () => "",
  },

  id: {
    name: "id",
    mono: true,
    filter: "text",
    operators: ["eq", "ne", "in", "contains", "empty", "notEmpty"],
    icon: "id",
    normalise: asText,
  },

  code: {
    name: "code",
    mono: true,
    filter: "text",
    operators: TEXTUAL,
    icon: "code",
    normalise: asText,
  },

  address: {
    name: "address",
    filter: "text",
    operators: TEXTUAL,
    icon: "address",
    format: (value, context) => formatAddress(value, context),
    normalise: (value, context) => formatAddress(value, context).toLowerCase() || null,
  },

  file: {
    name: "file",
    filter: "none",
    operators: PRESENCE,
    icon: "file",
    sortable: false,
    format: (value) => fileName(value),
    normalise: (value) => fileName(value).toLowerCase() || null,
  },

  json: {
    name: "json",
    mono: true,
    filter: "none",
    operators: PRESENCE,
    icon: "json",
    sortable: false,
    searchable: false,
    // Never dumped into a cell. A raw object blows a table row apart, and the
    // one thing a reader wants to know is whether there is anything in there.
    format: (value) => (isEmpty(value) ? "" : "{…}"),
  },
}

/**
 * A postal address, joined in the order an envelope is written.
 *
 * Accepts the loose shapes addresses actually arrive in, because there is no
 * standard one and demanding a particular one would be exactly the mapping
 * layer this library exists to avoid.
 */
function formatAddress(value: unknown, context: FormatContext & FormatOptions): string {
  if (typeof value === "string") return value
  if (typeof value !== "object" || value === null) return ""

  const address = value as Record<string, unknown>
  const parts = ["line1", "line2", "street", "suburb", "city", "region", "state", "postcode", "postalCode", "zip", "country"]
    .map((key) => address[key])
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")

  return parts.length > 0 ? parts.join(", ") : toText(value, context)
}

function fileName(value: unknown): string {
  if (typeof value === "string") return value.split("/").pop() ?? value
  if (typeof value === "object" && value !== null) {
    const file = value as { name?: unknown; filename?: unknown; url?: unknown }
    for (const candidate of [file.name, file.filename, file.url]) {
      if (typeof candidate === "string") return candidate.split("/").pop() ?? candidate
    }
  }
  return ""
}

/**
 * Names accepted for the built-in types beyond their own.
 *
 * Configuration that comes straight out of a database is usually snake_case,
 * and an ORM's column types are their own vocabulary again. Accepting both
 * removes a mapping step that would otherwise exist purely to satisfy a naming
 * preference — which is precisely the friction this library exists to remove.
 */
export const TYPE_ALIASES: Record<string, string> = {
  string: "text",
  varchar: "text",
  char: "text",
  uuid: "id",
  long_text: "longText",
  longtext: "longText",
  textarea: "longText",
  int: "number",
  int2: "number",
  int4: "number",
  int8: "number",
  integer: "number",
  bigint: "number",
  float: "number",
  float4: "number",
  float8: "number",
  double: "number",
  decimal: "number",
  numeric: "number",
  money: "currency",
  bool: "boolean",
  checkbox: "boolean",
  timestamp: "datetime",
  timestamptz: "datetime",
  "date-time": "datetime",
  date_time: "datetime",
  relative: "relativeTime",
  relative_time: "relativeTime",
  since: "relativeTime",
  enum: "select",
  option: "select",
  status: "badge",
  chip: "badge",
  pill: "badge",
  multi_select: "tags",
  multiSelect: "tags",
  multiselect: "tags",
  array: "tags",
  list: "tags",
  mail: "email",
  link: "url",
  href: "url",
  website: "url",
  tel: "phone",
  mobile: "phone",
  avatar: "image",
  picture: "image",
  photo: "image",
  jsonb: "json",
  object: "json",
  attachment: "file",
  upload: "file",
}

/** A registry of types, ready to be consulted by a table. */
export type TypeRegistry = {
  /** The type for a name, resolving aliases, falling back to `text`. */
  get(name: string | undefined): TypeDef
  /** Whether a name resolves to a real type rather than the fallback. */
  has(name: string | undefined): boolean
  /** Every registered type, for a settings UI that offers them. */
  all(): TypeDef[]
}

/**
 * Builds a registry from the built-ins plus any custom types.
 *
 * A custom type with a built-in's name replaces it, which is how a caller
 * changes what every date column in their product looks like in one place.
 */
export function createTypeRegistry(custom?: Record<string, TypeDef>): TypeRegistry {
  const types = new Map<string, TypeDef>()
  for (const [name, type] of Object.entries(BUILT_IN_TYPES)) types.set(name, type)
  if (custom) for (const [name, type] of Object.entries(custom)) types.set(name, { ...type, name })

  const fallback = types.get("text") ?? BUILT_IN_TYPES.text!

  const resolve = (name: string | undefined): TypeDef | undefined => {
    if (!name) return undefined
    return types.get(name) ?? types.get(TYPE_ALIASES[name] ?? "") ?? types.get(name.toLowerCase())
  }

  return {
    get: (name) => resolve(name) ?? fallback,
    has: (name) => resolve(name) !== undefined,
    all: () => [...types.values()],
  }
}

/** The registry used by any table that does not supply its own. */
export const defaultTypeRegistry: TypeRegistry = createTypeRegistry()

/**
 * Declares a custom type.
 *
 * Nothing but an identity function with a type annotation — its whole job is to
 * give the object literal a contextual type so an editor autocompletes the
 * properties and catches a typo at the definition rather than at the call site.
 *
 * ```ts
 * const rating = defineType({
 *   name: "rating",
 *   align: "end",
 *   format: (value) => "★".repeat(Number(value) || 0),
 *   normalise: (value) => Number(value) || 0,
 * })
 * ```
 */
export function defineType(type: TypeDef): TypeDef {
  return type
}

/** Formats a value with a type, applying the type's own rules and then the caller's. */
export function formatWithType(
  type: TypeDef,
  value: unknown,
  context: FormatContext & FormatOptions,
): string {
  if (isEmpty(value)) return ""
  return type.format ? type.format(value, context) : toText(value, context)
}

/** Orders two values by a type's rules, ascending, with empties last. */
export function compareWithType(
  type: TypeDef,
  a: unknown,
  b: unknown,
  context: FormatContext & FormatOptions = DEFAULT_FORMAT,
): number {
  if (type.compare) return type.compare(a, b, context)
  if (!type.normalise) return compareUnknown(a, b)
  return compareUnknown(type.normalise(a, context), type.normalise(b, context))
}
