const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Create Marlo's Brasserie if it doesn't exist
  let restaurant = await prisma.restaurant.findUnique({
    where: { slug: 'marlos-brasserie' }
  })

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        id: 'marlos-1',
        slug: 'marlos-brasserie',
        name: "Marlo's Brasserie",
        domain: 'nfc-menu.vercel.app',
        vatRate: 0.20,
        serviceCharge: 0
      }
    })
    console.log(`Created restaurant: ${restaurant.name}`)
  } else {
    // Update existing restaurant with domain
    restaurant = await prisma.restaurant.update({
      where: { slug: 'marlos-brasserie' },
      data: { domain: 'nfc-menu.vercel.app' }
    })
    console.log(`Updated restaurant: ${restaurant.name}`)
  }

  // Show all restaurants
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, slug: true, name: true, domain: true }
  })

  console.log('\nCurrent restaurants:')
  restaurants.forEach(r => {
    console.log(`  ${r.slug}: "${r.name}" → domain="${r.domain || 'none'}"`)
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
