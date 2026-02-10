import { getEvents } from "./store"

export function deriveTables() {
  const tables: Record<string, { items: any[] }> = {}

  for (const e of getEvents()) {
    if (e.type === "ORDER_ADDED") {
      const { table, items } = e.payload
      if (!tables[table]) tables[table] = { items: [] }
      tables[table].items.push(...items)
    }
  }

  return tables
}
