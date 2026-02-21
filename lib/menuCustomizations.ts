type ModifierGroupType = "single" | "multi"

export type MenuEditPolicy = "none" | "simple" | "full"

export type IngredientCatalogEntry = {
  id: string
  label: string
  allergens: string[]
}

export type MenuModifierOption = {
  id: string
  label: string
  priceDelta: number
  default?: boolean
  allergens?: string[]
  ingredientIds?: string[]
  removeIngredientIds?: string[]
}

export type MenuModifierGroup = {
  id: string
  name: string
  type: ModifierGroupType
  required?: boolean
  min?: number
  max?: number
  options: MenuModifierOption[]
}

export type MenuCustomization = {
  editPolicy?: MenuEditPolicy
  needsOwnerReview?: boolean
  baseIngredientIds?: string[]
  lockedIngredientIds?: string[]
  groups: MenuModifierGroup[]
}

export type MenuItemCustomizationContext = {
  id: string
  name?: string
  description?: string
  station?: string
  allergens?: string[]
}

export type ModifierSelections = Record<string, string[]>

type ValidationResult = {
  ok: boolean
  error?: string
  normalized: ModifierSelections
}

type CustomizationDefinition = {
  editPolicy?: MenuEditPolicy
  needsOwnerReview?: boolean
  autoRemovalGroup?: boolean
  autoExtraGroup?: boolean
  baseIngredientIds?: string[]
  lockedIngredientIds?: string[]
  groups?: MenuModifierGroup[]
}

const EDIT_PRICE_STRATEGY: "configured" | "zero" = "zero"

const ingredientCatalog: Record<string, IngredientCatalogEntry> = {
  american_cheese: {
    id: "american_cheese",
    label: "American Cheese",
    allergens: ["dairy"],
  },
  arrabiatta_pasta: {
    id: "arrabiatta_pasta",
    label: "Arrabiatta Pasta",
    allergens: ["gluten"],
  },
  arrabiatta_sauce: {
    id: "arrabiatta_sauce",
    label: "Arrabiatta Sauce",
    allergens: [],
  },
  avocado: { id: "avocado", label: "Avocado", allergens: [] },
  baby_chicken: { id: "baby_chicken", label: "Baby Chicken", allergens: [] },
  bacon: { id: "bacon", label: "Bacon", allergens: [] },
  baguette: {
    id: "baguette",
    label: "Baguette",
    allergens: ["gluten"],
  },
  basil_mayo: {
    id: "basil_mayo",
    label: "Basil Mayo",
    allergens: ["egg", "mustard"],
  },
  basmati_rice: {
    id: "basmati_rice",
    label: "Basmati Rice",
    allergens: [],
  },
  baked_beans: { id: "baked_beans", label: "Baked Beans", allergens: [] },
  beans: { id: "beans", label: "Beans", allergens: [] },
  beef_patty: { id: "beef_patty", label: "Beef Patty", allergens: [] },
  beef_sausage: {
    id: "beef_sausage",
    label: "Beef Sausage",
    allergens: [],
  },
  berries: { id: "berries", label: "Berries", allergens: [] },
  breaded_chicken: {
    id: "breaded_chicken",
    label: "Breaded Chicken",
    allergens: ["gluten"],
  },
  brioche: {
    id: "brioche",
    label: "Brioche",
    allergens: ["gluten", "egg", "dairy"],
  },
  brioche_bun: {
    id: "brioche_bun",
    label: "Brioche Bun",
    allergens: ["gluten", "egg", "dairy"],
  },
  brown_toast: {
    id: "brown_toast",
    label: "Brown Toast",
    allergens: ["gluten"],
  },
  buttermilk_chicken_thigh: {
    id: "buttermilk_chicken_thigh",
    label: "Buttermilk Chicken Thigh",
    allergens: ["dairy", "gluten"],
  },
  caesar_dressing: {
    id: "caesar_dressing",
    label: "Caesar Dressing",
    allergens: ["dairy", "egg", "fish"],
  },
  cheddar: {
    id: "cheddar",
    label: "Cheddar",
    allergens: ["dairy"],
  },
  cheese: { id: "cheese", label: "Cheese", allergens: ["dairy"] },
  chicken: { id: "chicken", label: "Chicken", allergens: [] },
  chicken_breast: {
    id: "chicken_breast",
    label: "Chicken Breast",
    allergens: [],
  },
  chicken_nuggets: {
    id: "chicken_nuggets",
    label: "Chicken Nuggets",
    allergens: ["gluten"],
  },
  chicken_wings: {
    id: "chicken_wings",
    label: "Chicken Wings",
    allergens: [],
  },
  chips: { id: "chips", label: "Chips", allergens: [] },
  ciabatta: {
    id: "ciabatta",
    label: "Ciabatta",
    allergens: ["gluten"],
  },
  coconut_milk: {
    id: "coconut_milk",
    label: "Coconut Milk",
    allergens: [],
  },
  coleslaw: {
    id: "coleslaw",
    label: "Coleslaw",
    allergens: ["egg"],
  },
  creamy_sauce: {
    id: "creamy_sauce",
    label: "Creamy Sauce",
    allergens: ["dairy"],
  },
  croutons: {
    id: "croutons",
    label: "Croutons",
    allergens: ["gluten"],
  },
  cucumber: { id: "cucumber", label: "Cucumber", allergens: [] },
  cumberland_sausage: {
    id: "cumberland_sausage",
    label: "Cumberland Sausage",
    allergens: ["sulphites"],
  },
  curly_fries: {
    id: "curly_fries",
    label: "Curly Fries",
    allergens: [],
  },
  egg: { id: "egg", label: "Egg", allergens: ["egg"] },
  escalope_chicken: {
    id: "escalope_chicken",
    label: "Breaded Chicken Escalope",
    allergens: ["gluten"],
  },
  espresso_shot: {
    id: "espresso_shot",
    label: "Espresso",
    allergens: [],
  },
  falafel: { id: "falafel", label: "Falafel", allergens: ["sesame"] },
  feta: { id: "feta", label: "Feta", allergens: ["dairy"] },
  fish_fingers: {
    id: "fish_fingers",
    label: "Fish Fingers",
    allergens: ["fish", "gluten"],
  },
  french_dressing: {
    id: "french_dressing",
    label: "French Dressing",
    allergens: ["mustard"],
  },
  french_fries: {
    id: "french_fries",
    label: "French Fries",
    allergens: [],
  },
  fries: { id: "fries", label: "Fries", allergens: [] },
  garlic_basil_mayo: {
    id: "garlic_basil_mayo",
    label: "Garlic Basil Mayo",
    allergens: ["egg", "mustard"],
  },
  garlic_chilli_oil_sauce: {
    id: "garlic_chilli_oil_sauce",
    label: "Garlic Chilli Oil Sauce",
    allergens: [],
  },
  garlic_cream_sauce: {
    id: "garlic_cream_sauce",
    label: "Garlic Cream Sauce",
    allergens: ["dairy"],
  },
  gherkin: { id: "gherkin", label: "Gherkin", allergens: [] },
  goats_cheese: {
    id: "goats_cheese",
    label: "Goat's Cheese",
    allergens: ["dairy"],
  },
  greek_toast: {
    id: "greek_toast",
    label: "Greek Toast",
    allergens: ["gluten"],
  },
  green_beans: {
    id: "green_beans",
    label: "Green Beans",
    allergens: [],
  },
  halloumi: {
    id: "halloumi",
    label: "Halloumi",
    allergens: ["dairy"],
  },
  ham: { id: "ham", label: "Ham", allergens: [] },
  harissa_mayo: {
    id: "harissa_mayo",
    label: "Harissa Mayo",
    allergens: ["egg", "mustard"],
  },
  hash_browns: {
    id: "hash_browns",
    label: "Hash Browns",
    allergens: [],
  },
  hollandaise: {
    id: "hollandaise",
    label: "Hollandaise",
    allergens: ["egg", "dairy"],
  },
  homemade_pancakes: {
    id: "homemade_pancakes",
    label: "Homemade Pancakes",
    allergens: ["gluten", "egg", "dairy"],
  },
  honey_mustard_dressing: {
    id: "honey_mustard_dressing",
    label: "Honey Mustard Dressing",
    allergens: ["mustard"],
  },
  hot_chocolate_powder: {
    id: "hot_chocolate_powder",
    label: "Hot Chocolate",
    allergens: ["dairy"],
  },
  houmous: {
    id: "houmous",
    label: "Houmous",
    allergens: ["sesame"],
  },
  jalapeno: { id: "jalapeno", label: "Jalapenos", allergens: [] },
  jacket_potato: {
    id: "jacket_potato",
    label: "Jacket Potato",
    allergens: [],
  },
  lamb_chops: { id: "lamb_chops", label: "Lamb Chops", allergens: [] },
  lemon_dressing: {
    id: "lemon_dressing",
    label: "Lemon Dressing",
    allergens: ["mustard"],
  },
  lettuce: { id: "lettuce", label: "Lettuce", allergens: [] },
  loukanika: { id: "loukanika", label: "Loukanika", allergens: [] },
  louza: { id: "louza", label: "Louza", allergens: [] },
  maple_syrup: {
    id: "maple_syrup",
    label: "Maple Syrup",
    allergens: [],
  },
  mash: { id: "mash", label: "Mash", allergens: ["dairy"] },
  mayo: { id: "mayo", label: "Mayo", allergens: ["egg", "mustard"] },
  mayonnaise: {
    id: "mayonnaise",
    label: "Mayonnaise",
    allergens: ["egg", "mustard"],
  },
  mini_burger_bun: {
    id: "mini_burger_bun",
    label: "Mini Burger Bun",
    allergens: ["gluten", "egg", "dairy"],
  },
  mini_burger_patty: {
    id: "mini_burger_patty",
    label: "Mini Burger Patty",
    allergens: [],
  },
  mixed_leaves: {
    id: "mixed_leaves",
    label: "Mixed Leaves",
    allergens: [],
  },
  mushroom: { id: "mushroom", label: "Mushrooms", allergens: [] },
  mustard_mayo: {
    id: "mustard_mayo",
    label: "Mustard Mayo",
    allergens: ["egg", "mustard"],
  },
  oat_milk: { id: "oat_milk", label: "Oat Milk", allergens: [] },
  olive: { id: "olive", label: "Olives", allergens: [] },
  omelette_egg: {
    id: "omelette_egg",
    label: "Omelette Eggs",
    allergens: ["egg"],
  },
  onion: { id: "onion", label: "Onions", allergens: [] },
  pak_choi: { id: "pak_choi", label: "Pak Choi", allergens: [] },
  parmesan: { id: "parmesan", label: "Parmesan", allergens: ["dairy"] },
  penne: { id: "penne", label: "Penne", allergens: ["gluten"] },
  pepper: { id: "pepper", label: "Peppers", allergens: [] },
  peppercorn_sauce: {
    id: "peppercorn_sauce",
    label: "Peppercorn Sauce",
    allergens: ["dairy"],
  },
  pesto_dressing: {
    id: "pesto_dressing",
    label: "Pesto Dressing",
    allergens: ["nuts", "dairy"],
  },
  pickle: { id: "pickle", label: "Pickles", allergens: [] },
  plain_sauce: {
    id: "plain_sauce",
    label: "Plain Sauce",
    allergens: [],
  },
  plant_based_patty: {
    id: "plant_based_patty",
    label: "Plant-based Patty",
    allergens: ["gluten", "soy"],
  },
  pomegranate: {
    id: "pomegranate",
    label: "Pomegranate",
    allergens: [],
  },
  potato: { id: "potato", label: "Potatoes", allergens: [] },
  prawns: { id: "prawns", label: "Prawns", allergens: ["shellfish"] },
  ranch_dressing: {
    id: "ranch_dressing",
    label: "Ranch Dressing",
    allergens: ["dairy", "egg", "mustard"],
  },
  ribeye: { id: "ribeye", label: "Ribeye", allergens: [] },
  rice: { id: "rice", label: "Rice", allergens: [] },
  ricotta_ravioli: {
    id: "ricotta_ravioli",
    label: "Ricotta Ravioli",
    allergens: ["gluten", "dairy", "egg"],
  },
  rocket: { id: "rocket", label: "Rocket", allergens: [] },
  salad: { id: "salad", label: "Salad", allergens: [] },
  salmon: { id: "salmon", label: "Salmon", allergens: ["fish"] },
  sausage: { id: "sausage", label: "Sausage", allergens: [] },
  sauteed_onion: {
    id: "sauteed_onion",
    label: "Sauteed Onions",
    allergens: [],
  },
  scotch_sirloin_steak: {
    id: "scotch_sirloin_steak",
    label: "Scotch Sirloin Steak",
    allergens: [],
  },
  sirloin: { id: "sirloin", label: "Sirloin", allergens: [] },
  sirloin_steak: {
    id: "sirloin_steak",
    label: "Sirloin Steak",
    allergens: [],
  },
  smashed_avocado: {
    id: "smashed_avocado",
    label: "Smashed Avocado",
    allergens: [],
  },
  smoked_salmon: {
    id: "smoked_salmon",
    label: "Smoked Salmon",
    allergens: ["fish"],
  },
  soy_milk: { id: "soy_milk", label: "Soy Milk", allergens: ["soy"] },
  sourdough: {
    id: "sourdough",
    label: "Sourdough",
    allergens: ["gluten"],
  },
  sourdough_bread: {
    id: "sourdough_bread",
    label: "Sourdough Bread",
    allergens: ["gluten"],
  },
  spaghetti: {
    id: "spaghetti",
    label: "Spaghetti",
    allergens: ["gluten"],
  },
  spicy_sauce: {
    id: "spicy_sauce",
    label: "Spicy Sauce",
    allergens: [],
  },
  spicy_tomato_sauce: {
    id: "spicy_tomato_sauce",
    label: "Spicy Tomato Sauce",
    allergens: [],
  },
  spinach: { id: "spinach", label: "Spinach", allergens: [] },
  spring_onion: {
    id: "spring_onion",
    label: "Spring Onions",
    allergens: [],
  },
  sun_dried_tomato: {
    id: "sun_dried_tomato",
    label: "Sun-dried Tomatoes",
    allergens: [],
  },
  sweet_chilli: {
    id: "sweet_chilli",
    label: "Sweet Chilli",
    allergens: [],
  },
  sweet_potato_fries: {
    id: "sweet_potato_fries",
    label: "Sweet Potato Fries",
    allergens: [],
  },
  sweetcorn: { id: "sweetcorn", label: "Sweetcorn", allergens: [] },
  teriyaki_salmon: {
    id: "teriyaki_salmon",
    label: "Teriyaki Salmon",
    allergens: ["fish", "soy"],
  },
  toast: { id: "toast", label: "Toast", allergens: ["gluten"] },
  tomato: { id: "tomato", label: "Tomato", allergens: [] },
  tomato_sauce: {
    id: "tomato_sauce",
    label: "Tomato Sauce",
    allergens: [],
  },
  tortilla_wrap: {
    id: "tortilla_wrap",
    label: "Tortilla Wrap",
    allergens: ["gluten"],
  },
  tuna_mayo: {
    id: "tuna_mayo",
    label: "Tuna Mayo",
    allergens: ["fish", "egg", "mustard"],
  },
  tuna_steak: {
    id: "tuna_steak",
    label: "Tuna Steak",
    allergens: ["fish"],
  },
  turkey_rashers: {
    id: "turkey_rashers",
    label: "Turkey Rashers",
    allergens: [],
  },
  vegan_aioli: {
    id: "vegan_aioli",
    label: "Vegan Aioli",
    allergens: [],
  },
  vegan_cheese: {
    id: "vegan_cheese",
    label: "Vegan Cheese",
    allergens: ["soy"],
  },
  vegan_mayo: {
    id: "vegan_mayo",
    label: "Vegan Mayo",
    allergens: ["soy"],
  },
  vegan_sausage: {
    id: "vegan_sausage",
    label: "Vegan Sausage",
    allergens: ["gluten", "soy"],
  },
  vegetables: { id: "vegetables", label: "Vegetables", allergens: [] },
  vegetarian_sausage: {
    id: "vegetarian_sausage",
    label: "Vegetarian Sausage",
    allergens: ["gluten", "soy"],
  },
  white_toast: {
    id: "white_toast",
    label: "White Toast",
    allergens: ["gluten"],
  },
  whole_milk: {
    id: "whole_milk",
    label: "Whole Milk",
    allergens: ["dairy"],
  },
}

const coreIngredientIds = new Set([
  "baby_chicken",
  "beef_patty",
  "buttermilk_chicken_thigh",
  "chicken",
  "chicken_breast",
  "chicken_nuggets",
  "chicken_wings",
  "egg",
  "escalope_chicken",
  "falafel",
  "fish_fingers",
  "halloumi",
  "lamb_chops",
  "mini_burger_patty",
  "omelette_egg",
  "plant_based_patty",
  "prawns",
  "ribeye",
  "salmon",
  "sausage",
  "scotch_sirloin_steak",
  "sirloin",
  "sirloin_steak",
  "smoked_salmon",
  "teriyaki_salmon",
  "tuna_steak",
  "vegan_sausage",
  "vegetarian_sausage",
])

const descriptionPhraseMap: Record<string, string[]> = {
  "american cheese": ["american_cheese"],
  "arrabiatta pasta": ["arrabiatta_pasta"],
  "avocado": ["avocado"],
  "baby chicken": ["baby_chicken"],
  "bacon": ["bacon"],
  "basmati rice": ["basmati_rice"],
  "beans": ["beans"],
  "beef patty": ["beef_patty"],
  "beef sausage": ["beef_sausage"],
  "berries": ["berries"],
  "breaded chicken": ["breaded_chicken"],
  "brioche": ["brioche"],
  "brown toast": ["brown_toast"],
  "buttermilk chicken thigh": ["buttermilk_chicken_thigh"],
  "caesar dressing": ["caesar_dressing"],
  "cheddar": ["cheddar"],
  "cheese": ["cheese"],
  "cherry tomatoes": ["tomato"],
  "chicken": ["chicken"],
  "chicken breast": ["chicken_breast"],
  "chips": ["chips"],
  "ciabatta": ["ciabatta"],
  "coleslaw": ["coleslaw"],
  "creamy sauce": ["creamy_sauce"],
  "croutons": ["croutons"],
  "crumbled feta": ["feta"],
  "cucumber": ["cucumber"],
  "cumberland sausage": ["cumberland_sausage"],
  "egg": ["egg"],
  "eggs": ["egg"],
  "falafel": ["falafel"],
  "french dressing": ["french_dressing"],
  "fried egg": ["egg"],
  "fried eggs": ["egg"],
  "fries": ["fries"],
  "garlic basil mayo": ["garlic_basil_mayo"],
  "garlic chilli oil sauce": ["garlic_chilli_oil_sauce"],
  "garlic cream sauce": ["garlic_cream_sauce"],
  "gherkins": ["gherkin"],
  "goats cheese": ["goats_cheese"],
  "greek toast": ["greek_toast"],
  "green beans": ["green_beans"],
  "halloumi": ["halloumi"],
  "harissa mayo": ["harissa_mayo"],
  "hash browns": ["hash_browns"],
  "hollandaise": ["hollandaise"],
  "homemade pancakes dressed": ["homemade_pancakes"],
  "honey mustard dressing": ["honey_mustard_dressing"],
  "houmous": ["houmous"],
  "jalapenos": ["jalapeno"],
  "lamb chops": ["lamb_chops"],
  "lemon dressing": ["lemon_dressing"],
  "lettuce": ["lettuce"],
  "loukanika": ["loukanika"],
  "louza": ["louza"],
  "maple syrup": ["maple_syrup"],
  "marlo's spicy sauce": ["spicy_sauce"],
  "mash": ["mash"],
  "mayo": ["mayo"],
  "mayonnaise": ["mayonnaise"],
  "mixed leaves": ["mixed_leaves"],
  "mushrooms": ["mushroom"],
  "mustard mayo": ["mustard_mayo"],
  "norfolk chicken breast": ["chicken_breast"],
  "olives": ["olive"],
  "onion": ["onion"],
  "onions": ["onion"],
  "pak choi": ["pak_choi"],
  "parmesan": ["parmesan"],
  "penne": ["penne"],
  "peppercorn sauce": ["peppercorn_sauce"],
  "peppers": ["pepper"],
  "pesto dressing": ["pesto_dressing"],
  "pickles": ["pickle"],
  "plain sauce": ["plain_sauce"],
  "plant-based patty": ["plant_based_patty"],
  "poached eggs": ["egg"],
  "pomegranate": ["pomegranate"],
  "potatoes": ["potato"],
  "prawns": ["prawns"],
  "ranch dressing": ["ranch_dressing"],
  "ribeye": ["ribeye"],
  "rice": ["rice"],
  "ricotta ravioli": ["ricotta_ravioli"],
  "rocket": ["rocket"],
  "salad": ["salad"],
  "salmon": ["salmon"],
  "sausage": ["sausage"],
  "sauteed onions": ["sauteed_onion"],
  "scotch sirloin steak": ["scotch_sirloin_steak"],
  "sirloin": ["sirloin"],
  "sirloin steak": ["sirloin_steak"],
  "smashed avocado": ["smashed_avocado"],
  "smoked salmon": ["smoked_salmon"],
  "sourdough": ["sourdough"],
  "sourdough bread": ["sourdough_bread"],
  "spaghetti": ["spaghetti"],
  "spicy tomato sauce": ["spicy_tomato_sauce"],
  "spinach": ["spinach"],
  "spring onions": ["spring_onion"],
  "sun-dried tomatoes": ["sun_dried_tomato"],
  "sweet chilli": ["sweet_chilli"],
  "sweetcorn": ["sweetcorn"],
  "teriyaki salmon": ["teriyaki_salmon"],
  "toast": ["toast"],
  "tomato": ["tomato"],
  "tomatoes": ["tomato"],
  "tomato sauce": ["tomato_sauce"],
  "tuna mayo": ["tuna_mayo"],
  "tuna steak": ["tuna_steak"],
  "turkey rashers": ["turkey_rashers"],
  "vegan aioli": ["vegan_aioli"],
  "vegan cheese": ["vegan_cheese"],
  "vegan mayo": ["vegan_mayo"],
  "vegan sausage": ["vegan_sausage"],
  "vegetables": ["vegetables"],
  "vegetarian sausage": ["vegetarian_sausage"],
  "wings": ["chicken_wings"],
}

const itemIngredientOverrides: Record<
  string,
  { baseIngredientIds: string[]; lockedIngredientIds?: string[] }
> = {
  "jacket-beans": {
    baseIngredientIds: ["jacket_potato", "baked_beans", "salad", "coleslaw"],
    lockedIngredientIds: ["jacket_potato", "baked_beans"],
  },
  "jacket-cheese": {
    baseIngredientIds: ["jacket_potato", "cheese", "salad", "coleslaw"],
    lockedIngredientIds: ["jacket_potato"],
  },
  "jacket-tuna": {
    baseIngredientIds: ["jacket_potato", "tuna_mayo", "sweetcorn", "salad", "coleslaw"],
    lockedIngredientIds: ["jacket_potato", "tuna_mayo"],
  },
  "steak-ciabatta": {
    baseIngredientIds: ["ciabatta", "sirloin_steak", "cheddar", "sauteed_onion"],
    lockedIngredientIds: ["ciabatta", "sirloin_steak"],
  },
  "escalope-baguette": {
    baseIngredientIds: ["baguette", "escalope_chicken", "cheddar", "tomato", "basil_mayo"],
    lockedIngredientIds: ["baguette", "escalope_chicken"],
  },
  "kids-fish-fingers": {
    baseIngredientIds: ["fish_fingers", "chips", "cucumber"],
    lockedIngredientIds: ["fish_fingers"],
  },
  "kids-nuggets": {
    baseIngredientIds: ["chicken_nuggets", "chips", "cucumber"],
    lockedIngredientIds: ["chicken_nuggets"],
  },
  "kids-burger": {
    baseIngredientIds: ["mini_burger_bun", "mini_burger_patty", "chips", "cucumber"],
    lockedIngredientIds: ["mini_burger_bun", "mini_burger_patty"],
  },
  "kids-omelette": {
    baseIngredientIds: ["omelette_egg", "chips", "cucumber"],
    lockedIngredientIds: ["omelette_egg"],
  },
}

const burgerSideGroup: MenuModifierGroup = {
  id: "side_choice",
  name: "Choose your side",
  type: "single",
  required: true,
  options: [
    {
      id: "french_fries",
      label: "French Fries",
      priceDelta: 0,
      default: true,
      ingredientIds: ["french_fries"],
    },
    {
      id: "curly_fries",
      label: "Curly Fries",
      priceDelta: 0,
      ingredientIds: ["curly_fries"],
    },
    {
      id: "sweet_potato_fries",
      label: "Sweet Potato Fries",
      priceDelta: 1,
      ingredientIds: ["sweet_potato_fries"],
    },
  ],
}

const friesRiceSaladGroup: MenuModifierGroup = {
  id: "side_choice",
  name: "Choose your side",
  type: "single",
  required: true,
  options: [
    {
      id: "fries",
      label: "Fries",
      priceDelta: 0,
      default: true,
      ingredientIds: ["fries"],
    },
    {
      id: "rice",
      label: "Rice",
      priceDelta: 0,
      ingredientIds: ["rice"],
    },
    {
      id: "salad",
      label: "Salad",
      priceDelta: 0,
      ingredientIds: ["salad"],
    },
  ],
}

const pastaShapeGroup: MenuModifierGroup = {
  id: "pasta_shape",
  name: "Choose pasta",
  type: "single",
  required: true,
  options: [
    {
      id: "spaghetti",
      label: "Spaghetti",
      priceDelta: 0,
      default: true,
      ingredientIds: ["spaghetti"],
    },
    {
      id: "penne",
      label: "Penne",
      priceDelta: 0,
      ingredientIds: ["penne"],
    },
  ],
}

const milkChoiceGroup: MenuModifierGroup = {
  id: "milk_choice",
  name: "Milk",
  type: "single",
  required: true,
  options: [
    {
      id: "whole_milk",
      label: "Whole Milk",
      priceDelta: 0,
      default: true,
      ingredientIds: ["whole_milk"],
    },
    {
      id: "oat_milk",
      label: "Oat Milk",
      priceDelta: 0,
      ingredientIds: ["oat_milk"],
    },
    {
      id: "soy_milk",
      label: "Soy Milk",
      priceDelta: 0,
      ingredientIds: ["soy_milk"],
    },
    {
      id: "coconut_milk",
      label: "Coconut Milk",
      priceDelta: 0,
      ingredientIds: ["coconut_milk"],
    },
  ],
}

const drinkTemperatureGroup: MenuModifierGroup = {
  id: "temperature",
  name: "Temperature",
  type: "single",
  required: true,
  options: [
    {
      id: "hot",
      label: "Hot",
      priceDelta: 0,
      default: true,
    },
    {
      id: "iced",
      label: "Iced",
      priceDelta: 0,
    },
  ],
}

const syrupFlavorGroup: MenuModifierGroup = {
  id: "syrup_flavor",
  name: "Syrup flavour",
  type: "single",
  required: true,
  options: [
    {
      id: "vanilla",
      label: "Vanilla",
      priceDelta: 0,
      default: true,
    },
    {
      id: "caramel",
      label: "Caramel",
      priceDelta: 0,
    },
    {
      id: "hazelnut",
      label: "Hazelnut",
      priceDelta: 0,
    },
    {
      id: "coconut",
      label: "Coconut",
      priceDelta: 0,
    },
  ],
}

const alternativeMilkGroup: MenuModifierGroup = {
  id: "alternative_milk",
  name: "Milk type",
  type: "single",
  required: true,
  options: [
    {
      id: "oat",
      label: "Oat",
      priceDelta: 0,
      default: true,
      ingredientIds: ["oat_milk"],
    },
    {
      id: "almond",
      label: "Almond",
      priceDelta: 0,
      ingredientIds: ["almond_milk"],
    },
    {
      id: "soya",
      label: "Soya",
      priceDelta: 0,
      ingredientIds: ["soy_milk"],
    },
    {
      id: "coconut",
      label: "Coconut",
      priceDelta: 0,
      ingredientIds: ["coconut_milk"],
    },
  ],
}

const toppingChoiceGroup: MenuModifierGroup = {
  id: "topping_choice",
  name: "Choose topping",
  type: "single",
  required: true,
  options: [
    {
      id: "whipping_cream",
      label: "Whipping Cream",
      priceDelta: 0,
      default: true,
    },
    {
      id: "marshmallow",
      label: "Marshmallow",
      priceDelta: 0,
    },
  ],
}

const teaBlendGroup: MenuModifierGroup = {
  id: "tea_blend",
  name: "Choose tea",
  type: "single",
  required: true,
  options: [
    {
      id: "english_breakfast_gold",
      label: "English Breakfast Gold",
      priceDelta: 0,
      default: true,
    },
    {
      id: "decaf",
      label: "Decaf",
      priceDelta: 0,
    },
    {
      id: "earl_grey",
      label: "Earl Grey",
      priceDelta: 0,
    },
  ],
}

const omeletteCustomization = finalizeCustomization({
  editPolicy: "full",
  needsOwnerReview: true,
  baseIngredientIds: ["omelette_egg", "salad", "chips"],
  lockedIngredientIds: ["omelette_egg"],
  autoRemovalGroup: false,
  autoExtraGroup: false,
  groups: [
    {
      id: "fillings",
      name: "Choose any 3 fillings",
      type: "multi",
      min: 3,
      max: 3,
      required: true,
      options: [
        {
          id: "ham",
          label: "Ham",
          priceDelta: 0,
          ingredientIds: ["ham"],
        },
        {
          id: "onions",
          label: "Onions",
          priceDelta: 0,
          ingredientIds: ["onion"],
        },
        {
          id: "peppers",
          label: "Peppers",
          priceDelta: 0,
          ingredientIds: ["pepper"],
        },
        {
          id: "cheese",
          label: "Cheese",
          priceDelta: 0,
          ingredientIds: ["cheese"],
        },
        {
          id: "feta_cheese",
          label: "Feta Cheese",
          priceDelta: 0,
          ingredientIds: ["feta"],
        },
        {
          id: "mushrooms",
          label: "Mushrooms",
          priceDelta: 0,
          ingredientIds: ["mushroom"],
        },
        {
          id: "spinach",
          label: "Spinach",
          priceDelta: 0,
          ingredientIds: ["spinach"],
        },
      ],
    },
  ],
})

const explicitCustomizationByItemId: Record<string, MenuCustomization> = {
  "las-vegas-breakfast": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "bacon",
      "hash_browns",
      "egg",
      "cumberland_sausage",
      "homemade_pancakes",
      "berries",
      "maple_syrup",
    ],
    lockedIngredientIds: [],
    groups: [
      {
        id: "egg_style",
        name: "Egg style",
        type: "single",
        required: false,
        options: [
          {
            id: "fried",
            label: "Fried Egg",
            priceDelta: 0,
            default: true,
            ingredientIds: ["egg"],
          },
          {
            id: "scrambled",
            label: "Scrambled Egg",
            priceDelta: 1,
            ingredientIds: ["egg"],
          },
        ],
      },
    ],
  }),
  "smashed-avocado-choice": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["egg", "sourdough_bread", "smashed_avocado"],
    lockedIngredientIds: ["egg", "sourdough_bread"],
    groups: [
      {
        id: "protein",
        name: "Choose protein",
        type: "single",
        required: true,
        options: [
          {
            id: "bacon",
            label: "Bacon",
            priceDelta: 0,
            default: true,
            ingredientIds: ["bacon"],
          },
          {
            id: "smoked_salmon",
            label: "Smoked Salmon",
            priceDelta: 0.5,
            ingredientIds: ["smoked_salmon"],
          },
        ],
      },
    ],
  }),
  "eggs-benedict": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["egg", "brioche", "hollandaise"],
    lockedIngredientIds: ["egg", "brioche"],
    groups: [
      {
        id: "protein",
        name: "Choose protein",
        type: "single",
        required: true,
        options: [
          {
            id: "bacon",
            label: "Bacon",
            priceDelta: 0,
            default: true,
            ingredientIds: ["bacon"],
          },
          {
            id: "smoked_salmon",
            label: "Smoked Salmon",
            priceDelta: 2,
            ingredientIds: ["smoked_salmon"],
          },
        ],
      },
    ],
  }),
  "homemade-sourdough-bread-smashed-avocado-poached-scrambled-egg":
    finalizeCustomization({
      editPolicy: "full",
      needsOwnerReview: true,
      baseIngredientIds: ["sourdough_bread", "smashed_avocado", "egg"],
      lockedIngredientIds: ["sourdough_bread", "smashed_avocado"],
      groups: [
        {
          id: "egg_style",
          name: "Egg style",
          type: "single",
          required: true,
          options: [
            {
              id: "poached",
              label: "Poached",
              priceDelta: 0,
              default: true,
              ingredientIds: ["egg"],
            },
            {
              id: "scrambled",
              label: "Scrambled",
              priceDelta: 0,
              ingredientIds: ["egg"],
            },
          ],
        },
      ],
    }),
  omelette: omeletteCustomization,
  "omelette-with-any-3-fillings": omeletteCustomization,
  "lamb-chops": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["lamb_chops"],
    lockedIngredientIds: ["lamb_chops"],
    groups: [friesRiceSaladGroup],
  }),
  wings: finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["chicken_wings"],
    lockedIngredientIds: ["chicken_wings"],
    groups: [friesRiceSaladGroup],
  }),
  "marlo-burger": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "brioche_bun",
      "beef_patty",
      "avocado",
      "bacon",
      "american_cheese",
      "pickle",
      "onion",
      "lettuce",
      "mustard_mayo",
    ],
    lockedIngredientIds: ["brioche_bun", "beef_patty"],
    groups: [burgerSideGroup],
  }),
  "classic-burger": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "brioche_bun",
      "beef_patty",
      "american_cheese",
      "pickle",
      "onion",
      "lettuce",
      "mustard_mayo",
    ],
    lockedIngredientIds: ["brioche_bun", "beef_patty"],
    groups: [burgerSideGroup],
  }),
  "buttermilk-chicken-burger": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "brioche_bun",
      "buttermilk_chicken_thigh",
      "gherkin",
      "lettuce",
      "cheese",
      "tomato",
      "harissa_mayo",
    ],
    lockedIngredientIds: ["brioche_bun", "buttermilk_chicken_thigh"],
    groups: [burgerSideGroup],
  }),
  "chicken-burger": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "brioche_bun",
      "chicken",
      "lettuce",
      "tomato",
      "mayonnaise",
    ],
    lockedIngredientIds: ["brioche_bun", "chicken"],
    groups: [burgerSideGroup],
  }),
  "vegan-burger": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "brioche_bun",
      "plant_based_patty",
      "vegan_cheese",
      "onion",
      "pickle",
      "lettuce",
      "vegan_aioli",
    ],
    lockedIngredientIds: ["brioche_bun", "plant_based_patty"],
    groups: [burgerSideGroup],
  }),
  "halloumi-burger": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: [
      "brioche_bun",
      "halloumi",
      "avocado",
      "houmous",
      "pepper",
      "onion",
      "lettuce",
      "sweet_chilli",
    ],
    lockedIngredientIds: ["brioche_bun", "halloumi"],
    groups: [burgerSideGroup],
  }),
  blt: finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["bacon", "lettuce", "tomato", "mayo"],
    lockedIngredientIds: [],
    groups: [
      {
        id: "bread",
        name: "Bread",
        type: "single",
        required: true,
        options: [
          {
            id: "white",
            label: "White Toast",
            priceDelta: 0,
            default: true,
            ingredientIds: ["white_toast"],
          },
          {
            id: "brown",
            label: "Brown Toast",
            priceDelta: 0,
            ingredientIds: ["brown_toast"],
          },
        ],
      },
    ],
  }),
  "full-english": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["egg", "beans", "bacon", "cumberland_sausage", "hash_browns", "mushroom", "tomato"],
    lockedIngredientIds: [],
    groups: [
      {
        id: "sausage_choice",
        name: "Sausage substitute",
        type: "single",
        required: false,
        options: [
          {
            id: "cumberland",
            label: "Cumberland Sausage",
            priceDelta: 0,
            default: true,
            ingredientIds: ["cumberland_sausage"],
            removeIngredientIds: ["beef_sausage", "vegan_sausage", "vegetarian_sausage"],
          },
          {
            id: "beef",
            label: "Beef Sausage",
            priceDelta: 0,
            ingredientIds: ["beef_sausage"],
            removeIngredientIds: ["cumberland_sausage", "vegan_sausage", "vegetarian_sausage"],
          },
          {
            id: "vegan",
            label: "Vegan Sausage",
            priceDelta: 0,
            ingredientIds: ["vegan_sausage"],
            removeIngredientIds: ["cumberland_sausage", "beef_sausage", "vegetarian_sausage"],
          },
          {
            id: "vegetarian",
            label: "Vegetarian Sausage",
            priceDelta: 0,
            ingredientIds: ["vegetarian_sausage"],
            removeIngredientIds: ["cumberland_sausage", "beef_sausage", "vegan_sausage"],
          },
        ],
      },
      {
        id: "hash_brown_choice",
        name: "Base vegetable",
        type: "single",
        required: false,
        options: [
          {
            id: "hash_browns",
            label: "Hash Browns",
            priceDelta: 0,
            default: true,
            ingredientIds: ["hash_browns"],
            removeIngredientIds: ["grilled_tomato", "mushroom_grilled"],
          },
          {
            id: "grilled_tomato",
            label: "Grilled Tomato",
            priceDelta: 0,
            ingredientIds: ["grilled_tomato"],
            removeIngredientIds: ["hash_browns", "mushroom_grilled"],
          },
          {
            id: "mushroom",
            label: "Grilled Mushroom",
            priceDelta: 0,
            ingredientIds: ["mushroom_grilled"],
            removeIngredientIds: ["hash_browns", "grilled_tomato"],
          },
        ],
      },
      {
        id: "bacon_choice",
        name: "Protein upgrade",
        type: "single",
        required: false,
        options: [
          {
            id: "bacon_standard",
            label: "Bacon (standard)",
            priceDelta: 0,
            default: true,
            ingredientIds: ["bacon"],
            removeIngredientIds: ["turkey_rashers", "smoked_bacon"],
          },
          {
            id: "smoked_bacon",
            label: "Smoked Bacon",
            priceDelta: 0.50,
            ingredientIds: ["smoked_bacon"],
            removeIngredientIds: ["bacon", "turkey_rashers"],
          },
          {
            id: "turkey",
            label: "Turkey Rashers",
            priceDelta: 0,
            ingredientIds: ["turkey_rashers"],
            removeIngredientIds: ["bacon", "smoked_bacon"],
          },
        ],
      },
    ],
  }),
  "halal-breakfast": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["egg", "turkey_rashers", "beef_sausage", "tomato", "beans", "hash_browns", "mushroom"],
    lockedIngredientIds: [],
    groups: [
      {
        id: "sausage_choice",
        name: "Sausage substitute",
        type: "single",
        required: false,
        options: [
          {
            id: "beef",
            label: "Beef Sausage",
            priceDelta: 0,
            default: true,
            ingredientIds: ["beef_sausage"],
            removeIngredientIds: ["cumberland_sausage", "vegan_sausage", "vegetarian_sausage"],
          },
          {
            id: "cumberland",
            label: "Cumberland Sausage",
            priceDelta: 0,
            ingredientIds: ["cumberland_sausage"],
            removeIngredientIds: ["beef_sausage", "vegan_sausage", "vegetarian_sausage"],
          },
          {
            id: "vegan",
            label: "Vegan Sausage",
            priceDelta: 0,
            ingredientIds: ["vegan_sausage"],
            removeIngredientIds: ["beef_sausage", "cumberland_sausage", "vegetarian_sausage"],
          },
          {
            id: "vegetarian",
            label: "Vegetarian Sausage",
            priceDelta: 0,
            ingredientIds: ["vegetarian_sausage"],
            removeIngredientIds: ["beef_sausage", "cumberland_sausage", "vegan_sausage"],
          },
        ],
      },
    ],
  }),
  "arrabiatta-prawns": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["spicy_tomato_sauce", "prawns"],
    lockedIngredientIds: ["prawns"],
    groups: [pastaShapeGroup],
  }),
  milanese: finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["breaded_chicken", "arrabiatta_sauce"],
    lockedIngredientIds: ["breaded_chicken"],
    groups: [pastaShapeGroup],
  }),
  "alfredo-chicken": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["chicken", "mushroom", "garlic_cream_sauce"],
    lockedIngredientIds: ["chicken"],
    groups: [pastaShapeGroup],
  }),
  ravioli: finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["spinach", "ricotta_ravioli"],
    lockedIngredientIds: ["ricotta_ravioli"],
    groups: [
      {
        id: "sauce",
        name: "Sauce",
        type: "single",
        required: true,
        options: [
          {
            id: "tomato",
            label: "Tomato",
            priceDelta: 0,
            default: true,
            ingredientIds: ["tomato_sauce"],
          },
          {
            id: "creamy",
            label: "Creamy",
            priceDelta: 0,
            ingredientIds: ["creamy_sauce"],
          },
        ],
      },
    ],
  }),
  "steak-wrap": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["tortilla_wrap", "sirloin", "tomato", "onion", "mustard_mayo", "lettuce"],
    lockedIngredientIds: ["tortilla_wrap", "sirloin"],
    groups: [burgerSideGroup],
  }),
  "chicken-wrap": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["tortilla_wrap", "chicken", "lettuce", "garlic_basil_mayo"],
    lockedIngredientIds: ["tortilla_wrap", "chicken"],
    groups: [burgerSideGroup],
  }),
  "halloumi-wrap": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["tortilla_wrap", "halloumi", "rocket", "spinach", "pepper", "sweet_chilli"],
    lockedIngredientIds: ["tortilla_wrap", "halloumi"],
    groups: [burgerSideGroup],
  }),
  "falafel-wrap": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    baseIngredientIds: ["tortilla_wrap", "falafel", "lettuce", "tomato", "gherkin", "jalapeno", "houmous"],
    lockedIngredientIds: ["tortilla_wrap", "falafel"],
    groups: [burgerSideGroup],
  }),
  "kids-pasta": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: true,
    groups: [
      {
        id: "sauce",
        name: "Sauce",
        type: "single",
        required: true,
        options: [
          {
            id: "tomato",
            label: "Tomato Sauce",
            priceDelta: 0,
            default: true,
            ingredientIds: ["tomato_sauce"],
          },
          {
            id: "plain",
            label: "Plain",
            priceDelta: 0,
            ingredientIds: ["plain_sauce"],
          },
        ],
      },
      pastaShapeGroup,
    ],
  }),
  latte: finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    baseIngredientIds: ["espresso_shot"],
    lockedIngredientIds: ["espresso_shot"],
    groups: [milkChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  cappuccino: finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    baseIngredientIds: ["espresso_shot"],
    lockedIngredientIds: ["espresso_shot"],
    groups: [milkChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "hot-chocolate": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    baseIngredientIds: ["hot_chocolate_powder"],
    lockedIngredientIds: ["hot_chocolate_powder"],
    groups: [milkChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "latte-hot-iced": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    baseIngredientIds: ["espresso_shot"],
    lockedIngredientIds: ["espresso_shot"],
    groups: [drinkTemperatureGroup, milkChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "matcha-latte-hot-iced": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    groups: [drinkTemperatureGroup, milkChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "chai-latte-hot-iced": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    groups: [drinkTemperatureGroup, milkChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "syrup-vanilla-caramel-hazelnut-coconut": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    groups: [syrupFlavorGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "alternative-milk-oat-almond-soya-coconut": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    groups: [alternativeMilkGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "whipping-cream-marshmallow": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    groups: [toppingChoiceGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
  "english-breakfast-gold-decaf-earl-grey": finalizeCustomization({
    editPolicy: "full",
    needsOwnerReview: false,
    groups: [teaBlendGroup],
    autoRemovalGroup: false,
    autoExtraGroup: false,
  }),
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
}

function unique(input: string[]): string[] {
  return Array.from(new Set(input))
}

function candidateIdsForLookup(rawId: string): string[] {
  const trimmed = rawId.trim()
  if (!trimmed) return []

  const candidates = [trimmed]
  const scopedSeparatorIndex = trimmed.lastIndexOf("::")
  if (scopedSeparatorIndex >= 0 && scopedSeparatorIndex + 2 < trimmed.length) {
    candidates.push(trimmed.slice(scopedSeparatorIndex + 2))
  }

  const withScopeStripped = candidates[candidates.length - 1]
  const skuSeparatorIndex = withScopeStripped.lastIndexOf("--")
  if (skuSeparatorIndex >= 0 && skuSeparatorIndex + 2 < withScopeStripped.length) {
    candidates.push(withScopeStripped.slice(skuSeparatorIndex + 2))
  }

  return unique(candidates)
}

function slugifyLookupName(rawName: string): string {
  return rawName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeIngredientIds(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  return unique(
    input
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim())
      .filter(value => value.length > 0)
      .filter(value => Boolean(ingredientCatalog[value]))
  )
}

function normalizeAllergens(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  return unique(
    input
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b))
}

function normalizePriceDelta(input: unknown): number {
  const parsed =
    typeof input === "number" && Number.isFinite(input)
      ? input
      : 0
  const applied =
    EDIT_PRICE_STRATEGY === "zero" ? 0 : parsed
  return Number(applied.toFixed(2))
}

function ingredientLabel(ingredientId: string): string {
  return ingredientCatalog[ingredientId]?.label ?? ingredientId
}

function ingredientAllergens(ingredientId: string): string[] {
  const entry = ingredientCatalog[ingredientId]
  if (!entry) return []
  return entry.allergens
}

function normalizeDescriptionToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\d+oz\s+/i, "")
    .replace(/^two\s+/i, "")
    .replace(/^free-range\s+/i, "")
    .replace(/^boneless\s+/i, "")
    .replace(/^grilled\s+/i, "")
    .replace(/^toasted\s+/i, "")
    .replace(/^roasted\s+/i, "")
    .replace(/^melted\s+/i, "")
    .replace(/^scrambled\s+/i, "")
    .replace(/\bslices of\b/g, "")
    .replace(/\bextra\s*\+?\d+\s*gbp\b/g, "")
    .replace(/\beach\b/g, "")
    .replace(/\bon the side\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseDescriptionIngredientIds(description: string): string[] {
  const tokens = description
    .replace(/\./g, ",")
    .replace(/\bserved with\b/gi, ",")
    .replace(/\bserved on\b/gi, ",")
    .replace(/\bwith\b/gi, ",")
    .replace(/\ba choice of\b/gi, ",")
    .replace(/\bchoice of\b/gi, ",")
    .replace(/\bin\b/gi, ",")
    .replace(/\bon\b/gi, ",")
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map(normalizeDescriptionToken)
    .filter(Boolean)

  const ingredientIds: string[] = []
  for (const token of tokens) {
    if (token === "fillings") continue
    const mapped = descriptionPhraseMap[token]
    if (!mapped) continue
    ingredientIds.push(...mapped)
  }

  return normalizeIngredientIds(ingredientIds)
}

function buildRemovalGroup(
  baseIngredientIds: string[],
  lockedIngredientIds: string[]
): MenuModifierGroup | null {
  const lockedSet = new Set(lockedIngredientIds)
  const removable = baseIngredientIds.filter(
    ingredientId => !lockedSet.has(ingredientId)
  )

  if (removable.length === 0) return null

  return {
    id: "remove_ingredients",
    name: "Remove ingredients",
    type: "multi",
    min: 0,
    max: removable.length,
    options: removable.map(ingredientId => ({
      id: `remove_${ingredientId}`,
      label: `No ${ingredientLabel(ingredientId)}`,
      priceDelta: normalizePriceDelta(0),
      removeIngredientIds: [ingredientId],
    })),
  }
}

function buildExtraIngredientsGroup(
  baseIngredientIds: string[],
  lockedIngredientIds: string[]
): MenuModifierGroup | null {
  const lockedSet = new Set(lockedIngredientIds)
  const removable = baseIngredientIds.filter(
    ingredientId => !lockedSet.has(ingredientId)
  )

  if (removable.length === 0) return null

  return {
    id: "extra_ingredients",
    name: "Add extras",
    type: "multi",
    min: 0,
    max: removable.length,
    options: removable.map(ingredientId => ({
      id: `extra_${ingredientId}`,
      label: `Extra ${ingredientLabel(ingredientId)}`,
      priceDelta: normalizePriceDelta(0.50),
      ingredientIds: [ingredientId],
    })),
  }
}

function finalizeCustomization(
  definition: CustomizationDefinition,
  defaults?: { needsOwnerReview?: boolean }
): MenuCustomization {
  const baseIngredientIds = normalizeIngredientIds(
    definition.baseIngredientIds ?? []
  )

  const lockedIngredientIds = normalizeIngredientIds(
    definition.lockedIngredientIds ?? []
  ).filter(ingredientId => baseIngredientIds.includes(ingredientId))

  const groups: MenuModifierGroup[] = Array.isArray(definition.groups)
    ? definition.groups.map(group => ({
        ...group,
        options: group.options.map(option => ({
          ...option,
          priceDelta: normalizePriceDelta(option.priceDelta),
          ingredientIds: normalizeIngredientIds(option.ingredientIds ?? []),
          removeIngredientIds: normalizeIngredientIds(
            option.removeIngredientIds ?? []
          ),
          allergens: normalizeAllergens(option.allergens ?? []),
        })),
      }))
    : []

  const editPolicy =
    definition.editPolicy ??
    (groups.length > 0 || baseIngredientIds.length > 0 ? "simple" : "none")

  const autoRemovalGroup = definition.autoRemovalGroup !== false
  if (
    autoRemovalGroup &&
    editPolicy !== "none" &&
    !groups.some(group => group.id === "remove_ingredients")
  ) {
    const removalGroup = buildRemovalGroup(
      baseIngredientIds,
      lockedIngredientIds
    )
    if (removalGroup) {
      groups.push(removalGroup)
    }
  }

  const autoExtraGroup = definition.autoExtraGroup !== false
  if (
    autoExtraGroup &&
    editPolicy !== "none" &&
    !groups.some(group => group.id === "extra_ingredients")
  ) {
    const extraGroup = buildExtraIngredientsGroup(
      baseIngredientIds,
      lockedIngredientIds
    )
    if (extraGroup) {
      groups.push(extraGroup)
    }
  }

  return {
    editPolicy,
    needsOwnerReview:
      definition.needsOwnerReview ?? defaults?.needsOwnerReview ?? false,
    baseIngredientIds,
    lockedIngredientIds,
    groups,
  }
}

function buildInferredCustomization(
  context: MenuItemCustomizationContext
): MenuCustomization | null {
  const override = candidateIdsForLookup(context.id)
    .map(candidateId => itemIngredientOverrides[candidateId])
    .find(value => Boolean(value))
  const baseIngredientIds = override
    ? normalizeIngredientIds(override.baseIngredientIds)
    : parseDescriptionIngredientIds(context.description ?? "")

  if (baseIngredientIds.length === 0) {
    return null
  }

  const lockedIngredientIds = override?.lockedIngredientIds
    ? normalizeIngredientIds(override.lockedIngredientIds)
    : baseIngredientIds.filter(ingredientId => coreIngredientIds.has(ingredientId))

  return finalizeCustomization(
    {
      editPolicy: "simple",
      needsOwnerReview: true,
      baseIngredientIds,
      lockedIngredientIds,
      groups: [],
    },
    { needsOwnerReview: true }
  )
}

function groupMin(group: MenuModifierGroup): number {
  if (typeof group.min === "number" && group.min >= 0) {
    return group.min
  }
  return group.required ? 1 : 0
}

function groupMax(group: MenuModifierGroup): number {
  if (typeof group.max === "number" && group.max > 0) {
    return group.max
  }
  if (group.type === "single") return 1
  return group.options.length
}

function normalizeGroupSelection(
  group: MenuModifierGroup,
  rawValue: unknown
): string[] {
  const available = new Set(group.options.map(option => option.id))
  const rawIds = Array.isArray(rawValue)
    ? rawValue
    : rawValue === undefined || rawValue === null
      ? []
      : [rawValue]

  let selected = unique(
    rawIds.filter(
      (id): id is string =>
        typeof id === "string" && available.has(id)
    )
  )

  if (group.type === "single" && selected.length > 1) {
    selected = selected.slice(0, 1)
  }

  const max = groupMax(group)
  if (selected.length > max) {
    selected = selected.slice(0, max)
  }

  const min = groupMin(group)
  if (selected.length < min) {
    const preferred = [
      ...group.options
        .filter(option => option.default)
        .map(option => option.id),
      ...group.options.map(option => option.id),
    ]

    for (const optionId of preferred) {
      if (selected.includes(optionId)) continue
      selected.push(optionId)
      if (selected.length >= min || selected.length >= max) {
        break
      }
    }
  }

  if (group.type === "single" && selected.length > 1) {
    return selected.slice(0, 1)
  }

  return selected
}

function selectedOptions(
  customization: MenuCustomization,
  selections: ModifierSelections
): MenuModifierOption[] {
  const options: MenuModifierOption[] = []

  for (const group of customization.groups) {
    const selected = selections[group.id] ?? []
    for (const optionId of selected) {
      const option = group.options.find(value => value.id === optionId)
      if (!option) continue
      options.push(option)
    }
  }

  return options
}

function resolveSelectedIngredientIdsInternal(
  customization: MenuCustomization,
  selections: ModifierSelections
): string[] {
  const base = normalizeIngredientIds(customization.baseIngredientIds ?? [])
  const selected = selectedOptions(customization, selections)

  const removed = new Set<string>()
  for (const option of selected) {
    for (const ingredientId of option.removeIngredientIds ?? []) {
      removed.add(ingredientId)
    }
  }

  const ordered: string[] = []
  const seen = new Set<string>()

  for (const ingredientId of base) {
    if (removed.has(ingredientId)) continue
    if (seen.has(ingredientId)) continue
    seen.add(ingredientId)
    ordered.push(ingredientId)
  }

  for (const option of selected) {
    for (const ingredientId of option.ingredientIds ?? []) {
      if (seen.has(ingredientId)) continue
      seen.add(ingredientId)
      ordered.push(ingredientId)
    }
  }

  return ordered
}

export function resolveEditPolicy(
  customization: MenuCustomization | null | undefined
): MenuEditPolicy {
  if (!customization) return "none"
  if (customization.editPolicy) return customization.editPolicy
  if (customization.groups.length > 0) return "full"
  if ((customization.baseIngredientIds ?? []).length > 0) return "simple"
  return "none"
}

export function hasCustomization(
  customization: MenuCustomization | null | undefined
): customization is MenuCustomization {
  return Boolean(
    customization &&
      Array.isArray(customization.groups) &&
      customization.groups.length > 0
  )
}

export function getMenuItemCustomization(
  item: string | MenuItemCustomizationContext
): MenuCustomization | null {
  const context: MenuItemCustomizationContext =
    typeof item === "string"
      ? { id: item }
      : item

  const lookupCandidates = [
    ...candidateIdsForLookup(context.id),
    ...(typeof context.name === "string" && context.name.trim().length > 0
      ? [slugifyLookupName(context.name)]
      : []),
  ]

  for (const candidateId of unique(lookupCandidates)) {
    const explicit = explicitCustomizationByItemId[candidateId]
    if (explicit) {
      return explicit
    }
  }

  return buildInferredCustomization(context)
}

export function getBaseIngredientLabels(
  customization: MenuCustomization | null | undefined
): string[] {
  if (!customization) return []

  return normalizeIngredientIds(customization.baseIngredientIds ?? []).map(
    ingredientId => ingredientLabel(ingredientId)
  )
}

export function getSelectedIngredientLabels(
  customization: MenuCustomization | null | undefined,
  selections: ModifierSelections
): string[] {
  if (!customization) return []

  const normalized = normalizeModifierSelections(customization, selections)
  return resolveSelectedIngredientIdsInternal(customization, normalized).map(
    ingredientId => ingredientLabel(ingredientId)
  )
}

export function defaultModifierSelections(
  customization: MenuCustomization | null | undefined
): ModifierSelections {
  if (!hasCustomization(customization)) return {}

  const next: ModifierSelections = {}
  for (const group of customization.groups) {
    next[group.id] = normalizeGroupSelection(group, undefined)
  }
  return next
}

export function normalizeModifierSelections(
  customization: MenuCustomization | null | undefined,
  input: unknown
): ModifierSelections {
  if (!hasCustomization(customization)) return {}
  const source = isObject(input) ? input : {}

  const next: ModifierSelections = {}
  for (const group of customization.groups) {
    next[group.id] = normalizeGroupSelection(group, source[group.id])
  }

  return next
}

export function validateModifierSelections(
  customization: MenuCustomization | null | undefined,
  input: unknown
): ValidationResult {
  const normalized = normalizeModifierSelections(customization, input)

  if (!hasCustomization(customization)) {
    return {
      ok: true,
      normalized,
    }
  }

  for (const group of customization.groups) {
    const selected = normalized[group.id] ?? []
    const min = groupMin(group)
    const max = groupMax(group)

    if (group.type === "single" && selected.length > 1) {
      return {
        ok: false,
        error: `${group.name}: choose one option`,
        normalized,
      }
    }

    if (selected.length < min) {
      return {
        ok: false,
        error: `${group.name}: make a selection`,
        normalized,
      }
    }

    if (selected.length > max) {
      return {
        ok: false,
        error: `${group.name}: too many selections`,
        normalized,
      }
    }
  }

  return {
    ok: true,
    normalized,
  }
}

export function calculateModifierDelta(
  customization: MenuCustomization | null | undefined,
  selections: ModifierSelections
): number {
  if (!hasCustomization(customization)) return 0

  let delta = 0
  for (const group of customization.groups) {
    const selected = selections[group.id] ?? []
    for (const optionId of selected) {
      const option = group.options.find(value => value.id === optionId)
      if (!option) continue
      delta += Number(option.priceDelta ?? 0)
    }
  }
  return Number(delta.toFixed(2))
}

export function buildModifierSummary(
  customization: MenuCustomization | null | undefined,
  selections: ModifierSelections
): string[] {
  if (!hasCustomization(customization)) return []

  const lines: string[] = []
  for (const group of customization.groups) {
    const selected = selections[group.id] ?? []
    if (selected.length === 0) continue
    const labels = selected
      .map(optionId =>
        group.options.find(option => option.id === optionId)
      )
      .filter((option): option is MenuModifierOption => Boolean(option))
      .map(option => option.label)

    if (labels.length === 0) continue
    lines.push(`${group.name}: ${labels.join(", ")}`)
  }

  return lines
}

export function collectModifierAllergens(
  customization: MenuCustomization | null | undefined,
  selections: ModifierSelections,
  fallbackBaseAllergens: string[] = []
): string[] {
  const allergens = new Set<string>(
    normalizeAllergens(fallbackBaseAllergens)
  )

  if (!customization) {
    return Array.from(allergens).sort((a, b) => a.localeCompare(b))
  }

  const normalized = normalizeModifierSelections(customization, selections)

  const effectiveIngredientIds = resolveSelectedIngredientIdsInternal(
    customization,
    normalized
  )

  for (const ingredientId of effectiveIngredientIds) {
    for (const allergen of ingredientAllergens(ingredientId)) {
      allergens.add(allergen)
    }
  }

  for (const option of selectedOptions(customization, normalized)) {
    for (const allergen of normalizeAllergens(option.allergens ?? [])) {
      allergens.add(allergen)
    }
  }

  return Array.from(allergens).sort((a, b) => a.localeCompare(b))
}

export function buildModifierSignature(
  selections: ModifierSelections
): string {
  const groups = Object.keys(selections).sort()
  return groups
    .map(groupId => {
      const ids = [...(selections[groupId] ?? [])].sort()
      return `${groupId}:${ids.join(",")}`
    })
    .join("|")
}
