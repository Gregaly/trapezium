/**
 * Sample data, shaped the way an API actually returns it.
 *
 * Deliberately awkward in the ways real payloads are: snake_case keys next to
 * camelCase ones, a nested object, money as a plain number, dates as ISO
 * strings, a nullable field, and an array. If the table only looks good against
 * data invented to flatter it, the demo is a lie.
 */

export type Invoice = {
  id: string
  reference: string
  customer: { name: string; email: string }
  amount: number
  status: string
  tags: string[]
  issued_at: string
  due_date: string
  paid: boolean
  owner: string
  notes: string | null
  avatar_url: string
}

const NAMES = [
  "Ada Lovelace", "Tom Kerrigan", "Zoë Marchetti", "Bea Whitlock", "Idris Nasser",
  "June Okafor", "Marcus Bell", "Priya Raman", "Sven Halvorsen", "Wren Ashby",
  "Clara Boyd", "Hugo Fontaine", "Nadia Petrov", "Omar Haddad", "Ruth Kelleher",
  "Silas Moreau", "Tessa Lindqvist", "Ugo Barbieri", "Vera Kaminski", "Yusuf Demir",
]

const STATUSES = ["paid", "sent", "overdue", "draft"]
const OWNERS = ["Ada", "Marcus", "Priya", "Wren"]
const TAG_POOL = ["retainer", "urgent", "new", "renewal", "referred"]

/** Deterministic, so the demo looks the same every time it is opened. */
function pseudoRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return value / 4_294_967_296
  }
}

export function makeInvoices(count = 240): Invoice[] {
  const random = pseudoRandom(42)
  const start = Date.UTC(2026, 0, 1)

  return Array.from({ length: count }, (_, index) => {
    const name = NAMES[Math.floor(random() * NAMES.length)] ?? "Ada Lovelace"
    const issued = new Date(start + Math.floor(random() * 220) * 86_400_000)
    const due = new Date(issued.getTime() + 14 * 86_400_000)
    const status = STATUSES[Math.floor(random() * STATUSES.length)] ?? "draft"

    return {
      id: `inv_${String(index + 1).padStart(4, "0")}`,
      reference: `INV-${String(2026000 + index)}`,
      customer: { name, email: `${name.split(" ")[0]?.toLowerCase() ?? "x"}@example.com` },
      amount: Math.round((random() * 4800 + 120) * 100) / 100,
      status,
      tags: TAG_POOL.filter(() => random() > 0.75),
      issued_at: issued.toISOString(),
      due_date: due.toISOString().slice(0, 10),
      paid: status === "paid",
      owner: OWNERS[Math.floor(random() * OWNERS.length)] ?? "Ada",
      notes: random() > 0.6 ? "Client asked to be invoiced at the end of the quarter." : null,
      avatar_url: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}`,
    }
  })
}

export const STATUS_OPTIONS = [
  { value: "paid", label: "Paid", colour: "#3f6b4a" },
  { value: "sent", label: "Sent", colour: "#6a2e46" },
  { value: "overdue", label: "Overdue", colour: "#97362b" },
  { value: "draft", label: "Draft", colour: "#9a8f80" },
]
