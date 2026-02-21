function normalizeDescriptionKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['".]/g, "")
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const premiumDescriptionEntries: ReadonlyArray<readonly [string, string]> = [
  [
    "Toasted sourdough with jam & butter",
    "Toasted artisan sourdough finished with cultured butter and small-batch preserve for a polished light start.",
  ],
  [
    "Toasted sourdough with fried eggs, bacon and brown sauce",
    "Golden sourdough layered with fried eggs and crisp bacon, balanced by a classic brown-sauce finish.",
  ],
  [
    "Homemade sourdough bread, smashed avocado, poached/scrambled egg",
    "House sourdough crowned with smashed avocado and your preferred egg style for a refined all-day brunch plate.",
  ],
  [
    "Shakshuka with tomatoes, pepper, cumin, onion & garlic, egg and feta",
    "A slow-simmered shakshuka of tomatoes, peppers and warm spice, finished with egg and creamy feta.",
  ],
  [
    "Pancakes with mixed berries and banana",
    "Fluffy stack of pancakes served with ripe banana and mixed berries for a naturally elegant sweetness.",
  ],
  [
    "Granola with mixed nuts, fresh berries, chia seeds and greek yogurt",
    "Toasted granola with mixed nuts, chia and fresh berries over Greek yogurt for a clean, premium breakfast profile.",
  ],
  [
    "French toast with mixed berries and chocolate sauce",
    "Brioche-style French toast with berry compote and warm chocolate for a decadent cafe classic.",
  ],
  [
    "Omelette with any 3 fillings",
    "Free-range omelette built to order with your choice of three fillings, served with a contemporary brunch finish.",
  ],
  [
    "Eggs Florentine",
    "Poached eggs and wilted greens layered with velvety hollandaise for a timeless Florentine brunch.",
  ],
  [
    "Charred grilled steak and eggs",
    "Chargrilled steak paired with eggs cooked to order for a bold, high-protein signature plate.",
  ],
  [
    "Australian wagyu rib-eye steak 200g",
    "Premium Australian Wagyu rib-eye, expertly grilled for rich marbling and a luxurious finish.",
  ],
  [
    "Black Angus sirloin steak 250-280g",
    "Black Angus sirloin, flame-grilled for depth and tenderness with a clean, steakhouse-style presentation.",
  ],
  [
    "Lamb chops on the bone (4pcs)",
    "Four bone-in lamb chops, charred and rested for deep savoury flavour and a refined mains experience.",
  ],
  [
    "Soup of the day served with bread",
    "Daily chef-made soup served with warm bread, crafted for comfort with elevated cafe quality.",
  ],
  [
    "Tagliatelle with oyster mushrooms and black truffle",
    "Silken tagliatelle with oyster mushrooms and black truffle for an aromatic, restaurant-style pasta.",
  ],
  [
    "Traditional spaghetti carbonara",
    "Traditional spaghetti carbonara with a silky, peppered finish and classic Roman character.",
  ],
  [
    "Traditional rigatoni beef bolognese",
    "Rigatoni folded through slow-cooked beef ragu, delivering rich depth and generous texture.",
  ],
  [
    "Penne arrabbiata",
    "Al dente penne in a bright, spicy tomato arrabbiata sauce with a clean heat profile.",
  ],
  [
    "Steak beef burger with homemade sauce and chips",
    "A premium steak burger served with house sauce and crisp chips for an elevated comfort classic.",
  ],
  [
    "Panko breaded chicken escalope with parmesan fries",
    "Panko-crusted chicken escalope paired with parmesan-dusted fries for a crisp, indulgent finish.",
  ],
  [
    "Caesar salad",
    "Crisp Caesar salad with savoury depth and a balanced dressing-led finish.",
  ],
  [
    "Steak baguette with caramelised onions and rocket",
    "Grilled steak in a warm baguette with caramelised onions and rocket for a refined lunchtime bite.",
  ],
  [
    "Breaded fish fillets with potato wedges and tartar sauce",
    "Golden breaded fish fillets served with wedges and tartar for a polished modern bistro plate.",
  ],
  [
    "Chicken breast in creamy mushroom sauce",
    "Tender chicken breast in a velvety mushroom sauce for a rich yet balanced main.",
  ],
  [
    "Margherita D.O.P.",
    "A classic D.O.P. Margherita showcasing vibrant tomato, creamy mozzarella and fresh basil.",
  ],
  [
    "Mascarpone & Speck",
    "Mascarpone and speck layered over a hand-stretched base for a rich, delicately smoky finish.",
  ],
  [
    "Tartufo Nero",
    "Black truffle-led pizza with earthy depth and a luxurious, aromatic profile.",
  ],
  [
    "Parmigiana",
    "A balanced Parmigiana pizza with layered tomato, aubergine notes and elegant savoury character.",
  ],
  [
    "Mortadella e Pistacchio",
    "Mortadella and pistachio combination delivering creamy texture, nutty lift and Italian depth.",
  ],
  [
    "Ortolana",
    "A vibrant vegetable-forward pizza with seasonal character and a light artisan finish.",
  ],
  [
    "Pepperoni Classico",
    "Classic pepperoni pizza with crisp-edged spice and a rich tomato base.",
  ],
  [
    "Prosciutto Funghi",
    "Prosciutto and mushroom pairing over a hand-finished crust for savoury, rounded flavour.",
  ],
  [
    "Nettuno",
    "A coastal-inspired Nettuno pizza with layered Mediterranean character and balanced salinity.",
  ],
  [
    "Pollo Fusion",
    "A contemporary chicken pizza with house flavour accents and a modern artisan finish.",
  ],
  [
    "Chocolate fondant with vanilla ice cream",
    "Warm chocolate fondant with a molten centre, served with vanilla ice cream for a luxurious dessert finish.",
  ],
  [
    "Brownie with vanilla ice cream",
    "Rich chocolate brownie paired with vanilla ice cream for a refined sweet course.",
  ],
  [
    "Penne with rich tomato sauce",
    "Penne in a rich tomato sauce, crafted as a balanced and comforting choice for younger guests.",
  ],
  [
    "Kids Margherita",
    "Child-friendly Margherita pizza with classic tomato and mozzarella flavours.",
  ],
  [
    "Crispy chicken schnitzel with chips",
    "Crisp chicken schnitzel served with golden chips for a premium kids-menu favourite.",
  ],
  [
    "Beef cheeseburger served with chips",
    "A tender beef cheeseburger with chips, prepared fresh for a satisfying children's classic.",
  ],
  [
    "Espresso",
    "A concentrated espresso shot with rich crema and a clean, lingering finish.",
  ],
  [
    "Macchiato",
    "Espresso marked with milk foam for a short, elegant cup with refined intensity.",
  ],
  [
    "Americano",
    "Slow-poured Americano with smooth body and clear coffee character.",
  ],
  [
    "Cortado",
    "A balanced cortado blending espresso and steamed milk for velvety texture and precision.",
  ],
  [
    "Latte (Hot/Iced)",
    "Silky latte, available hot or iced, built with espresso and a polished milk finish.",
  ],
  [
    "Matcha latte (Hot/Iced)",
    "Ceremonial-style matcha latte served hot or iced for a smooth, vibrant tea profile.",
  ],
  [
    "Chai latte (Hot/Iced)",
    "Spiced chai latte served hot or iced with a creamy, aromatic finish.",
  ],
  [
    "Cappuccino",
    "Classic cappuccino with textured foam and a balanced espresso core.",
  ],
  [
    "Flat white",
    "Micro-foamed flat white with bold espresso character and a smooth modern finish.",
  ],
  [
    "Mocha",
    "A refined mocha marrying espresso and chocolate with velvety milk texture.",
  ],
  [
    "Hot chocolate",
    "Rich hot chocolate with deep cocoa notes and a comforting premium finish.",
  ],
  [
    "Syrup (vanilla/caramel/hazelnut/coconut)",
    "A premium syrup shot in your chosen flavour to tailor sweetness and aroma with precision.",
  ],
  [
    "Alternative milk (oat/almond/soya/coconut)",
    "Choose from oat, almond, soya or coconut milk to personalise your cup with a luxury cafe touch.",
  ],
  [
    "Whipping cream / marshmallow",
    "A finishing garnish of whipped cream or marshmallow for a richer, dessert-style top note.",
  ],
  [
    "Collagen",
    "Unflavoured collagen boost blended seamlessly into your drink for a wellness-forward upgrade.",
  ],
  [
    "English breakfast gold / decaf / earl grey",
    "A premium black tea selection featuring English Breakfast Gold, Decaf or Earl Grey.",
  ],
  [
    "Chamomile organic",
    "Organic chamomile infusion with gentle floral notes and a calming finish.",
  ],
  [
    "Fog green organic",
    "Organic green tea with a clean profile and delicate grassy lift.",
  ],
  [
    "Jasmine Chung Hao",
    "Fragrant Jasmine Chung Hao tea with soft floral perfume and elegant clarity.",
  ],
  [
    "Lemon & ginger rooibos",
    "Caffeine-free rooibos layered with lemon and ginger for a bright, soothing cup.",
  ],
  [
    "Fresh mint tea",
    "Fresh mint leaves steeped to order for a crisp, aromatic herbal infusion.",
  ],
  [
    "Super Green",
    "A nutrient-forward green smoothie with a clean profile and vibrant finish.",
  ],
  [
    "Berry Burst",
    "A berry-led smoothie with bright fruit intensity and silky texture.",
  ],
  [
    "Detox",
    "A fresh detox smoothie designed for a light, revitalising refreshment.",
  ],
  [
    "Sunrise Smoothie",
    "A bright, tropical-style smoothie with smooth body and a lively morning lift.",
  ],
  [
    "Sauvignon Blanc (175ml)",
    "Crisp and aromatic Sauvignon Blanc served by the glass with citrus lift and mineral precision.",
  ],
  [
    "Sauvignon Blanc (bottle)",
    "A full bottle of crisp, aromatic Sauvignon Blanc with citrus lift and mineral precision.",
  ],
  [
    "Gavi di Gavi (175ml)",
    "Elegant Gavi di Gavi by the glass, offering white stone-fruit notes and a refined dry finish.",
  ],
  [
    "Gavi di Gavi (bottle)",
    "A full bottle of elegant Gavi di Gavi with white stone-fruit notes and a refined dry finish.",
  ],
  [
    "Sangiovese Guerrieri Colli Pesaresi (175ml)",
    "Sangiovese served by the glass with soft red-fruit character and balanced structure.",
  ],
  [
    "Sangiovese Guerrieri Colli Pesaresi (bottle)",
    "A full bottle of Sangiovese with soft red-fruit character and balanced structure.",
  ],
  [
    "Malbec '1300' (175ml)",
    "Malbec by the glass with dark fruit depth, gentle spice and a polished finish.",
  ],
  [
    "Malbec '1300' (bottle)",
    "A full bottle of Malbec with dark fruit depth, gentle spice and a polished finish.",
  ],
  [
    "Rose Gold Cotes de Provence (175ml)",
    "Premium Provence rose by the glass with delicate berry notes and a crisp, dry close.",
  ],
  [
    "Rose Gold Cotes de Provence (bottle)",
    "A full bottle of premium Provence rose with delicate berry notes and a crisp, dry close.",
  ],
  [
    "Prosecco Brut Rose DOC Luna Argenta (125ml)",
    "Brut Rose Prosecco by the glass with fine bubbles, fresh red-fruit tones and elegant lift.",
  ],
  [
    "Prosecco Brut Rose DOC Luna Argenta (bottle)",
    "A full bottle of Brut Rose Prosecco with fine bubbles and fresh red-fruit tones.",
  ],
  [
    "Prosecco Brut DOC Luna Argenta (125ml)",
    "Brut Prosecco by the glass with lively mousse, orchard fruit notes and clean finish.",
  ],
  [
    "Prosecco Brut DOC Luna Argenta (bottle)",
    "A full bottle of Brut Prosecco with lively mousse, orchard fruit notes and clean finish.",
  ],
  [
    "Aperol Spritz",
    "Aperol Spritz built over ice with bright citrus bitterness and sparkling balance.",
  ],
  [
    "Campari Spritz",
    "Campari Spritz with bold bittersweet character and an aperitivo-style finish.",
  ],
  [
    "Bombay Sapphire Gin & Tonic",
    "Bombay Sapphire and premium tonic served long over ice with botanical clarity.",
  ],
  [
    "Moretti (330ml)",
    "Classic Italian lager with a clean malt profile, served chilled.",
  ],
  [
    "Camden Hells",
    "Balanced craft Helles with gentle bitterness and crisp drinkability.",
  ],
  [
    "Pillars Helles",
    "Smooth Helles lager with subtle grain sweetness and a neat, refreshing finish.",
  ],
  [
    "Pillars Original Pale",
    "A bright pale ale with citrus-hop aroma and clean sessionable structure.",
  ],
  [
    "Pillars Pilsner",
    "Crisp pilsner with precise hop character and a dry, refreshing close.",
  ],
  [
    "Modelo Especial",
    "Smooth golden lager with light malt sweetness and a crisp finish.",
  ],
  [
    "Galipette Cider Rose",
    "Rose cider with delicate fruit character and a bright, lightly sparkling finish.",
  ],
  [
    "Galipette Organic Biologique",
    "Organic French cider with fresh apple purity and a clean natural profile.",
  ],
  [
    "Omelette of Your Choice",
    "Free-range omelette prepared to order with premium fillings and a refined brunch presentation.",
  ],
]

const premiumDescriptions = new Map(
  premiumDescriptionEntries.map(([name, description]) => [
    normalizeDescriptionKey(name),
    description,
  ])
)

function descriptionFromCatalog(name: string): string | null {
  return premiumDescriptions.get(normalizeDescriptionKey(name)) ?? null
}

export function generateDescriptionFromName(name: string): string {
  const normalizedName = name.trim()
  if (!normalizedName) {
    return "A signature Fable Stores selection, freshly prepared with premium quality and polished presentation."
  }

  const catalogDescription = descriptionFromCatalog(normalizedName)
  if (catalogDescription) return catalogDescription

  const lower = normalizedName.toLowerCase()

  if (
    /(latte|cappuccino|americano|espresso|coffee|matcha|tea|hot chocolate|mocha|cortado|macchiato)/.test(
      lower
    )
  ) {
    return `${normalizedName} crafted to order with specialty-grade ingredients and a smooth, refined cafe finish.`
  }

  if (
    /(wine|prosecco|spritz|gin|tonic|lager|pilsner|ale|cider|malbec|sauvignon|gavi|sangiovese|rose)/.test(
      lower
    )
  ) {
    return `${normalizedName} selected for elegant balance and served with premium bar presentation.`
  }

  if (/(smoothie|juice|water|coke|sprite|soda|red bull)/.test(lower)) {
    return `${normalizedName} served perfectly chilled with a clean, refreshing finish.`
  }

  if (
    /(toast|sourdough|eggs|omelette|shakshuka|breakfast|brunch|pancake|granola)/.test(
      lower
    )
  ) {
    return `${normalizedName} prepared to order using quality produce for a composed, premium brunch profile.`
  }

  if (/(pizza)/.test(lower)) {
    return `${normalizedName} hand-finished on an artisan base for balanced texture and rich flavour depth.`
  }

  if (/(burger|wrap|sandwich|ciabatta|bagel|baguette)/.test(lower)) {
    return `${normalizedName} made fresh with layered flavour and elevated cafe-style execution.`
  }

  if (/(salad)/.test(lower)) {
    return `${normalizedName} built with crisp seasonal produce and a refined, balanced finish.`
  }

  if (/(cake|dessert|cookie|sweet|fondant|brownie)/.test(lower)) {
    return `${normalizedName} presented as a rich, elegant finish to your table.`
  }

  return `${normalizedName} freshly prepared in the Fable Stores kitchen with premium ingredients and a refined cafe standard.`
}

export function resolveItemDescription(
  name: string,
  description: string | null | undefined
): string {
  const normalized = typeof description === "string" ? description.trim() : ""
  if (normalized.length > 0) return normalized
  return generateDescriptionFromName(name)
}
