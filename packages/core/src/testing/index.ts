/**
 * @trapezium/core/testing
 *
 * A dataset carrying every built-in type, two custom types declared through the
 * public API, and every awkward value that turns up in real data — nulls,
 * blanks, zeroes, accents, emoji, numbers stored as text, dates in four shapes.
 *
 * Published because it is genuinely useful outside this repository: an adapter
 * proving it renders every type, or an application checking its own columns
 * against something deliberately nasty, should not have to invent the data
 * first. Deterministic, so a failure is reproducible from its seed.
 */

export {
  columns,
  compareSeats,
  customTypes,
  makeRows,
  priority,
  PRIORITY_ORDER,
  pseudoRandom,
  PLANS,
  semver,
  STATUSES,
  TAG_POOL,
  versionRank,
  type Row,
} from "./dataset.js"
