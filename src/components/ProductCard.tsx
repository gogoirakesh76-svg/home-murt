import { Heart, ShoppingBag, Star } from 'lucide-react';
import { calculateDiscountPercent, formatINR, type Product } from '../shared/commerce';
import { SafeImage } from './SafeImage';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (productId: number) => void;
  onAddToCart: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
}

export function ProductCard({
  product,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onOpenDetail,
}: ProductCardProps) {
  const discountPct = calculateDiscountPercent(product.mrp, product.price);
  const outOfStock = product.stock <= 0;

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenDetail(product)}
          aria-label={`View details for ${product.title}`}
          className="w-full h-full block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          <SafeImage
            src={product.imageUrl}
            alt={product.title}
            fallbackTitle={product.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        <button
          type="button"
          onClick={() => onToggleWishlist(product.id)}
          aria-label={
            isWishlisted
              ? `Remove ${product.title} from wishlist`
              : `Add ${product.title} to wishlist`
          }
          aria-pressed={isWishlisted}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
            isWishlisted
              ? 'bg-white border-rose-200 text-rose-600 shadow-sm'
              : 'bg-white/90 border-slate-200 text-slate-600 hover:text-rose-600'
          }`}
        >
          <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700 truncate">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.category}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-0.5 text-slate-700 font-medium tabular-nums">
              <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
              {product.rating.toFixed(1)}
            </span>
          </div>

          <h3 className="mt-1.5 text-base font-semibold text-slate-900 leading-snug line-clamp-2">
            <button
              type="button"
              onClick={() => onOpenDetail(product)}
              className="text-left hover:text-blue-700 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {product.title}
            </button>
          </h3>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-lg font-bold text-slate-900">{formatINR(product.price)}</span>
              {product.mrp > product.price && (
                <span className="text-xs text-slate-400 line-through">{formatINR(product.mrp)}</span>
              )}
            </div>
            {discountPct > 0 && (
              <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                {discountPct}% off
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAddToCart(product)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <button
              type="button"
              onClick={() => onOpenDetail(product)}
              className="px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Details
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
