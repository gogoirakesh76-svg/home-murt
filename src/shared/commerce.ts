export type OrderStatus =
  | 'Order Placed'
  | 'Packed'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentMethod = 'COD' | 'ONLINE_QR';
export type PaymentStatus = 'Pending' | 'Verification Pending' | 'Verified' | 'Failed';
export type ReturnStatus = 'Requested' | 'Approved' | 'Pickup Scheduled' | 'Completed' | 'Rejected';

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  mrp: number;
  stock: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  specs: ProductSpec[];
  isFeatured: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Offer {
  id: number;
  code: string;
  title: string;
  description: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  maxDiscount: number;
  minOrderAmount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReturnAddress {
  id: number;
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface PaymentSettings {
  upiId: string;
  merchantName: string;
  qrImageUrl: string;
  instructions: string;
  onlineEnabled: boolean;
  codEnabled: boolean;
  updatedAt: string;
}

export interface OrderItemSnapshot {
  productId: number;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  mrp: number;
  quantity: number;
}

export interface OrderTrackingEvent {
  id: number;
  orderId: number;
  status: OrderStatus;
  location: string;
  note: string;
  createdAt: string;
}

export interface ReturnRequest {
  id: number;
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  returnAddressSnapshot: string;
  status: ReturnStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  couponCode: string | null;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionRef: string | null;
  orderStatus: OrderStatus;
  currentLocation: string;
  estimatedDelivery: string;
  createdAt: string;
  updatedAt: string;
  trackingEvents?: OrderTrackingEvent[];
  returnRequest?: ReturnRequest | null;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin';
}

export const ORDER_STAGES: OrderStatus[] = [
  'Order Placed',
  'Packed',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

export const FREE_DELIVERY_THRESHOLD = 999;
export const STANDARD_DELIVERY_FEE = 79;

export function calculateDiscountPercent(mrp: number, price: number): number {
  if (!Number.isFinite(mrp) || !Number.isFinite(price) || mrp <= 0 || price >= mrp) {
    return 0;
  }
  return Math.round(((mrp - price) / mrp) * 100);
}

export interface OfferValidationResult {
  valid: boolean;
  discountAmount: number;
  reason?: string;
}

export function validateAndComputeOffer(
  subtotal: number,
  offer: Offer | null | undefined,
  now: Date = new Date()
): OfferValidationResult {
  if (!offer) {
    return { valid: false, discountAmount: 0, reason: 'Offer code not found.' };
  }
  if (!offer.isActive) {
    return { valid: false, discountAmount: 0, reason: 'This offer is currently inactive.' };
  }
  if (offer.expiresAt) {
    const expiry = new Date(offer.expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return { valid: false, discountAmount: 0, reason: 'This offer has expired.' };
    }
  }
  if (subtotal < offer.minOrderAmount) {
    return {
      valid: false,
      discountAmount: 0,
      reason: `Minimum order of ₹${offer.minOrderAmount.toLocaleString('en-IN')} required.`,
    };
  }

  let discount = 0;
  if (offer.discountType === 'percent') {
    discount = Math.round((subtotal * offer.discountValue) / 100);
    if (offer.maxDiscount > 0) {
      discount = Math.min(discount, offer.maxDiscount);
    }
  } else {
    discount = Math.round(offer.discountValue);
  }
  discount = Math.max(0, Math.min(discount, subtotal));

  return { valid: true, discountAmount: discount };
}

export interface CartTotals {
  subtotal: number;
  mrpTotal: number;
  productSavings: number;
  couponDiscount: number;
  deliveryFee: number;
  grandTotal: number;
}

export function computeCartTotals(
  items: Array<{ price: number; mrp: number; quantity: number }>,
  offer?: Offer | null,
  now: Date = new Date()
): CartTotals {
  let subtotal = 0;
  let mrpTotal = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity));
    const price = Math.max(0, Number(item.price) || 0);
    const mrp = Math.max(price, Number(item.mrp) || price);
    subtotal += price * qty;
    mrpTotal += mrp * qty;
  }

  const productSavings = Math.max(0, mrpTotal - subtotal);
  const offerResult = offer ? validateAndComputeOffer(subtotal, offer, now) : { valid: false, discountAmount: 0 };
  const couponDiscount = offerResult.valid ? offerResult.discountAmount : 0;
  const afterDiscount = Math.max(0, subtotal - couponDiscount);
  const deliveryFee =
    subtotal === 0 || afterDiscount >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;

  return {
    subtotal,
    mrpTotal,
    productSavings,
    couponDiscount,
    deliveryFee,
    grandTotal: afterDiscount + deliveryFee,
  };
}

export function getTrackingStageIndex(status: OrderStatus): number {
  const idx = ORDER_STAGES.indexOf(status);
  return idx >= 0 ? idx : -1;
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function isSafeImageUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (value.startsWith('/src/assets/') || value.startsWith('/api/')) {
    return !value.includes('..');
  }
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(value)) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
