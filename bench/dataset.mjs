/* Generated from packages/core/src/testing/dataset.ts — do not edit. */
import { defineType } from "../packages/core/dist/index.js";
const PLANS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Professional" },
  { value: "team", label: "Team" },
  { value: "enterprise", label: "Enterprise" }
];
const STATUSES = [
  { value: "active", label: "Active", colour: "#3f6b4a" },
  { value: "paused", label: "Paused", colour: "#9a6b1f" },
  { value: "closed", label: "Closed", colour: "#97362b" }
];
const TAG_POOL = ["urgent", "new", "renewal", "referred", "vip"];
const NAMES = [
  "Ada Lovelace",
  "Tom Kerrigan",
  "Zo\xEB Marchetti",
  "bea whitlock",
  "Idris Nasser",
  "JUNE OKAFOR",
  "Marcus Bell",
  "Priya Raman",
  "Sven Halvorsen",
  "Wren Ashby",
  "\xC9mile Rousseau",
  "\xD3lafur J\xF3nsson",
  "\u9673\u5927\u6587",
  "Ann-Marie O'Neill",
  "Jos\xE9 Garc\xEDa",
  "\u0418\u0432\u0430\u043D \u041F\u0435\u0442\u0440\u043E\u0432",
  "\u{1F389} Party Planner",
  "  Padded Name  ",
  "",
  "Ada Lovelace"
];
const PRIORITIES = ["blocker", "high", "normal", "low", "someday"];
const PRIORITY_ORDER = new Map(PRIORITIES.map((value, index) => [value, index]));
function pseudoRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
function makeRows(count, seed = 1) {
  const random = pseudoRandom(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const maybe = (probability = 0.12) => random() < probability;
  const startOfYear = Date.UTC(2026, 0, 1);
  return Array.from({ length: count }, (_, index) => {
    const name = pick(NAMES);
    const seen = new Date(startOfYear + Math.floor(random() * 300) * 864e5 + Math.floor(random() * 864e5));
    const seenAt = maybe(0.08) ? null : index % 4 === 0 ? seen.toISOString() : index % 4 === 1 ? seen : index % 4 === 2 ? seen.getTime() : Math.floor(seen.getTime() / 1e3);
    return {
      id: `row_${String(index).padStart(5, "0")}`,
      name,
      bio: maybe() ? null : maybe(0.2) ? "" : "A biography long enough to be prose. ".repeat(1 + Math.floor(random() * 6)),
      count: maybe() ? null : Math.floor(random() * 1e3) - 200,
      amountCents: Math.floor(random() * 5e5) - 5e3,
      ratio: Math.round(random() * 1e4) / 100,
      active: maybe() ? null : random() > 0.5,
      birthday: maybe() ? null : new Date(Date.UTC(1970 + Math.floor(random() * 50), Math.floor(random() * 12), 1 + Math.floor(random() * 28))).toISOString().slice(0, 10),
      seenAt,
      startsAt: maybe() ? null : `${String(Math.floor(random() * 24)).padStart(2, "0")}:${String(Math.floor(random() * 60)).padStart(2, "0")}`,
      updatedAt: new Date(startOfYear + Math.floor(random() * 300) * 864e5).toISOString(),
      plan: pick(PLANS).value,
      status: pick(STATUSES).value,
      tags: maybe(0.18) ? [] : TAG_POOL.filter(() => random() > 0.7),
      email: maybe() ? null : `${name.split(" ")[0]?.toLowerCase().replace(/[^a-z]/g, "") || "x"}${index}@example.com`,
      website: maybe() ? null : `https://example.com/${index}`,
      phone: maybe() ? null : `+61 4${String(Math.floor(random() * 1e8)).padStart(8, "0")}`,
      avatar: `https://example.com/avatar/${index}.png`,
      reference: `REF-${String(2026e3 + index)}`,
      snippet: `const value = ${index}`,
      home: maybe() ? null : { line1: `${1 + Math.floor(random() * 200)} Test Street`, city: pick(["Sydney", "Melbourne", "Perth"]), postcode: String(2e3 + Math.floor(random() * 800)) },
      attachment: maybe() ? null : { name: `document-${index}.pdf`, size: Math.floor(random() * 5e6) },
      payload: maybe(0.5) ? null : { nested: { index }, flag: random() > 0.5 },
      version: `${Math.floor(random() * 12)}.${Math.floor(random() * 20)}.${Math.floor(random() * 100)}`,
      priority: pick(PRIORITIES),
      seat: `${pick(["A", "B", "C"])}${1 + Math.floor(random() * 30)}`
    };
  });
}
const semver = defineType({
  name: "semver",
  mono: true,
  filter: "text",
  operators: ["eq", "ne", "gt", "gte", "lt", "lte", "between", "contains", "empty", "notEmpty"],
  icon: "code",
  // Packed into one number so the whole ordering — and every comparison a
  // filter makes — falls out of a single value.
  normalise: (value) => typeof value === "string" ? versionRank(value) : null,
  format: (value) => String(value)
});
function versionRank(version) {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number(part) || 0);
  return major * 1e6 + minor * 1e3 + patch;
}
const priority = defineType({
  name: "priority",
  filter: "set",
  operators: ["eq", "ne", "in", "notIn", "lt", "lte", "gt", "gte", "empty", "notEmpty"],
  icon: "select",
  normalise: (value) => typeof value === "string" ? PRIORITY_ORDER.get(value) ?? null : null,
  format: (value) => typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : ""
});
const customTypes = { semver, priority };
function compareSeats(a, b) {
  const parse = (value) => {
    const match = /^([A-Z]+)(\d+)$/.exec(String(value ?? ""));
    return match ? { row: match[1], number: Number(match[2]) } : { row: "", number: 0 };
  };
  const left = parse(a);
  const right = parse(b);
  return left.row.localeCompare(right.row) || left.number - right.number;
}
const columns = [
  { key: "id", type: "id" },
  { key: "name", type: "text" },
  { key: "bio", type: "longText" },
  { key: "count", type: "number" },
  { key: "amountCents", type: "currency", formatOptions: { currencyInMinorUnits: true } },
  { key: "ratio", type: "percent" },
  { key: "active", type: "boolean" },
  { key: "birthday", type: "date" },
  { key: "seenAt", type: "datetime" },
  { key: "startsAt", type: "time" },
  { key: "updatedAt", type: "relativeTime" },
  { key: "plan", type: "select", formatOptions: { options: PLANS } },
  { key: "status", type: "badge", formatOptions: { options: STATUSES } },
  { key: "tags", type: "tags" },
  { key: "email", type: "email" },
  { key: "website", type: "url" },
  { key: "phone", type: "phone" },
  { key: "avatar", type: "image" },
  { key: "reference", type: "text" },
  { key: "snippet", type: "code" },
  { key: "home", type: "address" },
  { key: "attachment", type: "file" },
  { key: "payload", type: "json" },
  { key: "version", type: "semver" },
  { key: "priority", type: "priority" },
  { key: "seat", compare: compareSeats }
];
export {
  PLANS,
  PRIORITY_ORDER,
  STATUSES,
  TAG_POOL,
  columns,
  compareSeats,
  customTypes,
  makeRows,
  priority,
  pseudoRandom,
  semver,
  versionRank
};
