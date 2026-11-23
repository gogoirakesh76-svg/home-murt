import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  ADMIN_COOKIE_NAME,
  CUSTOMER_COOKIE_NAME,
  clearSessionCookie,
  getAuthenticatedSession,
  hashPassword,
  parseCookies,
  requireAdmin,
  setSessionCookie,
  signSessionToken,
  timingSafeStringMatch,
  verifyCsrfForCookieMutation,
  verifyPassword,
} from './server/auth';
import {
  db,
  mapOfferRow,
  mapOrderRow,
  mapPaymentSettingsRow,
  mapProductRow,
  mapReturnAddressRow,
  mapReturnRequestRow,
} from './server/db';
import {
  computeCartTotals,
  isSafeImageUrl,
  ORDER_STAGES,
  type Offer,
  type OrderItemSnapshot,
  type OrderStatus,
  type PaymentStatus,
  type ReturnStatus,
} from './src/shared/commerce';

const PORT = Number(process.env.PORT) || 3000;
const GUEST_COOKIE_NAME = 'hm_guest_key';

function getOrSetGuestKey(req: Request, res: Response): string {
  const cookies = parseCookies(req);
  const existing = cookies[GUEST_COOKIE_NAME];
  if (existing && /^[a-f0-9]{16,64}$/.test(existing)) {
    return existing;
  }
  const key = crypto.randomBytes(16).toString('hex');
  setSessionCookie(req, res, GUEST_COOKIE_NAME, key);
  return key;
}

function getWishlistOwnerKey(req: Request, res: Response): string {
  const customer = getAuthenticatedSession(req, 'customer');
  if (customer) {
    return `user:${customer.sub}`;
  }
  const guest = getOrSetGuestKey(req, res);
  return `guest:${guest}`;
}

function isAdminEnvConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
}

function isAdminInitialized(): boolean {
  if (isAdminEnvConfigured()) return true;
  const row = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };
  return row.count > 0;
}

function buildDefaultQrSvg(upiId: string, merchantName: string): string {
  const safeUpi = upiId.replace(/[^a-zA-Z0-9@._-]/g, '');
  const safeMerchant = merchantName.replace(/[<>&"']/g, '');
  // Deterministic geometric QR matrix pattern for visual placeholder until Admin uploads custom QR
  const cells: string[] = [];
  const size = 21;
  const seedStr = `${safeUpi}|${safeMerchant}`;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) {
        const localR = r >= size - 7 ? r - (size - 7) : r;
        const localC = c >= size - 7 ? c - (size - 7) : c;
        const border = localR === 0 || localR === 6 || localC === 0 || localC === 6;
        const center = localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4;
        if (border || center) {
          cells.push(`<rect x="${20 + c * 8}" y="${20 + r * 8}" width="8" height="8" fill="#0F172A"/>`);
        }
      } else {
        const v = Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0;
        if (v % 2 === 0) {
          cells.push(`<rect x="${20 + c * 8}" y="${20 + r * 8}" width="8" height="8" fill="#0F172A"/>`);
        }
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 208 232" width="208" height="232">
  <rect width="208" height="232" rx="12" fill="#FFFFFF"/>
  <rect x="8" y="8" width="192" height="192" rx="8" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
  ${cells.join('\n  ')}
  <text x="104" y="218" text-anchor="middle" font-family="monospace" font-size="10" fill="#475569">${safeUpi || 'homemurt@upi'}</text>
</svg>`;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/default-qr.svg', (_req: Request, res: Response) => {
    const row = db.prepare('SELECT upi_id, merchant_name FROM payment_settings WHERE id = 1').get() as
      | { upi_id: string; merchant_name: string }
      | undefined;
    const svg = buildDefaultQrSvg(row?.upi_id || 'homemurt@upi', row?.merchant_name || 'HOME MURT Retail');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store');
    res.send(svg);
  });

  // --- AUTH & ADMIN STATUS ---
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const customer = getAuthenticatedSession(req, 'customer');
    const admin = getAuthenticatedSession(req, 'admin');
    res.json({
      customer: customer ? { id: customer.sub, email: customer.email, name: customer.name, role: 'customer' } : null,
      admin: admin ? { id: admin.sub, email: admin.email, name: admin.name, role: 'admin' } : null,
      adminInitialized: isAdminInitialized(),
      suggestedAdminEmail: process.env.ADMIN_EMAIL || 'rakeshgogoi9988@gmail.com',
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { name, email, phone, password } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanPass = typeof password === 'string' ? password : '';

    if (cleanName.length < 2 || !cleanEmail.includes('@') || cleanPass.length < 6) {
      res.status(400).json({ error: 'Provide a valid name, email, and password (min 6 characters).' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const hash = hashPassword(cleanPass);
    const now = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO users (email, name, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(cleanEmail, cleanName, cleanPhone, hash, now);
    const userId = Number(info.lastInsertRowid);

    const token = signSessionToken({ sub: userId, email: cleanEmail, name: cleanName, role: 'customer' });
    setSessionCookie(req, res, CUSTOMER_COOKIE_NAME, token);
    res.status(201).json({
      token,
      user: { id: userId, email: cleanEmail, name: cleanName, phone: cleanPhone, role: 'customer' },
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPass = typeof password === 'string' ? password : '';

    if (!cleanEmail || !cleanPass) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as
      | { id: number; email: string; name: string; phone: string; password_hash: string }
      | undefined;
    if (!user || !verifyPassword(cleanPass, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signSessionToken({ sub: user.id, email: user.email, name: user.name, role: 'customer' });
    setSessionCookie(req, res, CUSTOMER_COOKIE_NAME, token);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: 'customer' },
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    clearSessionCookie(req, res, CUSTOMER_COOKIE_NAME);
    res.json({ ok: true });
  });

  // One-time atomic Admin account claim (when ADMIN_PASSWORD env var is not configured and no admin exists yet)
  app.post('/api/admin/claim', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isAdminEnvConfigured()) {
      res.status(403).json({ error: 'Admin account is managed via environment configuration.' });
      return;
    }

    const { email, name, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' && name.trim().length >= 2 ? name.trim() : 'Rakesh Gogoi';
    const cleanPass = typeof password === 'string' ? password : '';

    if (!cleanEmail.includes('@') || cleanPass.length < 6) {
      res.status(400).json({ error: 'Valid admin email and password (min 6 characters) are required.' });
      return;
    }

    const hash = hashPassword(cleanPass);
    const now = new Date().toISOString();

    const claimTx = db.transaction(() => {
      const existingCount = (db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number }).count;
      if (existingCount > 0) {
        return null;
      }
      const info = db
        .prepare('INSERT INTO admins (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(cleanEmail, cleanName, hash, now);
      return Number(info.lastInsertRowid);
    });

    const adminId = claimTx();
    if (!adminId) {
      res.status(409).json({ error: 'Admin account has already been claimed. Please sign in.' });
      return;
    }

    const token = signSessionToken({ sub: adminId, email: cleanEmail, name: cleanName, role: 'admin' });
    setSessionCookie(req, res, ADMIN_COOKIE_NAME, token);
    res.status(201).json({
      token,
      admin: { id: adminId, email: cleanEmail, name: cleanName, role: 'admin' },
    });
  });

  app.post('/api/admin/login', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPass = typeof password === 'string' ? password : '';

    if (!cleanEmail || !cleanPass) {
      res.status(400).json({ error: 'Admin email and password are required.' });
      return;
    }

    if (isAdminEnvConfigured()) {
      const envEmail = (process.env.ADMIN_EMAIL || 'rakeshgogoi9988@gmail.com').trim().toLowerCase();
      const envPass = process.env.ADMIN_PASSWORD || '';
      if (!timingSafeStringMatch(cleanEmail, envEmail) || !timingSafeStringMatch(cleanPass, envPass)) {
        res.status(401).json({ error: 'Invalid admin credentials.' });
        return;
      }
      const token = signSessionToken({ sub: 1, email: envEmail, name: 'Store Admin', role: 'admin' });
      setSessionCookie(req, res, ADMIN_COOKIE_NAME, token);
      res.json({ token, admin: { id: 1, email: envEmail, name: 'Store Admin', role: 'admin' } });
      return;
    }

    const adminRow = db.prepare('SELECT * FROM admins WHERE email = ?').get(cleanEmail) as
      | { id: number; email: string; name: string; password_hash: string }
      | undefined;

    if (!adminRow || !verifyPassword(cleanPass, adminRow.password_hash)) {
      res.status(401).json({ error: 'Invalid admin email or password.' });
      return;
    }

    const token = signSessionToken({
      sub: adminRow.id,
      email: adminRow.email,
      name: adminRow.name,
      role: 'admin',
    });
    setSessionCookie(req, res, ADMIN_COOKIE_NAME, token);
    res.json({
      token,
      admin: { id: adminRow.id, email: adminRow.email, name: adminRow.name, role: 'admin' },
    });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    clearSessionCookie(req, res, ADMIN_COOKIE_NAME);
    res.json({ ok: true });
  });

  // --- STOREFRONT PUBLIC ENDPOINTS ---
  app.get('/api/storefront/bootstrap', (req: Request, res: Response) => {
    const productRows = db.prepare('SELECT * FROM products ORDER BY is_featured DESC, id DESC').all() as Record<
      string,
      unknown
    >[];
    const offerRows = db
      .prepare('SELECT * FROM offers WHERE is_active = 1 ORDER BY id DESC')
      .all() as Record<string, unknown>[];
    const paymentRow = db.prepare('SELECT * FROM payment_settings WHERE id = 1').get() as Record<string, unknown>;
    const defaultReturnRow = db
      .prepare('SELECT * FROM return_addresses ORDER BY is_default DESC, id ASC LIMIT 1')
      .get() as Record<string, unknown> | undefined;

    const ownerKey = getWishlistOwnerKey(req, res);
    const wishlistRows = db
      .prepare('SELECT product_id FROM wishlists WHERE user_key = ?')
      .all(ownerKey) as Array<{ product_id: number }>;

    res.json({
      products: productRows.map(mapProductRow),
      offers: offerRows.map(mapOfferRow),
      paymentSettings: mapPaymentSettingsRow(paymentRow),
      defaultReturnAddress: defaultReturnRow ? mapReturnAddressRow(defaultReturnRow) : null,
      wishlistIds: wishlistRows.map((r) => r.product_id),
    });
  });

  app.get('/api/products', (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'featured';

    let rows = db.prepare('SELECT * FROM products').all() as Record<string, unknown>[];
    let products = rows.map(mapProductRow);

    if (category && category !== 'All') {
      products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (q) {
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
    else products.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.id - a.id);

    res.json({ products });
  });

  app.post('/api/offers/validate', (req: Request, res: Response) => {
    const { code, subtotal } = req.body ?? {};
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const numSubtotal = Number(subtotal) || 0;
    if (!cleanCode) {
      res.status(400).json({ error: 'Please enter a promo code.' });
      return;
    }

    const row = db.prepare('SELECT * FROM offers WHERE UPPER(code) = ?').get(cleanCode) as
      | Record<string, unknown>
      | undefined;
    const offer: Offer | null = row ? mapOfferRow(row) : null;
    const totals = computeCartTotals([{ price: numSubtotal, mrp: numSubtotal, quantity: 1 }], offer);

    if (!offer || !offer.isActive) {
      res.status(404).json({ error: 'Offer code is invalid or inactive.' });
      return;
    }
    if (numSubtotal < offer.minOrderAmount) {
      res.status(400).json({
        error: `Minimum order of ₹${offer.minOrderAmount.toLocaleString('en-IN')} required for ${offer.code}.`,
      });
      return;
    }

    res.json({
      offer,
      discountAmount: totals.couponDiscount,
    });
  });

  app.get('/api/wishlist', (req: Request, res: Response) => {
    const ownerKey = getWishlistOwnerKey(req, res);
    const rows = db
      .prepare('SELECT product_id FROM wishlists WHERE user_key = ?')
      .all(ownerKey) as Array<{ product_id: number }>;
    res.json({ wishlistIds: rows.map((r) => r.product_id) });
  });

  app.post('/api/wishlist/toggle', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const productId = Number(req.body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({ error: 'Valid productId is required.' });
      return;
    }
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const ownerKey = getWishlistOwnerKey(req, res);
    const exists = db
      .prepare('SELECT 1 FROM wishlists WHERE user_key = ? AND product_id = ?')
      .get(ownerKey, productId);
    if (exists) {
      db.prepare('DELETE FROM wishlists WHERE user_key = ? AND product_id = ?').run(ownerKey, productId);
    } else {
      db.prepare('INSERT INTO wishlists (user_key, product_id, created_at) VALUES (?, ?, ?)').run(
        ownerKey,
        productId,
        new Date().toISOString()
      );
    }

    const rows = db
      .prepare('SELECT product_id FROM wishlists WHERE user_key = ?')
      .all(ownerKey) as Array<{ product_id: number }>;
    res.json({ wishlistIds: rows.map((r) => r.product_id), saved: !exists });
  });

  // --- ORDERS & TRACKING ---
  app.post('/api/orders', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      addressLine,
      city,
      state,
      pincode,
      items,
      couponCode,
      paymentMethod,
      transactionRef,
    } = req.body ?? {};

    const cleanName = typeof customerName === 'string' ? customerName.trim() : '';
    const cleanEmail = typeof customerEmail === 'string' ? customerEmail.trim() : '';
    const cleanPhone = typeof customerPhone === 'string' ? customerPhone.trim() : '';
    const cleanAddr = typeof addressLine === 'string' ? addressLine.trim() : '';
    const cleanCity = typeof city === 'string' ? city.trim() : '';
    const cleanState = typeof state === 'string' ? state.trim() : '';
    const cleanPin = typeof pincode === 'string' ? pincode.trim() : '';

    if (
      cleanName.length < 2 ||
      cleanPhone.length < 8 ||
      cleanAddr.length < 5 ||
      cleanCity.length < 2 ||
      cleanState.length < 2 ||
      !/^\d{6}$/.test(cleanPin)
    ) {
      res.status(400).json({ error: 'Please fill a valid name, phone, full address, and 6-digit pincode.' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const method = paymentMethod === 'ONLINE_QR' ? 'ONLINE_QR' : 'COD';
    const cleanTxRef = typeof transactionRef === 'string' ? transactionRef.trim() : '';
    if (method === 'ONLINE_QR' && cleanTxRef.length < 4) {
      res.status(400).json({ error: 'Please enter your UPI Transaction / UTR Reference ID after scanning the QR.' });
      return;
    }

    const customer = getAuthenticatedSession(req, 'customer');

    const createOrderTx = db.transaction(() => {
      const snapshots: OrderItemSnapshot[] = [];
      for (const reqItem of items) {
        const pid = Number(reqItem?.productId);
        const qty = Math.max(1, Math.min(20, Math.floor(Number(reqItem?.quantity) || 1)));
        const pRow = db.prepare('SELECT * FROM products WHERE id = ?').get(pid) as
          | Record<string, unknown>
          | undefined;
        if (!pRow) {
          throw new Error('PRODUCT_NOT_FOUND');
        }
        const product = mapProductRow(pRow);
        if (product.stock < qty) {
          throw new Error(`INSUFFICIENT_STOCK:${product.title}`);
        }
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, product.id);
        snapshots.push({
          productId: product.id,
          title: product.title,
          brand: product.brand,
          imageUrl: product.imageUrl,
          price: product.price,
          mrp: product.mrp,
          quantity: qty,
        });
      }

      let offer: Offer | null = null;
      const cleanCoupon = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
      if (cleanCoupon) {
        const offerRow = db.prepare('SELECT * FROM offers WHERE UPPER(code) = ?').get(cleanCoupon) as
          | Record<string, unknown>
          | undefined;
        if (offerRow) offer = mapOfferRow(offerRow);
      }

      const totals = computeCartTotals(snapshots, offer);
      const countRow = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM orders').get() as { maxId: number };
      const orderNumber = `HM-${1001 + countRow.maxId}`;
      const now = new Date().toISOString();
      const paymentStatus: PaymentStatus = method === 'ONLINE_QR' ? 'Verification Pending' : 'Pending';
      const initialLocation = 'HOME MURT Order Desk — Preparing Shipment';
      const estimatedDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

      const info = db
        .prepare(`
        INSERT INTO orders (
          order_number, user_id, customer_name, customer_email, customer_phone,
          address_line, city, state, pincode, items_json, subtotal, coupon_code,
          discount_amount, delivery_fee, total_amount, payment_method, payment_status,
          transaction_ref, order_status, current_location, estimated_delivery, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          orderNumber,
          customer ? customer.sub : null,
          cleanName,
          cleanEmail || (customer ? customer.email : ''),
          cleanPhone,
          cleanAddr,
          cleanCity,
          cleanState,
          cleanPin,
          JSON.stringify(snapshots),
          totals.subtotal,
          totals.couponDiscount > 0 && offer ? offer.code : null,
          totals.couponDiscount,
          totals.deliveryFee,
          totals.grandTotal,
          method,
          paymentStatus,
          method === 'ONLINE_QR' ? cleanTxRef : null,
          'Order Placed',
          initialLocation,
          `Expected by ${estimatedDate}`,
          now,
          now
        );

      const orderId = Number(info.lastInsertRowid);
      db.prepare(`
        INSERT INTO order_tracking_events (order_id, status, location, note, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        orderId,
        'Order Placed',
        'HOME MURT Order Desk',
        method === 'ONLINE_QR'
          ? `Order placed with UPI QR payment (Ref: ${cleanTxRef}).`
          : 'Order placed with Cash on Delivery.',
        now
      );

      const createdRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
      return mapOrderRow(createdRow);
    });

    try {
      const order = createOrderTx();
      res.status(201).json({ order });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'PRODUCT_NOT_FOUND') {
        res.status(404).json({ error: 'One or more products in your cart are no longer available.' });
        return;
      }
      if (msg.startsWith('INSUFFICIENT_STOCK:')) {
        res.status(400).json({ error: `Not enough stock for ${msg.split(':')[1]}.` });
        return;
      }
      res.status(500).json({ error: 'Unable to place order. Please try again.' });
    }
  });

  app.get('/api/orders/my', (req: Request, res: Response) => {
    const customer = getAuthenticatedSession(req, 'customer');
    if (!customer) {
      res.status(401).json({ error: 'Sign in to view your orders.' });
      return;
    }
    const rows = db
      .prepare('SELECT * FROM orders WHERE user_id = ? OR LOWER(customer_email) = ? ORDER BY id DESC')
      .all(customer.sub, customer.email.toLowerCase()) as Record<string, unknown>[];
    res.json({ orders: rows.map(mapOrderRow) });
  });

  app.get('/api/orders/track/:orderNumber', (req: Request, res: Response) => {
    const orderNumber = String(req.params.orderNumber || '').trim().toUpperCase();
    if (!orderNumber) {
      res.status(400).json({ error: 'Order number is required.' });
      return;
    }
    const row = db.prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?').get(orderNumber) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: `Order ${orderNumber} not found. Check your Order ID (e.g., HM-1001).` });
      return;
    }
    const defaultReturnRow = db
      .prepare('SELECT * FROM return_addresses ORDER BY is_default DESC, id ASC LIMIT 1')
      .get() as Record<string, unknown> | undefined;

    res.json({
      order: mapOrderRow(row),
      defaultReturnAddress: defaultReturnRow ? mapReturnAddressRow(defaultReturnRow) : null,
    });
  });

  app.post('/api/orders/:orderNumber/return', (req: Request, res: Response) => {
    if (!verifyCsrfForCookieMutation(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const orderNumber = String(req.params.orderNumber || '').trim().toUpperCase();
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5) {
      res.status(400).json({ error: 'Please describe the reason for return (min 5 characters).' });
      return;
    }

    const orderRow = db.prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?').get(orderNumber) as
      | Record<string, unknown>
      | undefined;
    if (!orderRow) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const order = mapOrderRow(orderRow);
    if (order.returnRequest) {
      res.status(409).json({ error: 'A return request has already been submitted for this order.' });
      return;
    }

    const defaultAddrRow = db
      .prepare('SELECT * FROM return_addresses ORDER BY is_default DESC, id ASC LIMIT 1')
      .get() as Record<string, unknown> | undefined;
    const addr = defaultAddrRow ? mapReturnAddressRow(defaultAddrRow) : null;
    const addrSnapshot = addr
      ? `${addr.label} — ${addr.recipientName}, ${addr.addressLine}, ${addr.city}, ${addr.state} - ${addr.pincode} (Ph: ${addr.phone})`
      : 'HOME MURT Central Returns Warehouse';

    const now = new Date().toISOString();
    const info = db
      .prepare(`
      INSERT INTO return_requests (
        order_id, order_number, customer_name, customer_phone, reason,
        return_address_snapshot, status, admin_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Requested', '', ?, ?)
    `)
      .run(order.id, order.orderNumber, order.customerName, order.customerPhone, reason, addrSnapshot, now, now);

    const retRow = db.prepare('SELECT * FROM return_requests WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<
      string,
      unknown
    >;
    res.status(201).json({ returnRequest: mapReturnRequestRow(retRow) });
  });

  // --- ADMIN PROTECTED API ROUTES ---
  app.get('/api/admin/dashboard', requireAdmin, (_req: Request, res: Response) => {
    const products = (db.prepare('SELECT * FROM products ORDER BY id DESC').all() as Record<string, unknown>[]).map(
      mapProductRow
    );
    const orders = (db.prepare('SELECT * FROM orders ORDER BY id DESC').all() as Record<string, unknown>[]).map(
      mapOrderRow
    );
    const offers = (db.prepare('SELECT * FROM offers ORDER BY id DESC').all() as Record<string, unknown>[]).map(
      mapOfferRow
    );
    const returnAddresses = (
      db.prepare('SELECT * FROM return_addresses ORDER BY is_default DESC, id DESC').all() as Record<string, unknown>[]
    ).map(mapReturnAddressRow);
    const returnRequests = (
      db.prepare('SELECT * FROM return_requests ORDER BY id DESC').all() as Record<string, unknown>[]
    ).map(mapReturnRequestRow);
    const paymentRow = db.prepare('SELECT * FROM payment_settings WHERE id = 1').get() as Record<string, unknown>;

    const totalRevenue = orders
      .filter((o) => o.orderStatus !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const activeOrdersCount = orders.filter(
      (o) => o.orderStatus !== 'Delivered' && o.orderStatus !== 'Cancelled'
    ).length;
    const pendingReturnsCount = returnRequests.filter((r) => r.status === 'Requested').length;

    res.json({
      kpis: {
        totalRevenue,
        totalOrders: orders.length,
        activeOrdersCount,
        pendingReturnsCount,
        totalProducts: products.length,
        activeOffers: offers.filter((o) => o.isActive).length,
      },
      products,
      orders,
      offers,
      returnAddresses,
      returnRequests,
      paymentSettings: mapPaymentSettingsRow(paymentRow),
    });
  });

  app.post('/api/admin/products', requireAdmin, (req: Request, res: Response) => {
    const { title, brand, category, price, mrp, stock, imageUrl, description, specs, isFeatured } = req.body ?? {};
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBrand = typeof brand === 'string' ? brand.trim() : '';
    const cleanCat = typeof category === 'string' ? category.trim() : 'Home & Living';
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    const cleanImg = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    const numPrice = Math.max(1, Math.round(Number(price) || 0));
    const numMrp = Math.max(numPrice, Math.round(Number(mrp) || numPrice));
    const numStock = Math.max(0, Math.round(Number(stock) || 0));

    if (cleanTitle.length < 2 || cleanBrand.length < 2 || !isSafeImageUrl(cleanImg)) {
      res.status(400).json({ error: 'Valid title, brand, price, and image URL/file are required.' });
      return;
    }

    const parsedSpecs = Array.isArray(specs)
      ? specs
          .filter((s) => s && typeof s.label === 'string' && typeof s.value === 'string' && s.label.trim())
          .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      : [];

    const now = new Date().toISOString();
    const info = db
      .prepare(`
      INSERT INTO products (
        title, brand, category, price, mrp, stock, rating, review_count,
        image_url, description, specs_json, is_featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 4.7, 1, ?, ?, ?, ?, ?)
    `)
      .run(
        cleanTitle,
        cleanBrand,
        cleanCat,
        numPrice,
        numMrp,
        numStock,
        cleanImg,
        cleanDesc || `${cleanBrand} ${cleanTitle}`,
        JSON.stringify(parsedSpecs),
        isFeatured ? 1 : 0,
        now
      );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<
      string,
      unknown
    >;
    res.status(201).json({ product: mapProductRow(row) });
  });

  app.put('/api/admin/products/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const { title, brand, category, price, mrp, stock, imageUrl, description, specs, isFeatured } = req.body ?? {};
    const cleanTitle = typeof title === 'string' && title.trim() ? title.trim() : String(existing.title);
    const cleanBrand = typeof brand === 'string' && brand.trim() ? brand.trim() : String(existing.brand);
    const cleanCat = typeof category === 'string' && category.trim() ? category.trim() : String(existing.category);
    const numPrice = price !== undefined ? Math.max(1, Math.round(Number(price))) : Number(existing.price);
    const numMrp = mrp !== undefined ? Math.max(numPrice, Math.round(Number(mrp))) : Number(existing.mrp);
    const numStock = stock !== undefined ? Math.max(0, Math.round(Number(stock))) : Number(existing.stock);
    const cleanImg =
      typeof imageUrl === 'string' && isSafeImageUrl(imageUrl.trim()) ? imageUrl.trim() : String(existing.image_url);
    const cleanDesc = typeof description === 'string' ? description.trim() : String(existing.description);
    const specsJson = Array.isArray(specs)
      ? JSON.stringify(
          specs
            .filter((s) => s && typeof s.label === 'string' && typeof s.value === 'string' && s.label.trim())
            .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
        )
      : String(existing.specs_json);

    db.prepare(`
      UPDATE products
      SET title = ?, brand = ?, category = ?, price = ?, mrp = ?, stock = ?,
          image_url = ?, description = ?, specs_json = ?, is_featured = ?
      WHERE id = ?
    `).run(
      cleanTitle,
      cleanBrand,
      cleanCat,
      numPrice,
      numMrp,
      numStock,
      cleanImg,
      cleanDesc,
      specsJson,
      isFeatured !== undefined ? (isFeatured ? 1 : 0) : Number(existing.is_featured),
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ product: mapProductRow(updated) });
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.patch('/api/admin/orders/:id/tracking', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const { orderStatus, currentLocation, trackingNote, estimatedDelivery, paymentStatus } = req.body ?? {};
    const validStatuses: OrderStatus[] = [...ORDER_STAGES, 'Cancelled'];
    const nextStatus: OrderStatus = validStatuses.includes(orderStatus)
      ? orderStatus
      : (String(existing.order_status) as OrderStatus);
    const nextLocation =
      typeof currentLocation === 'string' && currentLocation.trim()
        ? currentLocation.trim()
        : String(existing.current_location);
    const nextEstimate =
      typeof estimatedDelivery === 'string' && estimatedDelivery.trim()
        ? estimatedDelivery.trim()
        : String(existing.estimated_delivery);
    const validPayStatuses: PaymentStatus[] = ['Pending', 'Verification Pending', 'Verified', 'Failed'];
    const nextPayStatus: PaymentStatus = validPayStatuses.includes(paymentStatus)
      ? paymentStatus
      : (String(existing.payment_status) as PaymentStatus);
    const note =
      typeof trackingNote === 'string' && trackingNote.trim()
        ? trackingNote.trim()
        : `Shipment updated to ${nextStatus} at ${nextLocation}.`;

    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET order_status = ?, current_location = ?, estimated_delivery = ?, payment_status = ?, updated_at = ?
        WHERE id = ?
      `).run(nextStatus, nextLocation, nextEstimate, nextPayStatus, now, id);

      db.prepare(`
        INSERT INTO order_tracking_events (order_id, status, location, note, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, nextStatus, nextLocation, note, now);

      const updatedRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown>;
      return mapOrderRow(updatedRow);
    });

    res.json({ order: tx() });
  });

  app.post('/api/admin/offers', requireAdmin, (req: Request, res: Response) => {
    const { code, title, description, discountType, discountValue, maxDiscount, minOrderAmount, expiresAt } =
      req.body ?? {};
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : '';
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanDesc = typeof description === 'string' ? description.trim() : '';
    const type = discountType === 'flat' ? 'flat' : 'percent';
    const val = Math.max(1, Math.round(Number(discountValue) || 0));
    const maxD = Math.max(0, Math.round(Number(maxDiscount) || 0));
    const minOrd = Math.max(0, Math.round(Number(minOrderAmount) || 0));

    if (cleanCode.length < 3 || cleanTitle.length < 2) {
      res.status(400).json({ error: 'Valid offer code (3+ chars) and title are required.' });
      return;
    }

    const exists = db.prepare('SELECT id FROM offers WHERE UPPER(code) = ?').get(cleanCode);
    if (exists) {
      res.status(409).json({ error: `Offer code ${cleanCode} already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(`
      INSERT INTO offers (
        code, title, description, discount_type, discount_value,
        max_discount, min_order_amount, is_active, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)
      .run(
        cleanCode,
        cleanTitle,
        cleanDesc || cleanTitle,
        type,
        type === 'percent' ? Math.min(90, val) : val,
        maxD,
        minOrd,
        typeof expiresAt === 'string' && expiresAt.trim() ? expiresAt.trim() : null,
        now
      );

    const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<
      string,
      unknown
    >;
    res.status(201).json({ offer: mapOfferRow(row) });
  });

  app.patch('/api/admin/offers/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM offers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Offer not found.' });
      return;
    }
    const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : Number(existing.is_active);
    db.prepare('UPDATE offers SET is_active = ? WHERE id = ?').run(isActive, id);
    const row = db.prepare('SELECT * FROM offers WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ offer: mapOfferRow(row) });
  });

  app.delete('/api/admin/offers/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM offers WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Offer not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/return-addresses', requireAdmin, (req: Request, res: Response) => {
    const { label, recipientName, phone, addressLine, city, state, pincode, isDefault } = req.body ?? {};
    const cleanLabel = typeof label === 'string' ? label.trim() : '';
    const cleanRecipient = typeof recipientName === 'string' ? recipientName.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanAddr = typeof addressLine === 'string' ? addressLine.trim() : '';
    const cleanCity = typeof city === 'string' ? city.trim() : '';
    const cleanState = typeof state === 'string' ? state.trim() : '';
    const cleanPin = typeof pincode === 'string' ? pincode.trim() : '';

    if (!cleanLabel || !cleanRecipient || !cleanPhone || !cleanAddr || !cleanCity || !cleanState || !cleanPin) {
      res.status(400).json({ error: 'All return address fields are required.' });
      return;
    }

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      if (isDefault) {
        db.prepare('UPDATE return_addresses SET is_default = 0').run();
      }
      const info = db
        .prepare(`
        INSERT INTO return_addresses (
          label, recipient_name, phone, address_line, city, state, pincode, is_default, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(cleanLabel, cleanRecipient, cleanPhone, cleanAddr, cleanCity, cleanState, cleanPin, isDefault ? 1 : 0, now);
      return db.prepare('SELECT * FROM return_addresses WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<
        string,
        unknown
      >;
    });

    res.status(201).json({ returnAddress: mapReturnAddressRow(tx()) });
  });

  app.patch('/api/admin/return-addresses/:id/default', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM return_addresses WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Return address not found.' });
      return;
    }
    db.transaction(() => {
      db.prepare('UPDATE return_addresses SET is_default = 0').run();
      db.prepare('UPDATE return_addresses SET is_default = 1 WHERE id = ?').run(id);
    })();
    res.json({ ok: true });
  });

  app.delete('/api/admin/return-addresses/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const info = db.prepare('DELETE FROM return_addresses WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Return address not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.patch('/api/admin/returns/:id', requireAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM return_requests WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Return request not found.' });
      return;
    }
    const validStatuses: ReturnStatus[] = ['Requested', 'Approved', 'Pickup Scheduled', 'Completed', 'Rejected'];
    const status: ReturnStatus = validStatuses.includes(req.body?.status)
      ? req.body.status
      : (String(existing.status) as ReturnStatus);
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : String(existing.admin_note);
    const now = new Date().toISOString();

    db.prepare('UPDATE return_requests SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?').run(
      status,
      adminNote,
      now,
      id
    );
    const row = db.prepare('SELECT * FROM return_requests WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ returnRequest: mapReturnRequestRow(row) });
  });

  app.put('/api/admin/payment-settings', requireAdmin, (req: Request, res: Response) => {
    const { upiId, merchantName, qrImageUrl, instructions, onlineEnabled, codEnabled } = req.body ?? {};
    const existing = db.prepare('SELECT * FROM payment_settings WHERE id = 1').get() as Record<string, unknown>;

    const cleanUpi = typeof upiId === 'string' && upiId.trim() ? upiId.trim() : String(existing.upi_id);
    const cleanMerchant =
      typeof merchantName === 'string' && merchantName.trim()
        ? merchantName.trim()
        : String(existing.merchant_name);
    const cleanInstr =
      typeof instructions === 'string' && instructions.trim()
        ? instructions.trim()
        : String(existing.instructions);
    const cleanQr =
      typeof qrImageUrl === 'string' && qrImageUrl.trim() ? qrImageUrl.trim() : String(existing.qr_image_url);

    if (!isSafeImageUrl(cleanQr)) {
      res.status(400).json({ error: 'Invalid Payment QR image URL or uploaded image format.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE payment_settings
      SET upi_id = ?, merchant_name = ?, qr_image_url = ?, instructions = ?,
          online_enabled = ?, cod_enabled = ?, updated_at = ?
      WHERE id = 1
    `).run(
      cleanUpi,
      cleanMerchant,
      cleanQr,
      cleanInstr,
      onlineEnabled === false ? 0 : 1,
      codEnabled === false ? 0 : 1,
      now
    );

    const updated = db.prepare('SELECT * FROM payment_settings WHERE id = 1').get() as Record<string, unknown>;
    res.json({ paymentSettings: mapPaymentSettingsRow(updated) });
  });

  // --- VITE / STATIC FRONTEND SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HOME MURT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
