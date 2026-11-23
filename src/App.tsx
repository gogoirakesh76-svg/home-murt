import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
} from 'lucide-react';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { OrderTrackingView } from './components/OrderTrackingView';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SafeImage } from './components/SafeImage';
import { WishlistView } from './components/WishlistView';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminPortal } from './components/admin/AdminPortal';
import { api, setCustomerToken } from './lib/api';
import {
  formatINR,
  type AuthUser,
  type CartItem,
  type Offer,
  type Order,
  type PaymentSettings,
  type Product,
  type ReturnAddress,
} from './shared/commerce';

type RouteView = 'home' | 'wishlist' | 'track' | 'admin';

function parsePathRoute(pathname: string): RouteView {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/wishlist')) return 'wishlist';
  if (pathname.startsWith('/track')) return 'track';
  return 'home';
}

export default function App() {
  const [route, setRoute] = useState<RouteView>(() => parsePathRoute(window.location.pathname));

  const [customer, setCustomer] = useState<AuthUser | null>(null);
  const [admin, setAdmin] = useState<AuthUser | null>(null);
  const [adminInitialized, setAdminInitialized] = useState(true);
  const [suggestedAdminEmail, setSuggestedAdminEmail] = useState('rakeshgogoi9988@gmail.com');

  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    upiId: 'homemurt@upi',
    merchantName: 'HOME MURT Retail',
    qrImageUrl: '/api/default-qr.svg',
    instructions: 'Scan QR via UPI app and enter UTR reference ID.',
    onlineEnabled: true,
    codEnabled: true,
    updatedAt: '',
  });
  const [defaultReturnAddress, setDefaultReturnAddress] = useState<ReturnAddress | null>(null);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');

  // Cart & modals
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [trackedOrderNumber, setTrackedOrderNumber] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const navigate = useCallback((target: RouteView, trackOrder?: string) => {
    const pathMap: Record<RouteView, string> = {
      home: '/',
      wishlist: '/wishlist',
      track: '/track',
      admin: '/admin',
    };
    const nextPath = pathMap[target];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    if (trackOrder) {
      setTrackedOrderNumber(trackOrder);
    }
    setRoute(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePathRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const [authRes, bootRes] = await Promise.all([api.getAuthMe(), api.getBootstrap()]);
      setCustomer(authRes.customer);
      setAdmin(authRes.admin);
      setAdminInitialized(authRes.adminInitialized);
      setSuggestedAdminEmail(authRes.suggestedAdminEmail);

      setProducts(bootRes.products);
      setOffers(bootRes.offers);
      setPaymentSettings(bootRes.paymentSettings);
      setDefaultReturnAddress(bootRes.defaultReturnAddress);
      setWishlistIds(bootRes.wishlistIds);
    } catch {
      // Keep graceful UI if transient error occurs
    } finally {
      setLoadingStore(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handleToggleWishlist = async (productId: number) => {
    try {
      const res = await api.toggleWishlist(productId);
      setWishlistIds(res.wishlistIds);
      showToast(res.saved ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch {
      showToast('Unable to update wishlist');
    }
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(product.stock, i.quantity + 1) }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`Added "${product.title}" to bag`);
  };

  const handleBuyNow = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev;
      return [...prev, { product, quantity: 1 }];
    });
    setActiveProduct(null);
    setCheckoutOpen(true);
  };

  const handleUpdateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.min(item.product.stock, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleOrderSuccess = async (order: Order) => {
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    await loadBootstrap();
    showToast(`Order ${order.orderNumber} confirmed!`);
    navigate('track', order.orderNumber);
  };

  const handleCustomerLogout = async () => {
    await api.logoutCustomer().catch(() => {});
    setCustomerToken(null);
    setCustomer(null);
    showToast('Signed out');
  };

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      const matchesCat =
        selectedCategory === 'All' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    if (sortBy === 'price_asc') sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') sorted.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.id - a.id);
    return sorted;
  }, [products, searchQuery, selectedCategory, sortBy]);

  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Dedicated Admin Portal Website Route (/admin)
  if (route === 'admin') {
    if (!admin) {
      return (
        <AdminLogin
          adminInitialized={adminInitialized}
          suggestedEmail={suggestedAdminEmail}
          onSuccess={(loggedInAdmin) => {
            setAdmin(loggedInAdmin);
            setAdminInitialized(true);
          }}
          onBackToStorefront={() => {
            loadBootstrap();
            navigate('home');
          }}
        />
      );
    }

    return (
      <AdminPortal
        admin={admin}
        onLogout={() => {
          setAdmin(null);
        }}
        onOpenStorefront={() => {
          loadBootstrap();
          navigate('home');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-900">
      {/* Slim Top Offer Strip (<= 40px) */}
      {offers.length > 0 && (
        <div className="bg-slate-900 text-slate-100 text-xs py-2 px-4 text-center">
          <span>
            Active Offer: <strong className="font-mono text-amber-400">{offers[0].code}</strong> —{' '}
            {offers[0].description}
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded"
          >
            HOME MURT
          </button>

          {/* Zone 2: 5 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Main navigation">
            <button
              type="button"
              onClick={() => navigate('home')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                route === 'home' ? 'text-blue-700 font-semibold' : ''
              }`}
            >
              Shop
            </button>
            <button
              type="button"
              onClick={() => navigate('wishlist')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                route === 'wishlist' ? 'text-blue-700 font-semibold' : ''
              }`}
            >
              Wishlist ({wishlistIds.length})
            </button>
            <button
              type="button"
              onClick={() => navigate('track')}
              className={`whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors ${
                route === 'track' ? 'text-blue-700 font-semibold' : ''
              }`}
            >
              Track Order
            </button>
            {customer ? (
              <button
                type="button"
                onClick={handleCustomerLogout}
                className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
              >
                Sign Out ({customer.name.split(' ')[0]})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="whitespace-nowrap shrink-0 hover:text-slate-900 transition-colors"
              >
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('admin')}
              className="whitespace-nowrap shrink-0 text-slate-700 hover:text-blue-700 transition-colors"
            >
              Admin Portal
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open shopping bag with ${cartItemCount} items`}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              Bag ({cartItemCount})
            </button>
          </div>
        </div>

        {/* Mobile Secondary Quick Nav Row (kept compact) */}
        <nav
          className="flex md:hidden items-center justify-between px-4 py-1.5 border-t border-slate-100 text-xs font-medium text-slate-600 overflow-x-auto gap-4"
          aria-label="Mobile navigation"
        >
          <button type="button" onClick={() => navigate('home')} className="whitespace-nowrap shrink-0">
            Shop
          </button>
          <button type="button" onClick={() => navigate('wishlist')} className="whitespace-nowrap shrink-0">
            Wishlist ({wishlistIds.length})
          </button>
          <button type="button" onClick={() => navigate('track')} className="whitespace-nowrap shrink-0">
            Track Order
          </button>
          <button
            type="button"
            onClick={() => (customer ? handleCustomerLogout() : setAuthModalOpen(true))}
            className="whitespace-nowrap shrink-0"
          >
            {customer ? 'Sign Out' : 'Sign In'}
          </button>
          <button type="button" onClick={() => navigate('admin')} className="whitespace-nowrap shrink-0 text-blue-700">
            Admin
          </button>
        </nav>
      </header>

      <main className="flex-1">
        {route === 'track' && (
          <OrderTrackingView initialOrderNumber={trackedOrderNumber} customer={customer} />
        )}

        {route === 'wishlist' && (
          <WishlistView
            products={products}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onBrowseCatalog={() => navigate('home')}
          />
        )}

        {route === 'home' && (
          <>
            {/* Section 1: Storefront Hero Split */}
            <section className="bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                  <p className="text-xs font-semibold tracking-wide text-blue-700">
                    HOME MURT · Curated Everyday Marketplace
                  </p>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-[-0.02em] leading-[1.1] [text-wrap:balance]">
                    Thoughtful products for modern Indian homes.
                  </h1>
                  <p className="text-base text-slate-600 max-w-xl leading-relaxed">
                    Shop studio audio, kitchen hardware, artisan lighting, and apparel with live hub-by-hub shipment tracking, instant UPI QR checkout, and dedicated return support.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a
                      href="#catalog-section"
                      className="px-6 py-3 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      Explore Catalog
                    </a>
                    <button
                      type="button"
                      onClick={() => navigate('track')}
                      className="px-5 py-3 text-sm font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      Track Existing Order
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="h-64 sm:h-80 lg:h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                    <SafeImage
                      src="/src/assets/images/hero_home_murt_1795440015987.jpg"
                      alt="HOME MURT living room centerpiece collection"
                      fallbackTitle="HOME MURT Collection"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Search, Category Filters & Product Catalog Grid */}
            <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <label htmlFor="store-search" className="sr-only">
                      Search products
                    </label>
                    <input
                      id="store-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search headphones, espresso maker, ceramic lamp, brand..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="store-sort" className="text-xs font-semibold text-slate-600">
                      Sort:
                    </label>
                    <select
                      id="store-sort"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as 'featured' | 'price_asc' | 'price_desc' | 'rating'
                        )
                      }
                      className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      <option value="featured">Featured First</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating">Customer Rating</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loadingStore ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-slate-200 rounded-xl h-80 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                  <p className="text-base font-semibold text-slate-900">No matching products found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try clearing your search filter or switching categories.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-4 px-4 py-2 text-xs font-semibold bg-blue-700 text-white rounded-lg"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isWishlisted={wishlistIds.includes(product.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onAddToCart={handleAddToCart}
                      onOpenDetail={setActiveProduct}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Active Offers & Delivery/Return Assurance */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-700" />
                    <h2 className="text-lg font-bold text-slate-900">Current Store Offers</h2>
                  </div>
                  <div className="space-y-3">
                    {offers.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Check back soon for new seasonal promo codes.
                      </p>
                    ) : (
                      offers.map((offer) => (
                        <div
                          key={offer.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{offer.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{offer.description}</p>
                            <p className="text-xs text-slate-500 mt-1 tabular-nums">
                              Minimum order: {formatINR(offer.minOrderAmount)}
                            </p>
                          </div>
                          <span className="font-mono text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-blue-700 shrink-0">
                            {offer.code}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-6 space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    Transparent Shipping &amp; Returns
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
                      <Truck className="w-5 h-5 text-blue-700" />
                      <h3 className="text-sm font-semibold text-slate-900">Live Parcel Tracking</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Every order gets an instant Order ID with hub-by-hub location updates.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-700" />
                      <h3 className="text-sm font-semibold text-slate-900">UPI QR &amp; COD</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Pay seamlessly via the store UPI QR code or Cash on Delivery at checkout.
                      </p>
                    </div>
                  </div>
                  {defaultReturnAddress && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                      <p className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-700" />
                        Verified Return Center: {defaultReturnAddress.label}
                      </p>
                      <p className="text-slate-600">
                        {defaultReturnAddress.addressLine}, {defaultReturnAddress.city},{' '}
                        {defaultReturnAddress.state} - {defaultReturnAddress.pincode}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-900">HOME MURT · Modern Indian Retail</p>
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => navigate('home')} className="hover:text-slate-900">
              Catalog
            </button>
            <button type="button" onClick={() => navigate('track')} className="hover:text-slate-900">
              Track Order
            </button>
            <button type="button" onClick={() => navigate('wishlist')} className="hover:text-slate-900">
              Wishlist
            </button>
            <button type="button" onClick={() => navigate('admin')} className="hover:text-slate-900">
              Admin Portal
            </button>
          </div>
          <p>© {new Date().getFullYear()} HOME MURT. All rights reserved.</p>
        </div>
      </footer>

      {/* Modals & Drawers */}
      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          offers={offers}
          isWishlisted={wishlistIds.includes(activeProduct.id)}
          onClose={() => setActiveProduct(null)}
          onToggleWishlist={handleToggleWishlist}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
        />
      )}

      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveFromCart}
        onProceedToCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      {checkoutOpen && (
        <CheckoutModal
          items={cart}
          offers={offers}
          paymentSettings={paymentSettings}
          customer={customer}
          onClose={() => setCheckoutOpen(false)}
          onOrderSuccess={handleOrderSuccess}
        />
      )}

      {authModalOpen && (
        <CustomerAuthModal
          onClose={() => setAuthModalOpen(false)}
          onSuccess={(user) => {
            setCustomer(user);
            setAuthModalOpen(false);
            loadBootstrap();
            showToast(`Welcome, ${user.name}`);
          }}
        />
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
