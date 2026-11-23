import { useState } from 'react';
import { Check, Heart, ShieldCheck, ShoppingBag, Star, Truck, X, Zap } from 'lucide-react';
import { calculateDiscountPercent, formatINR, type Offer, type Product } from '../shared/commerce';
import { SafeImage } from './SafeImage';

interface ProductDetailModalProps {
  product: Product;
  offers: Offer[];
  isWishlisted: boolean;
  onClose: () => void;
  onToggleWishlist: (productId: number) => void;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
}

export function ProductDetailModal({
  product,
  offers,
  isWishlisted,
  onClose,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
}: ProductDetailModalProps) {
  const [pincode, setPincode] = useState('');
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);
  const discountPct = calculateDiscountPercent(product.mrp, product.price);

  const checkPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pincode.trim())) {
      setDeliveryMsg(`Delivery available to ${pincode.trim()} — Estimated 2–4 business days (Free above ₹999).`);
    } else {
      setDeliveryMsg('Please enter a valid 6-digit Indian pincode.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full overflow-hidden shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-800">{product.brand}</span>
            <span aria-hidden="true">/</span>
            <span>{product.category}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="bg-slate-50 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200">
              <SafeImage
                src={product.imageUrl}
                alt={product.title}
                fallbackTitle={product.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-600 pt-3 border-t border-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                7-Day Easy Returns
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-700" />
                Live Order Tracking
              </span>
            </div>
          </div>

          <div className="p-6 flex flex-col justify-between gap-5 max-h-[80vh] overflow-y-auto">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 id="pdp-title" className="text-xl font-bold text-slate-900 leading-snug">
                  {product.title}
                </h2>
                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                    isWishlisted
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-slate-200 text-slate-500 hover:text-rose-600'
                  }`}
                >
                  <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-slate-600 tabular-nums">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                  <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                  {product.rating.toFixed(1)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{product.reviewCount} Verified Reviews</span>
                <span aria-hidden="true">·</span>
                <span className={product.stock > 0 ? 'text-emerald-700 font-medium' : 'text-rose-600 font-medium'}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>

              <div className="mt-4 pb-4 border-b border-slate-100 flex items-baseline gap-3 tabular-nums">
                <span className="text-2xl font-bold text-slate-900">{formatINR(product.price)}</span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-sm text-slate-400 line-through">{formatINR(product.mrp)}</span>
                    <span className="text-sm font-semibold text-emerald-700">{discountPct}% off</span>
                  </>
                )}
              </div>

              <p className="mt-4 text-sm text-slate-600 leading-relaxed">{product.description}</p>

              {offers.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-900 mb-2">Available Offers</p>
                  <ul className="space-y-1.5">
                    {offers.slice(0, 3).map((offer) => (
                      <li key={offer.id} className="text-xs text-slate-600 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
                        <span>
                          <strong className="font-mono text-slate-900">{offer.code}</strong> — {offer.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={checkPincode} className="mt-4 pt-3 border-t border-slate-100">
                <label htmlFor="pdp-pincode" className="block text-xs font-semibold text-slate-900 mb-1.5">
                  Check Delivery Availability
                </label>
                <div className="flex gap-2">
                  <input
                    id="pdp-pincode"
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="Enter 6-digit pincode (e.g. 781005)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Check
                  </button>
                </div>
                {deliveryMsg && <p className="mt-1.5 text-xs text-slate-600">{deliveryMsg}</p>}
              </form>

              {product.specs.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-900 mb-2">Specifications</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {product.specs.map((spec, idx) => (
                      <div key={idx}>
                        <dt className="text-slate-500">{spec.label}</dt>
                        <dd className="font-medium text-slate-900">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center gap-3">
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => {
                  onAddToCart(product);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg border border-blue-700 text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                Add to Cart
              </button>
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => {
                  onBuyNow(product);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
