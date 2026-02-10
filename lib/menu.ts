export type MenuItem = {
  id: string
  name: string
  description: string
  image?: string
  basePrice: number
  vatRate: number
  allergens: string[]
  editableOptions?: any
  station: "kitchen" | "bar"
}

export type MenuSection = {
  id: string
  title: string
  items: MenuItem[]
}

let locked = false

export function lockMenu() {
  locked = true
}

export function unlockMenu() {
  locked = false
}

export function isMenuLocked() {
  return locked
}