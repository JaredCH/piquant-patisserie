/**
 * @module server
 * @description Full Express server for The Piquant Patisserie V2.
 * Provides public API (menu, truck status, contact, checkout) and
 * admin API (CRUD menu, settings, orders, truck management).
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { initDatabase, getDb } = require('./db/database');
const { requireAdmin } = require('./middleware/auth');

// --- Initialize Database ---
initDatabase();
const db = getDb();

// --- Express App Setup ---
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Session Middleware ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// --- Multer Setup for Image Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `item-${Date.now()}-${Math.round(Math.random() * 1000)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed.'));
  }
});

// --- Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
//  HELPER: Get a setting value from the database
// ==========================================================================

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const row of rows) {
    obj[row.key] = row.value;
  }
  return obj;
}

// ==========================================================================
//  PUBLIC API ROUTES
// ==========================================================================

/**
 * GET /api/menu — Returns all active menu items and categories.
 */
app.get('/api/menu', (req, res) => {
  try {
    const items = db.prepare(
      'SELECT * FROM menu_items WHERE is_active = 1 ORDER BY sort_order ASC'
    ).all();

    const categories = db.prepare(
      'SELECT * FROM categories ORDER BY sort_order ASC'
    ).all();

    res.json({ items, categories });
  } catch (err) {
    console.error('[API] Error fetching menu:', err.message);
    res.status(500).json({ error: 'Failed to load menu.' });
  }
});

/**
 * GET /api/truck-status — Returns current truck tracker status.
 */
app.get('/api/truck-status', (req, res) => {
  try {
    res.json({
      status: getSetting('truck_status'),
      location: getSetting('truck_location'),
      message: getSetting('truck_message'),
      hours: getSetting('truck_hours')
    });
  } catch (err) {
    console.error('[API] Error fetching truck status:', err.message);
    res.status(500).json({ error: 'Failed to load truck status.' });
  }
});

/**
 * GET /api/settings/public — Returns only public-safe settings (Stripe publishable key).
 */
app.get('/api/settings/public', (req, res) => {
  res.json({
    stripePublishableKey: getSetting('stripe_publishable_key')
  });
});

/**
 * POST /api/contact — Handle contact form submission.
 * Sends email via SMTP if configured, otherwise mock mode.
 */
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, enquiry, message, eventDate, guests } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    const smtpUser = getSetting('smtp_user');
    const smtpPass = getSetting('smtp_pass');
    const smtpHost = getSetting('smtp_host');
    const smtpPort = getSetting('smtp_port');
    const smtpFrom = getSetting('smtp_from');

    // Only send real email if SMTP is fully configured
    if (smtpUser && smtpPass && smtpHost) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort) || 587,
        secure: parseInt(smtpPort) === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });

      const htmlBody = `
        <h2>New Contact Inquiry — The Piquant Patisserie</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Type:</strong> ${enquiry || 'General'}</p>
        ${eventDate ? `<p><strong>Event Date:</strong> ${eventDate}</p>` : ''}
        ${guests ? `<p><strong>Expected Guests:</strong> ${guests}</p>` : ''}
        <hr>
        <p>${message}</p>
      `;

      await transporter.sendMail({
        from: smtpFrom,
        to: smtpFrom,
        replyTo: email,
        subject: `[Piquant Patisserie] New ${enquiry || 'General'} Inquiry from ${name}`,
        html: htmlBody
      });

      console.log(`[Email] Contact form email sent from ${email}`);
    } else {
      console.log(`[Email] SMTP not configured — mock mode. Contact from: ${name} <${email}>`);
    }

    res.json({ success: true, message: 'Your message has been received.' });
  } catch (err) {
    console.error('[API] Contact form error:', err.message);
    res.json({ success: true, message: 'Your message has been received (email delivery pending).' });
  }
});

/**
 * POST /api/checkout — Create Stripe Checkout Session or return mock URL.
 */
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customer } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const stripeSecretKey = getSetting('stripe_secret_key');

    // If Stripe is configured with a real key
    if (stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
      const stripe = require('stripe')(stripeSecretKey);

      // Build line items for Stripe
      const lineItems = items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100)
        },
        quantity: item.qty
      }));

      const sessionObj = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/#menu-section`,
        customer_email: customer?.email || undefined
      });

      // Store order in database
      const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
      db.prepare(`
        INSERT INTO orders (customer_name, customer_email, items_json, subtotal, discount, total, stripe_session_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        customer?.name || '',
        customer?.email || '',
        JSON.stringify(items),
        subtotal,
        0,
        subtotal,
        sessionObj.id
      );

      return res.json({ url: sessionObj.url });
    }

    // Mock mode — no Stripe configured
    console.log('[Checkout] Stripe not configured — returning mock checkout.');

    // Store mock order
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    db.prepare(`
      INSERT INTO orders (customer_name, customer_email, items_json, subtotal, discount, total, stripe_session_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'mock')
    `).run(
      customer?.name || 'Mock Customer',
      customer?.email || '',
      JSON.stringify(items),
      subtotal,
      0,
      subtotal,
      'mock_' + Date.now()
    );

    res.json({ url: '/checkout/success?mock=true' });
  } catch (err) {
    console.error('[API] Checkout error:', err.message);
    res.status(500).json({ error: 'Checkout failed. ' + err.message });
  }
});

// ==========================================================================
//  ADMIN API ROUTES
// ==========================================================================

/**
 * POST /api/admin/login — Authenticate admin with env credentials.
 * NOT protected by requireAdmin (obviously).
 */
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'changeme';

    if (username === adminUser && password === adminPass) {
      req.session.isAdmin = true;
      return res.json({ success: true });
    }

    // Also support bcrypt-hashed password in env
    if (username === adminUser && adminPass.startsWith('$2')) {
      if (bcrypt.compareSync(password, adminPass)) {
        req.session.isAdmin = true;
        return res.json({ success: true });
      }
    }

    res.status(401).json({ error: 'Invalid credentials.' });
  } catch (err) {
    console.error('[API] Login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * GET /api/admin/session — Check if current session is authenticated.
 * NOT protected by requireAdmin.
 */
app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

/**
 * POST /api/admin/logout — Destroy admin session.
 * NOT protected by requireAdmin (idempotent).
 */
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[API] Logout session destroy error:', err.message);
    res.json({ success: true });
  });
});

// --- All routes below require admin authentication ---

/**
 * GET /api/admin/menu — Returns ALL menu items (including inactive).
 */
app.get('/api/admin/menu', requireAdmin, (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM menu_items ORDER BY sort_order ASC').all();
    res.json({ items });
  } catch (err) {
    console.error('[API] Admin menu fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load menu items.' });
  }
});

/**
 * POST /api/admin/menu — Create a new menu item.
 */
app.post('/api/admin/menu', requireAdmin, (req, res) => {
  try {
    const { name, description, price, bulk_qty, bulk_price, category_slug, image_url } = req.body;

    if (!name || !price || !category_slug) {
      return res.status(400).json({ error: 'Name, price, and category are required.' });
    }

    const maxSort = db.prepare('SELECT MAX(sort_order) as max FROM menu_items').get();
    const nextSort = (maxSort.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO menu_items (name, description, price, bulk_qty, bulk_price, category_slug, image_url, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(name, description || '', price, bulk_qty || 0, bulk_price || 0, category_slug, image_url || '', nextSort);

    const newItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid);
    res.json(newItem);
  } catch (err) {
    console.error('[API] Admin menu create error:', err.message);
    res.status(500).json({ error: 'Failed to create menu item.' });
  }
});

/**
 * PUT /api/admin/menu/:id — Update a menu item (partial updates supported).
 */
app.put('/api/admin/menu/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    const fields = ['name', 'description', 'price', 'bulk_qty', 'bulk_price', 'category_slug', 'image_url', 'sort_order', 'is_active'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('[API] Admin menu update error:', err.message);
    res.status(500).json({ error: 'Failed to update menu item.' });
  }
});

/**
 * DELETE /api/admin/menu/:id — Hard delete a menu item.
 */
app.delete('/api/admin/menu/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[API] Admin menu delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete menu item.' });
  }
});

/**
 * POST /api/admin/menu/:id/image — Upload image for a menu item.
 */
app.post('/api/admin/menu/:id/image', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare("UPDATE menu_items SET image_url = ?, updated_at = datetime('now') WHERE id = ?").run(imageUrl, id);

    res.json({ image_url: imageUrl });
  } catch (err) {
    console.error('[API] Image upload error:', err.message);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

/**
 * GET /api/admin/settings — Returns all settings as key-value object.
 */
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    res.json(getAllSettings());
  } catch (err) {
    console.error('[API] Settings fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

/**
 * PUT /api/admin/settings — Upsert settings key-value pairs.
 */
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );

    const updateMany = db.transaction((pairs) => {
      for (const [key, value] of Object.entries(pairs)) {
        upsert.run(key, String(value));
      }
    });

    updateMany(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Settings update error:', err.message);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

/**
 * POST /api/admin/settings/test-email — Send a test email using current SMTP settings.
 */
app.post('/api/admin/settings/test-email', requireAdmin, async (req, res) => {
  try {
    const settings = getAllSettings();
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from } = settings;

    if (!smtp_user || !smtp_pass || !smtp_host) {
      return res.status(400).json({ error: 'SMTP settings are incomplete. Fill in host, user, and password.' });
    }

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port) || 587,
      secure: parseInt(smtp_port) === 465,
      auth: { user: smtp_user, pass: smtp_pass }
    });

    await transporter.sendMail({
      from: smtp_from || smtp_user,
      to: smtp_user,
      subject: '[Piquant Patisserie] Test Email — Settings Verified',
      html: '<h2>SMTP Configuration Test</h2><p>If you received this email, your SMTP settings are working correctly.</p><p>— The Piquant Patisserie Admin Panel</p>'
    });

    res.json({ success: true, message: 'Test email sent successfully.' });
  } catch (err) {
    console.error('[API] Test email error:', err.message);
    res.status(500).json({ error: 'Failed to send test email: ' + err.message });
  }
});

/**
 * PUT /api/admin/truck — Update truck tracker settings.
 */
app.put('/api/admin/truck', requireAdmin, (req, res) => {
  try {
    const { status, location, message, hours } = req.body;
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );

    const update = db.transaction(() => {
      if (status !== undefined) upsert.run('truck_status', status);
      if (location !== undefined) upsert.run('truck_location', location);
      if (message !== undefined) upsert.run('truck_message', message);
      if (hours !== undefined) upsert.run('truck_hours', hours);
    });

    update();
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Truck update error:', err.message);
    res.status(500).json({ error: 'Failed to update truck status.' });
  }
});

/**
 * GET /api/admin/orders — Returns all orders, most recent first.
 */
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json({ orders });
  } catch (err) {
    console.error('[API] Orders fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

// ==========================================================================
//  PAGE ROUTES
// ==========================================================================

/** Serve admin panel */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/** Serve checkout success page (falls through to index.html) */
app.get('/checkout/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/** Catchall — serve public site */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================================================
//  START SERVER
// ==========================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`  The Piquant Patisserie V2 Server`);
  console.log(`  Running locally at: http://localhost:${PORT}`);
  console.log(`  Admin panel:        http://localhost:${PORT}/admin`);
  console.log(`  Environment:        ${process.env.NODE_ENV || 'development'}`);
  console.log(`==================================================\n`);
});
