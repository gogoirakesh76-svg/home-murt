import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
  Offer,
  Order,
  OrderItemSnapshot,
  OrderTrackingEvent,
  PaymentSettings,
  Product,
  ProductSpec,
  ReturnAddress,
  ReturnRequest,
} from '../src/shared/commerce';

const DATA_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'home_murt.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    mrp INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 25,
    rating REAL NOT NULL DEFAULT 4.5,
    review_count INTEGER NOT NULL DEFAULT 12,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    specs_json TEXT NOT NULL DEFAULT '[]',
    is_featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    user_key TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_key, product_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'flat')),
    discount_value INTEGER NOT NULL,
    max_discount INTEGER NOT NULL DEFAULT 0,
    min_order_amount INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS return_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    upi_id TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    qr_image_url TEXT NOT NULL,
    instructions TEXT NOT NULL,
    online_enabled INTEGER NOT NULL DEFAULT 1,
    cod_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address_line TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    coupon_code TEXT,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    delivery_fee INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('COD', 'ONLINE_QR')),
    payment_status TEXT NOT NULL,
    transaction_ref TEXT,
    order_status TEXT NOT NULL,
    current_location TEXT NOT NULL,
    estimated_delivery TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_tracking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    location TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS return_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE,
    order_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    return_address_snapshot TEXT NOT NULL,
    status TEXT NOT NULL,
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

function seedDatabaseIfEmpty(): void {
  const now = new Date().toISOString();

  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (productCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        title, brand, category, price, mrp, stock, rating, review_count,
        image_url, description, specs_json, is_featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedProducts = [
      {
        title: 'Aether Studio ANC Wireless Headphones',
        brand: 'Aether Audio',
        category: 'Electronics',
        price: 7499,
        mrp: 11999,
        stock: 28,
        rating: 4.8,
        reviewCount: 412,
        imageUrl: '/src/assets/images/prod_headphones_anc_1795440015987.jpg',
        description:
          'Active noise-cancelling over-ear headphones machined with brushed aluminum yokes, memory-velour ear cushions, and 48-hour battery life.',
        specs: [
          { label: 'Driver Size', value: '40mm Titanium Dynamic' },
          { label: 'Battery Life', value: '48 Hours (ANC On)' },
          { label: 'Connectivity', value: 'Bluetooth 5.4 & USB-C' },
          { label: 'Warranty', value: '2 Years Manufacturer' },
        ],
        isFeatured: 1,
      },
      {
        title: 'Barista Pro Stainless Espresso Maker',
        brand: 'CremaCraft',
        category: 'Kitchen',
        price: 18499,
        mrp: 24999,
        stock: 14,
        rating: 4.7,
        reviewCount: 198,
        imageUrl: '/src/assets/images/prod_espresso_maker_1795440015826.jpg',
        description:
          '15-bar Italian pump countertop espresso machine with precision PID temperature control, integrated pressure gauge, and commercial microfoam steam wand.',
        specs: [
          { label: 'Pressure', value: '15-Bar Precision Pump' },
          { label: 'Water Tank', value: '1.8L Removable BPA-Free' },
          { label: 'Body Material', value: 'Brushed 304 Stainless Steel' },
          { label: 'Power', value: '1450W Rapid Thermoblock' },
        ],
        isFeatured: 1,
      },
      {
        title: 'Apex Titanium AMOLED Smartwatch',
        brand: 'Veloce Tech',
        category: 'Electronics',
        price: 5999,
        mrp: 8999,
        stock: 42,
        rating: 4.6,
        reviewCount: 625,
        imageUrl: '/src/assets/images/prod_smartwatch_pro_1795440016128.jpg',
        description:
          'Grade-5 titanium bezel smartwatch with 1.43-inch always-on AMOLED display, dual-band GPS, Bluetooth calling, and 14-day battery autonomy.',
        specs: [
          { label: 'Display', value: '1.43" 1000-Nit AMOLED' },
          { label: 'Case', value: 'Sandblasted Titanium Alloy' },
          { label: 'Water Resistance', value: '5 ATM Swim-Proof' },
          { label: 'Strap', value: '22mm Quick-Release Woven Nylon' },
        ],
        isFeatured: 1,
      },
      {
        title: 'Sculpted Stoneware Ceramic Table Lamp',
        brand: 'HOME MURT Studio',
        category: 'Home & Living',
        price: 3299,
        mrp: 4999,
        stock: 19,
        rating: 4.9,
        reviewCount: 147,
        imageUrl: '/src/assets/images/prod_ceramic_lamp_1795440016481.jpg',
        description:
          'Hand-cast matte stoneware ceramic base paired with a natural woven Belgian linen drum shade for warm, diffused living room illumination.',
        specs: [
          { label: 'Base Material', value: 'Kiln-Fired Matte Ceramic' },
          { label: 'Shade', value: 'Natural Woven Linen' },
          { label: 'Bulb Included', value: '9W Warm White LED (E27)' },
          { label: 'Dimensions', value: '46cm H x 28cm Diameter' },
        ],
        isFeatured: 1,
      },
      {
        title: 'Heritage Handloom Linen Overshirt & Wallet Set',
        brand: 'Kala Loom',
        category: 'Fashion',
        price: 2499,
        mrp: 3799,
        stock: 35,
        rating: 4.7,
        reviewCount: 284,
        imageUrl: '/src/assets/images/prod_linen_kurta_1795440015861.jpg',
        description:
          'Breathable 100% pure European flax linen overshirt in sage-stone with corozo nut buttons, bundled with a full-grain vegetable-tanned leather cardholder.',
        specs: [
          { label: 'Fabric', value: '100% Breathable Flax Linen' },
          { label: 'Fit', value: 'Tailored Relaxed Silhouette' },
          { label: 'Care', value: 'Cold Gentle Wash' },
          { label: 'Gift Bundle', value: 'Includes Tan Leather Wallet' },
        ],
        isFeatured: 0,
      },
      {
        title: 'Nordic Walnut Living Room Centerpiece Set',
        brand: 'HOME MURT Studio',
        category: 'Home & Living',
        price: 12999,
        mrp: 17500,
        stock: 9,
        rating: 4.8,
        reviewCount: 89,
        imageUrl: '/src/assets/images/hero_home_murt_1795440015987.jpg',
        description:
          'Curated living space bundle featuring a solid walnut curved coffee table, brushed brass accent lamp, and terracotta artisan vessel.',
        specs: [
          { label: 'Wood', value: 'Kiln-Dried Solid Sheesham & Walnut Finish' },
          { label: 'Table Size', value: '110cm x 60cm x 42cm' },
          { label: 'Assembly', value: 'Tool-Free 10-Min Setup' },
          { label: 'Delivery', value: 'Insured White-Glove Transit' },
        ],
        isFeatured: 1,
      },
    ];

    for (const p of seedProducts) {
      insertProduct.run(
        p.title,
        p.brand,
        p.category,
        p.price,
        p.mrp,
        p.stock,
        p.rating,
        p.reviewCount,
        p.imageUrl,
        p.description,
        JSON.stringify(p.specs),
        p.isFeatured,
        now
      );
    }
  }

  const offerCount = (db.prepare('SELECT COUNT(*) as count FROM offers').get() as { count: number }).count;
  if (offerCount === 0) {
    const insertOffer = db.prepare(`
      INSERT INTO offers (
        code, title, description, discount_type, discount_value,
        max_discount, min_order_amount, is_active, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertOffer.run(
      'MURT15',
      '15% Welcome Savings',
      'Save 15% up to ₹1,500 on orders above ₹999',
      'percent',
      15,
      1500,
      999,
      1,
      null,
      now
    );
    insertOffer.run(
      'FLAT500',
      'Flat ₹500 Instant Discount',
      'Get ₹500 off on orders ₹2,999 and above',
      'flat',
      500,
      500,
      2999,
      1,
      null,
      now
    );
  }

  const returnAddressCount = (
    db.prepare('SELECT COUNT(*) as count FROM return_addresses').get() as { count: number }
  ).count;
  if (returnAddressCount === 0) {
    db.prepare(`
      INSERT INTO return_addresses (
        label, recipient_name, phone, address_line, city, state, pincode, is_default, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Central Returns Hub',
      'HOME MURT Returns Desk',
      '+91 98640 11223',
      'Plot 14, GS Road Logistics Park, Near Dispur',
      'Guwahati',
      'Assam',
      '781005',
      1,
      now
    );
  }

  const paymentRow = db.prepare('SELECT id FROM payment_settings WHERE id = 1').get();
  if (!paymentRow) {
    db.prepare(`
      INSERT INTO payment_settings (
        id, upi_id, merchant_name, qr_image_url, instructions, online_enabled, cod_enabled, updated_at
      ) VALUES (1, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      'homemurt@upi',
      'HOME MURT Retail',
      '/api/default-qr.svg',
      'Scan this QR using Google Pay, PhonePe, Paytm, or BHIM UPI, complete payment, and enter your 12-digit UTR / Transaction Reference ID below.',
      now
    );
  }

  const orderCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
  if (orderCount === 0) {
    const t1 = new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString();
    const t2 = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const t3 = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();

    const sampleOrder1Items: OrderItemSnapshot[] = [
      {
        productId: 1,
        title: 'Aether Studio ANC Wireless Headphones',
        brand: 'Aether Audio',
        imageUrl: '/src/assets/images/prod_headphones_anc_1795440015987.jpg',
        price: 7499,
        mrp: 11999,
        quantity: 1,
      },
    ];

    const res1 = db
      .prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        address_line, city, state, pincode, items_json, subtotal, coupon_code,
        discount_amount, delivery_fee, total_amount, payment_method, payment_status,
        transaction_ref, order_status, current_location, estimated_delivery, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        'HM-1001',
        'Aarav Sharma',
        'aarav.sharma@example.com',
        '9876543210',
        'House 42, Zoo Road Tiniali',
        'Guwahati',
        'Assam',
        '781024',
        JSON.stringify(sampleOrder1Items),
        7499,
        'MURT15',
        1125,
        0,
        6374,
        'ONLINE_QR',
        'Verified',
        'UTR429811048219',
        'In Transit',
        'Guwahati Regional Sorting Hub',
        'Arriving Tomorrow by 8:00 PM',
        t1,
        t3
      );

    const order1Id = Number(res1.lastInsertRowid);
    const insertEvent = db.prepare(`
      INSERT INTO order_tracking_events (order_id, status, location, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertEvent.run(
      order1Id,
      'Order Placed',
      'HOME MURT Order Desk',
      'Order received and UPI payment verified.',
      t1
    );
    insertEvent.run(
      order1Id,
      'Packed',
      'HOME MURT Fulfillment Center',
      'Quality checked, sealed, and handed over to courier partner.',
      t2
    );
    insertEvent.run(
      order1Id,
      'In Transit',
      'Guwahati Regional Sorting Hub',
      'Parcel arrived at regional hub and cleared for local dispatch.',
      t3
    );

    const sampleOrder2Items: OrderItemSnapshot[] = [
      {
        productId: 4,
        title: 'Sculpted Stoneware Ceramic Table Lamp',
        brand: 'HOME MURT Studio',
        imageUrl: '/src/assets/images/prod_ceramic_lamp_1795440016481.jpg',
        price: 3299,
        mrp: 4999,
        quantity: 1,
      },
    ];
    const res2 = db
      .prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        address_line, city, state, pincode, items_json, subtotal, coupon_code,
        discount_amount, delivery_fee, total_amount, payment_method, payment_status,
        transaction_ref, order_status, current_location, estimated_delivery, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        'HM-1002',
        'Priya Das',
        'priya.das@example.com',
        '9864099887',
        'Flat 3B, Lachit Nagar',
        'Guwahati',
        'Assam',
        '781007',
        JSON.stringify(sampleOrder2Items),
        3299,
        null,
        0,
        0,
        3299,
        'COD',
        'Verified',
        null,
        'Delivered',
        'Delivered to Recipient (Lachit Nagar)',
        'Delivered',
        t1,
        t3
      );
    const order2Id = Number(res2.lastInsertRowid);
    insertEvent.run(order2Id, 'Order Placed', 'HOME MURT Order Desk', 'Cash on Delivery order confirmed.', t1);
    insertEvent.run(order2Id, 'Packed', 'HOME MURT Fulfillment Center', 'Packed securely in cushioned box.', t2);
    insertEvent.run(order2Id, 'Delivered', 'Lachit Nagar, Guwahati', 'Delivered and signed by customer.', t3);
  }
}

seedDatabaseIfEmpty();

export function mapProductRow(row: Record<string, unknown>): Product {
  let specs: ProductSpec[] = [];
  try {
    specs = JSON.parse(String(row.specs_json || '[]'));
  } catch {
    specs = [];
  }
  return {
    id: Number(row.id),
    title: String(row.title),
    brand: String(row.brand),
    category: String(row.category),
    price: Number(row.price),
    mrp: Number(row.mrp),
    stock: Number(row.stock),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    imageUrl: String(row.image_url),
    description: String(row.description),
    specs,
    isFeatured: Boolean(row.is_featured),
    createdAt: String(row.created_at),
  };
}

export function mapOfferRow(row: Record<string, unknown>): Offer {
  return {
    id: Number(row.id),
    code: String(row.code),
    title: String(row.title),
    description: String(row.description),
    discountType: row.discount_type === 'flat' ? 'flat' : 'percent',
    discountValue: Number(row.discount_value),
    maxDiscount: Number(row.max_discount),
    minOrderAmount: Number(row.min_order_amount),
    isActive: Boolean(row.is_active),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
  };
}

export function mapReturnAddressRow(row: Record<string, unknown>): ReturnAddress {
  return {
    id: Number(row.id),
    label: String(row.label),
    recipientName: String(row.recipient_name),
    phone: String(row.phone),
    addressLine: String(row.address_line),
    city: String(row.city),
    state: String(row.state),
    pincode: String(row.pincode),
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
  };
}

export function mapPaymentSettingsRow(row: Record<string, unknown>): PaymentSettings {
  return {
    upiId: String(row.upi_id),
    merchantName: String(row.merchant_name),
    qrImageUrl: String(row.qr_image_url),
    instructions: String(row.instructions),
    onlineEnabled: Boolean(row.online_enabled),
    codEnabled: Boolean(row.cod_enabled),
    updatedAt: String(row.updated_at),
  };
}

export function mapReturnRequestRow(row: Record<string, unknown>): ReturnRequest {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    orderNumber: String(row.order_number),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    reason: String(row.reason),
    returnAddressSnapshot: String(row.return_address_snapshot),
    status: String(row.status) as ReturnRequest['status'],
    adminNote: String(row.admin_note || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapOrderRow(row: Record<string, unknown>): Order {
  let items: OrderItemSnapshot[] = [];
  try {
    items = JSON.parse(String(row.items_json || '[]'));
  } catch {
    items = [];
  }
  const id = Number(row.id);
  const trackingRows = db
    .prepare('SELECT * FROM order_tracking_events WHERE order_id = ? ORDER BY id ASC')
    .all(id) as Record<string, unknown>[];
  const trackingEvents: OrderTrackingEvent[] = trackingRows.map((ev) => ({
    id: Number(ev.id),
    orderId: Number(ev.order_id),
    status: String(ev.status) as OrderTrackingEvent['status'],
    location: String(ev.location),
    note: String(ev.note),
    createdAt: String(ev.created_at),
  }));

  const retRow = db.prepare('SELECT * FROM return_requests WHERE order_id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  return {
    id,
    orderNumber: String(row.order_number),
    userId: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone),
    addressLine: String(row.address_line),
    city: String(row.city),
    state: String(row.state),
    pincode: String(row.pincode),
    items,
    subtotal: Number(row.subtotal),
    couponCode: row.coupon_code ? String(row.coupon_code) : null,
    discountAmount: Number(row.discount_amount),
    deliveryFee: Number(row.delivery_fee),
    totalAmount: Number(row.total_amount),
    paymentMethod: row.payment_method === 'ONLINE_QR' ? 'ONLINE_QR' : 'COD',
    paymentStatus: String(row.payment_status) as Order['paymentStatus'],
    transactionRef: row.transaction_ref ? String(row.transaction_ref) : null,
    orderStatus: String(row.order_status) as Order['orderStatus'],
    currentLocation: String(row.current_location),
    estimatedDelivery: String(row.estimated_delivery),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    trackingEvents,
    returnRequest: retRow ? mapReturnRequestRow(retRow) : null,
  };
}
