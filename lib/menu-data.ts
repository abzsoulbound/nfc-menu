import {
  getMenuItemCustomization,
  type MenuCustomization,
} from "@/lib/menuCustomizations"

export type MenuItemData = {
  id: string
  name: string
  description: string
  image: string | null
  basePrice: number
  vatRate: number
  allergens: string[]
  station: "KITCHEN" | "BAR"
  customization?: MenuCustomization | null
}

export type MenuSectionData = {
  id: string
  name: string
  items: MenuItemData[]
}

function inferStation(sectionId: string): "KITCHEN" | "BAR" {
  return sectionId === "drinks" ? "BAR" : "KITCHEN"
}

const baseMenu: MenuSectionData[] = [
  {
    id: "brunch",
    name: "Brunch",
    items: [
      { id: "las-vegas-breakfast", name: "Las Vegas Breakfast", description: "Two slices of bacon, hash browns, fried egg, Cumberland sausage, served with homemade pancakes dressed with berries and maple syrup on the side. Scrambled egg (Extra +1 GBP)", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "smashed-avocado-special", name: "Smashed Avocado Special", description: "Two free-range poached eggs with smashed avocado, sun-dried tomatoes and crumbled feta served on toasted sourdough bread", image: null, basePrice: 11.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "smashed-avocado-choice", name: "Smashed Avocado (Salmon/Bacon)", description: "Two free-range poached eggs on toasted sourdough bread with smashed avocado and a choice of bacon or smoked salmon", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "full-english", name: "Full English Breakfast", description: "Free-range fried eggs, beans, bacon, Cumberland sausage, hash browns, mushrooms and roasted cherry tomatoes with brown toast", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "steak-eggs", name: "Steak & Eggs", description: "8oz Scotch sirloin steak, two fried eggs, hash browns and brown toast", image: null, basePrice: 18.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "greek-breakfast", name: "Greek Breakfast", description: "Fried eggs, loukanika, halloumi, louza, cherry tomatoes and beans with Greek toast", image: null, basePrice: 13.45, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "vegan-breakfast", name: "Vegan Breakfast", description: "Vegan sausage, hash browns, mushrooms, tomatoes, beans and avocado with sourdough", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "vegetarian-breakfast", name: "Vegetarian Breakfast", description: "Vegetarian sausage, egg, hash browns, mushrooms, tomatoes, beans and avocado with sourdough. Scrambled egg +1 GBP", image: null, basePrice: 13.45, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "eggs-benedict", name: "Eggs Benedict (Salmon/Bacon)", description: "Two poached eggs on brioche with hollandaise", image: null, basePrice: 10.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "halal-breakfast", name: "Halal Breakfast", description: "Two fried eggs, turkey rashers, beef sausage, tomatoes, beans, hash browns and mushrooms with brown toast", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "omelette", name: "Omelette of Your Choice", description: "Choice of fillings, extra +1 GBP each, served with salad and chips", image: null, basePrice: 10.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "jacket-beans", name: "Jacket Potato (Baked Beans)", description: "Choice of fillings, served with salad and coleslaw", image: null, basePrice: 10.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "jacket-cheese", name: "Jacket Potato (Cheese)", description: "Choice of fillings, served with salad and coleslaw", image: null, basePrice: 10.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
      { id: "jacket-tuna", name: "Jacket Potato (Tuna Mayo & Sweetcorn)", description: "Choice of fillings, served with salad and coleslaw", image: null, basePrice: 11.95, vatRate: 0.2, allergens: [], station: inferStation("brunch") },
    ],
  },
  {
    id: "lunch",
    name: "Lunch",
    items: [
      { id: "baby-chicken", name: "Marlo's Baby Chicken", description: "Boneless grilled baby chicken in Marlo's spicy sauce with coleslaw and fries", image: null, basePrice: 17.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
      { id: "chicken-breast", name: "Chicken Breast", description: "Grilled Norfolk chicken breast with rice and roasted vegetables", image: null, basePrice: 14.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
      { id: "teriyaki-salmon", name: "Teriyaki Salmon", description: "Grilled teriyaki salmon with pak choi and basmati rice", image: null, basePrice: 20.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
      { id: "tuna-steak", name: "Tuna Steak", description: "Grilled tuna steak with mash and vegetables", image: null, basePrice: 22.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
      { id: "lamb-chops", name: "Lamb Chops", description: "Lamb chops with fries, rice or salad", image: null, basePrice: 24.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
      { id: "ribeye", name: "Ribeye Steak", description: "Grilled ribeye with peppercorn sauce, fries and salad", image: null, basePrice: 24.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
      { id: "wings", name: "Chicken Wings (8 pcs)", description: "Grilled wings with fries, rice or salad", image: null, basePrice: 14.95, vatRate: 0.2, allergens: [], station: inferStation("lunch") },
    ],
  },
  {
    id: "burgers",
    name: "Burgers",
    items: [
      { id: "marlo-burger", name: "Marlo's Burger", description: "Beef patty, avocado, bacon, American cheese, pickles, onions, lettuce, mustard mayo", image: null, basePrice: 14.95, vatRate: 0.2, allergens: [], station: inferStation("burgers") },
      { id: "classic-burger", name: "Classic Burger", description: "Beef patty, American cheese, pickles, onions, lettuce, mustard mayo", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("burgers") },
      { id: "buttermilk-chicken-burger", name: "Buttermilk Chicken Burger", description: "Buttermilk chicken thigh, gherkins, lettuce, cheese, tomato, harissa mayo", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("burgers") },
      { id: "chicken-burger", name: "Chicken Burger", description: "Grilled chicken, lettuce, tomato, mayonnaise", image: null, basePrice: 11.95, vatRate: 0.2, allergens: [], station: inferStation("burgers") },
      { id: "vegan-burger", name: "Vegan Burger", description: "Plant-based patty, vegan cheese, onions, pickles, lettuce, vegan aioli", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("burgers") },
      { id: "halloumi-burger", name: "Halloumi Burger", description: "Grilled halloumi, avocado, houmous, peppers, onion, lettuce, sweet chilli", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("burgers") },
    ],
  },
  {
    id: "salads",
    name: "Salads",
    items: [
      { id: "tuna-salad", name: "Grilled Tuna Salad", description: "Tuna steak, green beans, onions, olives, tomatoes, eggs, potatoes with lemon dressing", image: null, basePrice: 20.95, vatRate: 0.2, allergens: [], station: inferStation("salads") },
      { id: "marlo-salad", name: "Marlo's Salad", description: "Grilled chicken breast, bacon, lettuce, avocado, sweetcorn with ranch dressing", image: null, basePrice: 14.95, vatRate: 0.2, allergens: [], station: inferStation("salads") },
      { id: "caesar", name: "Caesar Salad", description: "Grilled chicken, lettuce, parmesan, croutons with caesar dressing", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("salads") },
      { id: "goats-cheese", name: "Goats Cheese Salad", description: "Grilled goats cheese, mixed leaves, peppers, tomatoes, mushrooms with pesto dressing", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("salads") },
      { id: "avocado-prawn", name: "Avocado & Prawn Salad", description: "Avocado, prawns, cucumber, tomatoes and pomegranate with honey mustard dressing", image: null, basePrice: 15.95, vatRate: 0.2, allergens: [], station: inferStation("salads") },
      { id: "salmon-salad", name: "Scottish Salmon Salad", description: "Grilled salmon, peppers, olives, cucumber and mushrooms with french dressing", image: null, basePrice: 17.95, vatRate: 0.2, allergens: [], station: inferStation("salads") },
    ],
  },
  {
    id: "sandwiches",
    name: "Sandwiches",
    items: [
      { id: "tuna-melt", name: "Tuna Melt Ciabatta", description: "Toasted ciabatta with tuna mayo, cheddar and spring onions", image: null, basePrice: 11.95, vatRate: 0.2, allergens: [], station: inferStation("sandwiches") },
      { id: "steak-ciabatta", name: "Steak Ciabatta", description: "Sirloin steak, melted cheddar and sauteed onions", image: null, basePrice: 17.95, vatRate: 0.2, allergens: [], station: inferStation("sandwiches") },
      { id: "smashed-avocado-toast", name: "Smashed Avocado", description: "Avocado, tomato, vegan cheese, pickles, lettuce and vegan mayo on toast", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("sandwiches") },
      { id: "blt", name: "Classic BLT", description: "Bacon, lettuce, tomato and mayo on toast", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("sandwiches") },
      { id: "escalope-baguette", name: "Escalope Baguette", description: "Breaded chicken, cheddar, tomato and basil mayo", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("sandwiches") },
    ],
  },
  {
    id: "pastas",
    name: "Pastas",
    items: [
      { id: "arrabiatta-prawns", name: "Arrabiatta Prawns", description: "Spicy tomato sauce with prawns", image: null, basePrice: 14.95, vatRate: 0.2, allergens: [], station: inferStation("pastas") },
      { id: "ravioli", name: "Ravioli", description: "Spinach and ricotta ravioli with tomato or creamy sauce", image: null, basePrice: 11.95, vatRate: 0.2, allergens: [], station: inferStation("pastas") },
      { id: "salmon-prawn-pasta", name: "Smoked Salmon and Prawn", description: "Salmon and prawns in garlic chilli oil sauce", image: null, basePrice: 16.95, vatRate: 0.2, allergens: [], station: inferStation("pastas") },
      { id: "milanese", name: "Milanese", description: "Breaded chicken with arrabiatta pasta", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("pastas") },
      { id: "alfredo-chicken", name: "Alfredo Chicken", description: "Chicken and mushrooms in garlic cream sauce", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("pastas") },
    ],
  },
  {
    id: "wraps",
    name: "Wraps",
    items: [
      { id: "steak-wrap", name: "Steak Wrap", description: "Grilled sirloin, tomatoes, onions, mustard mayo and lettuce", image: null, basePrice: 17.95, vatRate: 0.2, allergens: [], station: inferStation("wraps") },
      { id: "chicken-wrap", name: "Chicken Wrap", description: "Grilled chicken, lettuce and garlic basil mayo", image: null, basePrice: 13.95, vatRate: 0.2, allergens: [], station: inferStation("wraps") },
      { id: "halloumi-wrap", name: "Halloumi Wrap", description: "Halloumi, rocket, spinach, peppers and sweet chilli", image: null, basePrice: 12.95, vatRate: 0.2, allergens: [], station: inferStation("wraps") },
      { id: "falafel-wrap", name: "Falafel Wrap", description: "Falafel, lettuce, tomato, gherkins, jalapenos and houmous", image: null, basePrice: 12.45, vatRate: 0.2, allergens: [], station: inferStation("wraps") },
    ],
  },
  {
    id: "kids",
    name: "Kids Menu",
    items: [
      { id: "kids-fish-fingers", name: "Fish Fingers", description: "Served with chips and cucumber", image: null, basePrice: 7.95, vatRate: 0.2, allergens: [], station: inferStation("kids") },
      { id: "kids-nuggets", name: "Chicken Nuggets", description: "Served with chips and cucumber", image: null, basePrice: 7.95, vatRate: 0.2, allergens: [], station: inferStation("kids") },
      { id: "kids-burger", name: "Mini Burger", description: "Served with chips and cucumber", image: null, basePrice: 7.95, vatRate: 0.2, allergens: [], station: inferStation("kids") },
      { id: "kids-pasta", name: "Pasta", description: "Tomato or plain sauce, penne or spaghetti", image: null, basePrice: 7.95, vatRate: 0.2, allergens: [], station: inferStation("kids") },
      { id: "kids-omelette", name: "Omelette", description: "Served with chips and cucumber", image: null, basePrice: 7.95, vatRate: 0.2, allergens: [], station: inferStation("kids") },
      { id: "kids-breakfast", name: "Breakfast", description: "Egg, bacon, sausage and beans", image: null, basePrice: 7.95, vatRate: 0.2, allergens: [], station: inferStation("kids") },
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    items: [
      { id: "americano", name: "Americano", description: "", image: null, basePrice: 3.05, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "latte", name: "Latte", description: "", image: null, basePrice: 3.45, vatRate: 0.2, allergens: ["dairy"], station: inferStation("drinks") },
      { id: "cappuccino", name: "Cappuccino", description: "", image: null, basePrice: 3.45, vatRate: 0.2, allergens: ["dairy"], station: inferStation("drinks") },
      { id: "espresso-single", name: "Espresso (Single)", description: "", image: null, basePrice: 2.5, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "espresso-double", name: "Espresso (Double)", description: "", image: null, basePrice: 3.1, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "hot-chocolate", name: "Hot Chocolate", description: "", image: null, basePrice: 3.7, vatRate: 0.2, allergens: ["dairy"], station: inferStation("drinks") },
      { id: "coke", name: "Coke", description: "", image: null, basePrice: 3.3, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "diet-coke", name: "Diet Coke", description: "", image: null, basePrice: 3.3, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "sprite", name: "Sprite", description: "", image: null, basePrice: 3.3, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "still-water", name: "Still Water (330ml)", description: "", image: null, basePrice: 2.45, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "sparkling-water", name: "Sparkling Water (330ml)", description: "", image: null, basePrice: 2.95, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
      { id: "red-bull", name: "Red Bull", description: "", image: null, basePrice: 3.45, vatRate: 0.2, allergens: [], station: inferStation("drinks") },
    ],
  },
]

export const menu: MenuSectionData[] = baseMenu.map(section => ({
  ...section,
  items: section.items.map(item => ({
    ...item,
    customization: getMenuItemCustomization({
      ...item,
      station: item.station,
    }),
  })),
}))
