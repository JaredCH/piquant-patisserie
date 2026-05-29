/**
 * @module seed
 * @description Idempotent seed script for The Piquant Patisserie database.
 * Populates categories and all 26 menu items from the original site scrape.
 * Safe to re-run — uses INSERT OR IGNORE on unique constraints.
 */

const { initDatabase, getDb } = require('./database');

// --- Image URLs per category (GoDaddy-hosted originals) ---
const IMAGES = {
  'cake-jars': 'https://img1.wsimg.com/isteam/ip/63aa9923-053a-46e4-a245-b21665b7cdd1/IMG_3229.JPG/:/rs=w:360,h:240,cg:true,m',
  'brownies': 'https://img1.wsimg.com/isteam/ip/63aa9923-053a-46e4-a245-b21665b7cdd1/IMG_3216.JPG/:/rs=w:360,h:240,cg:true,m',
  'macarons': 'https://img1.wsimg.com/isteam/ip/63aa9923-053a-46e4-a245-b21665b7cdd1/IMG_3185.JPG/:/rs=w:360,h:240,cg:true,m',
  'creme-brulee': 'https://img1.wsimg.com/isteam/ip/63aa9923-053a-46e4-a245-b21665b7cdd1/IMG_3208.JPG/:/rs=w:360,h:240,cg:true,m',
  'cookies': 'https://img1.wsimg.com/isteam/ip/63aa9923-053a-46e4-a245-b21665b7cdd1/IMG_3236.JPG/:/rs=w:360,h:240,cg:true,m'
};

// --- Category Definitions ---
const CATEGORIES = [
  { name: 'Cake Jars', slug: 'cake-jars', sort_order: 1 },
  { name: 'Petit Brownies', slug: 'brownies', sort_order: 2 },
  { name: 'Macarons', slug: 'macarons', sort_order: 3 },
  { name: 'Crème Brûlée', slug: 'creme-brulee', sort_order: 4 },
  { name: 'Artisan Cookies', slug: 'cookies', sort_order: 5 }
];

// --- All 26 Menu Items ---
const MENU_ITEMS = [
  // Cake Jars — $12 each, 4 for $40
  { name: 'Carotte & Crème', description: 'Layers of spiced carrot cake, smooth vanilla bean pastry cream, and brown butter cream cheese buttercream, finished with chopped nuts. Warm, balanced, and classically indulgent.', price: 12, bulk_qty: 4, bulk_price: 40, category_slug: 'cake-jars', sort_order: 1 },
  { name: 'Coco Suprême', description: 'Layers of moist coconut cake, vibrant pineapple compote, and smooth vanilla Swiss meringue buttercream, finished with toasted coconut flakes. Bright, creamy, and elegantly tropical.', price: 12, bulk_qty: 4, bulk_price: 40, category_slug: 'cake-jars', sort_order: 2 },
  { name: 'Fraise & Crème', description: 'Layers of soft strawberry cake, house-made strawberry compote, and cream cheese Swiss meringue buttercream, topped with delicate sugared strawberries. Fresh, creamy, and effortlessly elegant.', price: 12, bulk_qty: 4, bulk_price: 40, category_slug: 'cake-jars', sort_order: 3 },
  { name: 'Le Trio Chocolat', description: 'Layers of rich chocolate cake, silky milk chocolate ganache, and whipped vanilla bean white chocolate ganache, finished with delicate dark chocolate shavings. Decadent, balanced, and unmistakably French.', price: 12, bulk_qty: 4, bulk_price: 40, category_slug: 'cake-jars', sort_order: 4 },
  { name: 'Vanille & Fraise', description: 'Layers of delicate vanilla cake, bright strawberry compote, and whipped vanilla bean white chocolate ganache, finished with sugared strawberries. Light, refined, and beautifully balanced.', price: 12, bulk_qty: 4, bulk_price: 40, category_slug: 'cake-jars', sort_order: 5 },
  { name: 'Vanille Suprême', description: 'Layers of tender vanilla cake, smooth vanilla bean pastry cream, and airy vanilla Swiss meringue buttercream, finished with a touch of edible gold leaf. Pure, elegant, and luxuriously indulgent.', price: 12, bulk_qty: 4, bulk_price: 40, category_slug: 'cake-jars', sort_order: 6 },

  // Petit Brownies — $5 each, 4 for $15
  { name: 'Chocolat Blanc Blondie', description: 'A buttery blondie studded with smooth white chocolate, baked to a soft, chewy finish. Sweet, rich, and perfectly balanced.', price: 5, bulk_qty: 4, bulk_price: 15, category_slug: 'brownies', sort_order: 7 },
  { name: 'Citron Blondie', description: 'A soft, buttery blondie infused with bright lemon flavor, offering a light, refreshing contrast to its rich, tender crumb.', price: 5, bulk_qty: 4, bulk_price: 15, category_slug: 'brownies', sort_order: 8 },
  { name: 'Classique Brownie', description: 'A rich, fudgy chocolate brownie with a deep cocoa flavor and a perfectly soft center. Simple, timeless, and irresistibly indulgent.', price: 5, bulk_qty: 4, bulk_price: 15, category_slug: 'brownies', sort_order: 9 },
  { name: "S'mores Brownie", description: "A fudgy chocolate brownie topped with toasted marshmallow and graham crumble, capturing the classic s'mores flavor in a rich, bakery-style dessert.", price: 5, bulk_qty: 4, bulk_price: 15, category_slug: 'brownies', sort_order: 10 },
  { name: 'Trio Chocolat Brownie', description: 'A rich chocolate brownie topped with silky white and dark chocolate ganache, creating layers of deep cocoa and smooth sweetness in every bite. Decadent, balanced, and beautifully indulgent.', price: 5, bulk_qty: 4, bulk_price: 15, category_slug: 'brownies', sort_order: 11 },

  // Macarons — $4 each, 4 for $12
  { name: 'Vanille Macaron', description: 'Delicate, airy almond flour French shells filled with a luxurious vanilla bean white chocolate whipped ganache.', price: 4, bulk_qty: 4, bulk_price: 12, category_slug: 'macarons', sort_order: 12 },
  { name: 'Cookies & Crème Macaron', description: 'Delicate French shells folded with cookie crumbs and filled with a creamy cookies & crème buttercream.', price: 4, bulk_qty: 4, bulk_price: 12, category_slug: 'macarons', sort_order: 13 },
  { name: 'Chocolat Macaron', description: 'Classic dark chocolate shells paired with a rich, silky Valrhona dark chocolate ganache filling.', price: 4, bulk_qty: 4, bulk_price: 12, category_slug: 'macarons', sort_order: 14 },
  { name: 'Framboise Macaron', description: 'Bright pink almond flour shells filled with a vibrant, tangy house-made organic raspberry compote core.', price: 4, bulk_qty: 4, bulk_price: 12, category_slug: 'macarons', sort_order: 15 },

  // Crème Brûlée — $6.50 each, 4 for $20
  { name: 'Classique Crème Brûlée', description: 'Silky, premium vanilla bean custard base. Torched live at our truck with a brittle caramel sugar shell.', price: 6.5, bulk_qty: 4, bulk_price: 20, category_slug: 'creme-brulee', sort_order: 16 },
  { name: 'Citron Crème Brûlée', description: 'Velvety pastry custard infused with zesty lemon oils. Torched live to form a crisp, amber caramel crust.', price: 6.5, bulk_qty: 4, bulk_price: 20, category_slug: 'creme-brulee', sort_order: 17 },
  { name: 'Fraise Crème Brûlée', description: 'Rich custard infused with sweet strawberry essence, layered with organic berry compote and a torched sugar top.', price: 6.5, bulk_qty: 4, bulk_price: 20, category_slug: 'creme-brulee', sort_order: 18 },

  // Artisan Cookies — $3 each, 12 for $25
  { name: 'Beurre & Pacane', description: 'A tender butter cookie folded with toasted pecans for a warm, nutty flavor and delicate, satisfying crunch.', price: 3, bulk_qty: 12, bulk_price: 25, category_slug: 'cookies', sort_order: 19 },
  { name: 'Chocolat Blanc & Macadamia', description: 'A buttery cookie studded with creamy white chocolate and roasted macadamia nuts. Smooth, sweet, and balanced.', price: 3, bulk_qty: 12, bulk_price: 25, category_slug: 'cookies', sort_order: 20 },
  { name: 'Chocolat Chip', description: 'A soft, buttery cookie loaded with rich chocolate chips and baked to a golden finish. Classic, comforting, and timeless.', price: 3, bulk_qty: 12, bulk_price: 25, category_slug: 'cookies', sort_order: 21 },
  { name: 'Double Chocolat', description: 'A rich chocolate cookie packed with generous chocolate chunks for deep, intense cocoa flavor in every bite.', price: 3, bulk_qty: 12, bulk_price: 25, category_slug: 'cookies', sort_order: 22 },
  { name: 'Peanut Beurre', description: 'A classic peanut butter cookie with a soft center and rich, nutty depth. Simple and irresistibly satisfying.', price: 3, bulk_qty: 12, bulk_price: 25, category_slug: 'cookies', sort_order: 23 },
  { name: 'Snickerdoodle', description: 'A soft cinnamon-sugar cookie with a light tang and pillowy center. Cozy, nostalgic, and perfectly spiced.', price: 3, bulk_qty: 12, bulk_price: 25, category_slug: 'cookies', sort_order: 24 }
];

function seed() {
  const db = initDatabase();

  console.log('\n=== The Piquant Patisserie — Database Seed ===\n');

  // --- Seed Categories ---
  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, slug, sort_order) VALUES (@name, @slug, @sort_order)'
  );

  let categoriesAdded = 0;
  const seedCategories = db.transaction(() => {
    for (const cat of CATEGORIES) {
      const result = insertCategory.run(cat);
      if (result.changes > 0) categoriesAdded++;
    }
  });
  seedCategories();
  console.log(`[Seed] Categories: ${categoriesAdded} added (${CATEGORIES.length - categoriesAdded} already existed).`);

  // --- Seed Menu Items ---
  const existingItems = db.prepare('SELECT name FROM menu_items').all().map(r => r.name);
  const insertItem = db.prepare(`
    INSERT INTO menu_items (name, description, price, bulk_qty, bulk_price, category_slug, image_url, sort_order, is_active)
    VALUES (@name, @description, @price, @bulk_qty, @bulk_price, @category_slug, @image_url, @sort_order, 1)
  `);

  let itemsAdded = 0;
  const seedItems = db.transaction(() => {
    for (const item of MENU_ITEMS) {
      if (existingItems.includes(item.name)) continue;

      insertItem.run({
        ...item,
        image_url: IMAGES[item.category_slug] || ''
      });
      itemsAdded++;
    }
  });
  seedItems();
  console.log(`[Seed] Menu Items: ${itemsAdded} added (${MENU_ITEMS.length - itemsAdded} already existed).`);

  // --- Summary ---
  const totalItems = db.prepare('SELECT COUNT(*) as count FROM menu_items').get().count;
  const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  const totalSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;

  console.log(`\n[Seed] Database Summary:`);
  console.log(`  Categories: ${totalCategories}`);
  console.log(`  Menu Items: ${totalItems}`);
  console.log(`  Settings:   ${totalSettings}`);
  console.log(`\n=== Seed Complete ===\n`);
}

// Run if called directly
seed();
