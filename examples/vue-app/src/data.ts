export type Person = {
  id: string
  name: string
  email: string
  team: string
  salary: number
  started: string
  remote: boolean
}

const TEAMS = ["Design", "Engineering", "Support", "Sales"]
const NAMES = [
  "Ada Lovelace", "Tom Kerrigan", "Zoe Marchetti", "Bea Whitlock", "Idris Nasser",
  "June Okafor", "Marcus Bell", "Priya Raman", "Sven Halvorsen", "Wren Ashby",
  "Clara Boyd", "Hugo Fontaine", "Nadia Petrov", "Omar Haddad", "Ruth Kelleher",
  "Silas Moreau", "Tessa Lindqvist", "Ugo Barbieri", "Vera Kaminski", "Yusuf Demir",
]

/** Deterministic, so the example looks the same every time it is opened. */
function pseudoRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return value / 4_294_967_296
  }
}

export function makePeople(count = 120): Person[] {
  const random = pseudoRandom(3)

  return Array.from({ length: count }, (_, index) => {
    const name = NAMES[Math.floor(random() * NAMES.length)] ?? "Ada Lovelace"
    return {
      id: `p_${String(index + 1).padStart(3, "0")}`,
      name,
      email: `${name.split(" ")[0]?.toLowerCase() ?? "x"}${index}@example.com`,
      team: TEAMS[Math.floor(random() * TEAMS.length)] ?? "Design",
      salary: Math.round(38_000 + random() * 62_000),
      started: new Date(
        Date.UTC(2019 + Math.floor(random() * 7), Math.floor(random() * 12), 1 + Math.floor(random() * 27)),
      )
        .toISOString()
        .slice(0, 10),
      remote: random() > 0.5,
    }
  })
}
