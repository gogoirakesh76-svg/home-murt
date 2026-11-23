import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { formatINR, type Product } from '../shared/commerce';
import { SafeImage } from './SafeImage';

interface WishlistViewProps {
  products: Product[];
  wishlistIds: number[];
  onToggleWishlist: (productId: number) => void;
  onAddToCart: (product: Product) => void;
  onBrowseCatalog: () => void;
}

export function WishlistView({
  products,
  wishlistIds,
  onToggleWishlist,
  onAddToCart,
  onBrowseCatalog,
}: WishlistViewProps) {
  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Wishlist</h1>
          <p className="mt-1 text-sm text-slate-600">
            {savedProducts.length} saved {savedProducts.length === 1 ? 'item' : 'items'} synced to your session
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowseCatalog}
          className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-white"
        >
          Continue Shopping
        </button>
      </div>

      {savedProducts.length === 0 ? (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-slate-900">No items in your wishlist yet</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Tap the heart icon on any product card to save items for later comparison.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="mt-5 px-5 py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800"
          >
            Explore Catalog
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-100">
                <SafeImage
                  src={product.imageUrl}
                  alt={product.title}
                  fallbackTitle={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {product.brand} · {product.category}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{product.title}</h3>
                  <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                    {formatINR(product.price)}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={product.stock <= 0}
                    onClick={() => onAddToCart(product)}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Move to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(product.id)}
                    aria-label={`Remove ${product.title} from wishlist`}
                    className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
