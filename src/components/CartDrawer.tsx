import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  computeCartTotals,
  formatINR,
  FREE_DELIVERY_THRESHOLD,
  type CartItem,
} from '../shared/commerce';
import { SafeImage } from './SafeImage';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  open,
  items,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onProceedToCheckout,
}: CartDrawerProps) {
  if (!open) return null;

  const totals = computeCartTotals(
    items.map((item) => ({
      price: item.product.price,
      mrp: item.product.mrp,
      quantity: item.quantity,
    }))
  );
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - totals.subtotal);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart"
    >
      <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-700" />
            <h2 className="text-lg font-bold text-slate-900">
              Shopping Bag ({items.reduce((acc, i) => acc + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shopping bag"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-700">
            {remainingForFreeDelivery === 0 ? (
              <span className="text-emerald-700 font-medium">
                You unlocked FREE Delivery on this order.
              </span>
            ) : (
              <span>
                Add <strong>{formatINR(remainingForFreeDelivery)}</strong> more for FREE Delivery.
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
              <p className="text-base font-semibold text-slate-900">Your bag is empty</p>
              <p className="mt-1 text-sm text-slate-500 max-w-xs">
                Browse curated electronics, home living, and lifestyle products to get started.
              </p>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-3 pb-4 border-b border-slate-100 last:border-b-0"
              >
                <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                  <SafeImage
                    src={product.imageUrl}
                    alt={product.title}
                    fallbackTitle={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{product.title}</h3>
                  <p className="text-xs text-slate-500">{product.brand}</p>
                  <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
                    <span className="text-sm font-bold text-slate-900">
                      {formatINR(product.price * quantity)}
                    </span>
                    {product.mrp > product.price && (
                      <span className="text-xs text-slate-400 line-through">
                        {formatINR(product.mrp * quantity)}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="inline-flex items-center border border-slate-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(product.id, -1)}
                        aria-label={`Decrease quantity of ${product.title}`}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(product.id, 1)}
                        disabled={quantity >= product.stock}
                        aria-label={`Increase quantity of ${product.title}`}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(product.id)}
                      aria-label={`Remove ${product.title} from bag`}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-3">
            <div className="space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatINR(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee</span>
                <span className={totals.deliveryFee === 0 ? 'text-emerald-700 font-medium' : ''}>
                  {totals.deliveryFee === 0 ? 'FREE' : formatINR(totals.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Payable</span>
                <span>{formatINR(totals.grandTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToCheckout}
              className="w-full py-3 px-4 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
