import { MenuSection } from "@/components/menu/MenuSection"
import { MenuItemCard } from "@/components/menu/MenuItemCard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type MenuItem = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
}

type MenuSectionType = {
  id: string
  name: string
  items: MenuItem[]
}

async function getMenu() {
  const [menuRow, flagsRow] = await Promise.all([
    prisma.history.findUnique({
      where: { id: "menu:current" },
    }),
    prisma.history.findUnique({
      where: { id: "system:flags" },
    }),
  ])

  const menu = Array.isArray((menuRow?.data as any)?.menu)
    ? (menuRow?.data as any).menu
    : []
  const locked = (flagsRow?.data as any)?.serviceActive === true

  return { menu, locked }
}

export default async function PublicMenuPage() {
  const { menu, locked } = await getMenu()

  return (
    <div className="px-4 py-6 space-y-8">
      {locked && (
        <div className="text-sm opacity-70">
          Menu is currently locked during service.
        </div>
      )}

      {menu.map((section: MenuSectionType) => (
        <MenuSection key={section.id} title={section.name}>
          {section.items.map(item => (
            <MenuItemCard
              key={item.id}
              name={item.name}
              description={item.description}
              image={item.image}
              price={item.basePrice}
              vatRate={item.vatRate}
              allergens={item.allergens}
              readOnly
            />
          ))}
        </MenuSection>
      ))}

      {menu.length === 0 && (
        <div className="opacity-60 text-center">
          Menu unavailable
        </div>
      )}
    </div>
  )
}
