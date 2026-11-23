import type {
  AuthUser,
  Offer,
  Order,
  PaymentSettings,
  Product,
  ReturnAddress,
  ReturnRequest,
} from '../shared/commerce';

let customerBearerToken: string | null = null;
let adminBearerToken: string | null = null;

export function setCustomerToken(token: string | null): void {
  customerBearerToken = token;
}

export function setAdminToken(token: string | null): void {
  adminBearerToken = token;
}

async function requestJson<T>(
  url: string,
  options: RequestInit & { authRole?: 'customer' | 'admin' } = {}
): Promise<T> {
  const { authRole, headers, ...rest } = options;
  const reqHeaders = new Headers(headers);
  reqHeaders.set('X-Requested-With', 'XMLHttpRequest');
  if (rest.body && !reqHeaders.has('Content-Type')) {
    reqHeaders.set('Content-Type', 'application/json');
  }
  if (authRole === 'admin' && adminBearerToken) {
    reqHeaders.set('Authorization', `Bearer ${adminBearerToken}`);
  } else if (authRole === 'customer' && customerBearerToken) {
    reqHeaders.set('Authorization', `Bearer ${customerBearerToken}`);
  }

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export interface AuthMeResponse {
  customer: AuthUser | null;
  admin: AuthUser | null;
  adminInitialized: boolean;
  suggestedAdminEmail: string;
}

export interface StorefrontBootstrapResponse {
  products: Product[];
  offers: Offer[];
  paymentSettings: PaymentSettings;
  defaultReturnAddress: ReturnAddress | null;
  wishlistIds: number[];
}

export interface AdminDashboardResponse {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    activeOrdersCount: number;
    pendingReturnsCount: number;
    totalProducts: number;
    activeOffers: number;
  };
  products: Product[];
  orders: Order[];
  offers: Offer[];
  returnAddresses: ReturnAddress[];
  returnRequests: ReturnRequest[];
  paymentSettings: PaymentSettings;
}

export const api = {
  getAuthMe: () => requestJson<AuthMeResponse>('/api/auth/me'),

  registerCustomer: (payload: { name: string; email: string; phone: string; password: string }) =>
    requestJson<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loginCustomer: (payload: { email: string; password: string }) =>
    requestJson<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logoutCustomer: () =>
    requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST', authRole: 'customer' }),

  claimAdmin: (payload: { email: string; name: string; password: string }) =>
    requestJson<{ token: string; admin: AuthUser }>('/api/admin/claim', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loginAdmin: (payload: { email: string; password: string }) =>
    requestJson<{ token: string; admin: AuthUser }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logoutAdmin: () =>
    requestJson<{ ok: boolean }>('/api/admin/logout', { method: 'POST', authRole: 'admin' }),

  getBootstrap: () => requestJson<StorefrontBootstrapResponse>('/api/storefront/bootstrap'),

  toggleWishlist: (productId: number) =>
    requestJson<{ wishlistIds: number[]; saved: boolean }>('/api/wishlist/toggle', {
      method: 'POST',
      authRole: 'customer',
      body: JSON.stringify({ productId }),
    }),

  validateOffer: (code: string, subtotal: number) =>
    requestJson<{ offer: Offer; discountAmount: number }>('/api/offers/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    }),

  createOrder: (payload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    items: Array<{ productId: number; quantity: number }>;
    couponCode?: string | null;
    paymentMethod: 'COD' | 'ONLINE_QR';
    transactionRef?: string;
  }) =>
    requestJson<{ order: Order }>('/api/orders', {
      method: 'POST',
      authRole: 'customer',
      body: JSON.stringify(payload),
    }),

  getMyOrders: () => requestJson<{ orders: Order[] }>('/api/orders/my', { authRole: 'customer' }),

  trackOrder: (orderNumber: string) =>
    requestJson<{ order: Order; defaultReturnAddress: ReturnAddress | null }>(
      `/api/orders/track/${encodeURIComponent(orderNumber)}`
    ),

  requestReturn: (orderNumber: string, reason: string) =>
    requestJson<{ returnRequest: ReturnRequest }>(
      `/api/orders/${encodeURIComponent(orderNumber)}/return`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  // Admin endpoints
  getAdminDashboard: () =>
    requestJson<AdminDashboardResponse>('/api/admin/dashboard', { authRole: 'admin' }),

  createProduct: (payload: Omit<Product, 'id' | 'rating' | 'reviewCount' | 'createdAt'>) =>
    requestJson<{ product: Product }>('/api/admin/products', {
      method: 'POST',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: number, payload: Partial<Omit<Product, 'id' | 'createdAt'>>) =>
    requestJson<{ product: Product }>(`/api/admin/products/${id}`, {
      method: 'PUT',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/admin/products/${id}`, {
      method: 'DELETE',
      authRole: 'admin',
    }),

  updateOrderTracking: (
    orderId: number,
    payload: {
      orderStatus: string;
      currentLocation: string;
      trackingNote: string;
      estimatedDelivery: string;
      paymentStatus: string;
    }
  ) =>
    requestJson<{ order: Order }>(`/api/admin/orders/${orderId}/tracking`, {
      method: 'PATCH',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),

  createOffer: (payload: {
    code: string;
    title: string;
    description: string;
    discountType: 'percent' | 'flat';
    discountValue: number;
    maxDiscount: number;
    minOrderAmount: number;
    expiresAt: string | null;
  }) =>
    requestJson<{ offer: Offer }>('/api/admin/offers', {
      method: 'POST',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),

  toggleOffer: (id: number, isActive: boolean) =>
    requestJson<{ offer: Offer }>(`/api/admin/offers/${id}`, {
      method: 'PATCH',
      authRole: 'admin',
      body: JSON.stringify({ isActive }),
    }),

  deleteOffer: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/admin/offers/${id}`, {
      method: 'DELETE',
      authRole: 'admin',
    }),

  createReturnAddress: (payload: Omit<ReturnAddress, 'id' | 'createdAt'>) =>
    requestJson<{ returnAddress: ReturnAddress }>('/api/admin/return-addresses', {
      method: 'POST',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),

  setDefaultReturnAddress: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/admin/return-addresses/${id}/default`, {
      method: 'PATCH',
      authRole: 'admin',
    }),

  deleteReturnAddress: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/admin/return-addresses/${id}`, {
      method: 'DELETE',
      authRole: 'admin',
    }),

  updateReturnRequest: (id: number, payload: { status: string; adminNote: string }) =>
    requestJson<{ returnRequest: ReturnRequest }>(`/api/admin/returns/${id}`, {
      method: 'PATCH',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),

  updatePaymentSettings: (payload: Omit<PaymentSettings, 'updatedAt'>) =>
    requestJson<{ paymentSettings: PaymentSettings }>('/api/admin/payment-settings', {
      method: 'PUT',
      authRole: 'admin',
      body: JSON.stringify(payload),
    }),
};
