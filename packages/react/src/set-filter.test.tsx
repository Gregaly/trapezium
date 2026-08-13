import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { Table } from "./table.js"

/**
 * Set filters and pagination.
 *
 * The failure this file exists to prevent: a set filter that only offers the
 * values on the page you happen to be looking at. It is a natural mistake to
 * make — the rows the table renders are one page — and it makes the filter
 * useless, because the value you are looking for is almost never on page one.
 */

afterEach(cleanup)

/** Three hundred rows, and one owner who appears only near the very end. */
const rows = Array.from({ length: 300 }, (_, index) => ({
  id: String(index),
  name: `Person ${String(index)}`,
  owner: index === 287 ? "Wren" : index % 3 === 0 ? "Ada" : index % 3 === 1 ? "Tom" : "Zoe",
}))

function setup(props: Record<string, unknown> = {}) {
  return render(
    <Table
      data={rows}
      columns={[{ key: "name" }, { key: "owner", filter: "set" }]}
      getRowId={(row) => row.id}
      pagination={{ pageSize: 10 }}
      aria-label="People"
      {...props}
    />,
  )
}

async function openOwnerFilter(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  await user.click(within(container).getByRole("button", { name: /Owner column options/i }))
  return screen.getByRole("group", { name: /Owner column/i })
}

function shownOwners(container: HTMLElement): string[] {
  return [...container.querySelectorAll("tbody tr")].map(
    (row) => row.querySelectorAll("td")[1]?.textContent?.trim() ?? "",
  )
}

describe("choices come from the whole dataset, not the page", () => {
  it("offers a value that appears only on a much later page", async () => {
    const user = userEvent.setup()
    const { container } = setup()

    // Page one holds Ada, Tom and Zoe; Wren is row 288 of 300.
    expect(shownOwners(container)).not.toContain("Wren")

    const panel = await openOwnerFilter(user, container)
    expect(within(panel).getByText("Wren")).toBeDefined()
    expect(within(panel).getAllByRole("checkbox")).toHaveLength(4)
  })

  it("shows those rows the moment the value is chosen", async () => {
    const user = userEvent.setup()
    const { container } = setup()

    const panel = await openOwnerFilter(user, container)
    await user.click(within(panel).getByText("Wren"))

    // The one matching row, from page twenty-nine, on page one.
    expect(shownOwners(container)).toEqual(["Wren"])
    expect(within(container).getByText(/1 row/)).toBeDefined()
  })

  it("offers the same choices whatever page the user is on", async () => {
    const user = userEvent.setup()
    const { container } = setup()

    const labels = async () => {
      const panel = await openOwnerFilter(user, container)
      const found = within(panel)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent?.trim() ?? "")
      await user.keyboard("{Escape}")
      return found.sort()
    }

    const fromPageOne = await labels()

    await user.click(within(container).getByRole("button", { name: "Next page" }))
    await user.click(within(container).getByRole("button", { name: "Next page" }))

    expect(await labels()).toEqual(fromPageOne)
  })

  it("keeps offering every value even after a filter has narrowed the table", async () => {
    const user = userEvent.setup()
    const { container } = setup()

    const panel = await openOwnerFilter(user, container)
    await user.click(within(panel).getByText("Ada"))

    // Having chosen Ada, the other three must still be there to choose — a
    // filter that eats its own options cannot be widened again.
    expect(within(panel).getAllByRole("checkbox")).toHaveLength(4)
    expect(within(panel).getByText("Wren")).toBeDefined()
  })
})

describe("columns with a great many distinct values", () => {
  /** Two hundred and fifty owners, one of them very rare indeed. */
  const many = Array.from({ length: 2_000 }, (_, index) => ({
    id: String(index),
    name: `Person ${String(index)}`,
    owner: index === 1_999 ? "Solitary" : `Owner ${String(index % 250)}`,
  }))

  it("finds a value beyond the ones it lists, when the user types", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Table
        data={many}
        columns={[{ key: "name" }, { key: "owner", filter: "set" }]}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 10 }}
        aria-label="People"
      />,
    )

    const panel = await openOwnerFilter(user, container)

    // "Solitary" appears once in two thousand rows, so it is the least common
    // value there is — and it must still be reachable.
    await user.type(within(panel).getByRole("searchbox"), "solitary")
    expect(within(panel).getByText("Solitary")).toBeDefined()

    await user.click(within(panel).getByText("Solitary"))
    expect(shownOwners(container)).toEqual(["Solitary"])
  })
})
