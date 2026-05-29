/**
 * @module database
 * @description SQLite database initialization for The Piquant Patisserie.
 * Uses better-sqlite3 for synchronous, zero-config embedded database.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'piquant.db');

let db = null;

/**
 * Initialize the SQLite database: create tables and seed default settings.
 * @returns {Database} The better-sqlite3 database instance.
 */
function initDatabase() {
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // --- Create Tables ---

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      bulk_qty INTEGER DEFAULT 0,
      bulk_price REAL DEFAULT 0,
      category_slug TEXT NOT NULL,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      customer_email TEXT,
      items_json TEXT,
      subtotal REAL,
      discount REAL,
      total REAL,
      stripe_session_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // --- Seed Default Settings (if table is empty) ---

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

    const defaults = {
      stripe_secret_key: '',
      stripe_publishable_key: '',
      smtp_host: 'smtp.gmail.com',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      smtp_from: 'hello@thepiquantpatisserie.com',
      truck_status: 'closed',
      truck_location: 'Kyle City Square Park',
      truck_message: 'Check back soon for our next pop-up!',
      truck_hours: ''
    };

    const insertMany = db.transaction(() => {
      for (const [key, value] of Object.entries(defaults)) {
        insertSetting.run(key, value);
      }
    });

    insertMany();
    console.log('[DB] Default settings seeded.');
  }

  console.log(`[DB] Database initialized at ${DB_PATH}`);
  return db;
}

/**
 * Get the active database instance.
 * @returns {Database} The better-sqlite3 database instance.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDb };
