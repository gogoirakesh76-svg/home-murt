import { useState } from 'react';
import { Check, Copy, CreditCard, QrCode, ShieldCheck, Tag, Truck, X } from 'lucide-react';
import { api } from '../lib/api';
import {
  computeCartTotals,
  formatINR,
  type AuthUser,
  type CartItem,
  type Offer,
  type Order,
  type PaymentMethod,
  type PaymentSettings,
} from '../shared/commerce';
import { SafeImage } from './SafeImage';

interface CheckoutModalProps {
  items: CartItem[];
  offers: Offer[];
  paymentSettings: PaymentSettings;
  customer: AuthUser | null;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
}

export function CheckoutModal({
  items,
  offers,
  paymentSettings,
  customer,
  onClose,
  onOrderSuccess,
}: CheckoutModalProps) {
  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerEmail, setCustomerEmail] = useState(customer?.email || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [couponInput, setCouponInput] = useState('');
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    paymentSettings.onlineEnabled ? 'ONLINE_QR' : 'COD'
  );
  const [transactionRef, setTransactionRef] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = computeCartTotals(
    items.map((item) => ({
      price: item.product.price,
      mrp: item.product.mrp,
      quantity: item.quantity,
    })),
    appliedOffer
  );

  const handleApplyCoupon = async (codeOverride?: string) => {
    const code = (codeOverride ?? couponInput).trim().toUpperCase();
    setCouponError(null);
    setCouponMessage(null);
    if (!code) {
      setAppliedOffer(null);
      return;
    }
    try {
      const res = await api.validateOffer(code, totals.subtotal);
      setAppliedOffer(res.offer);
      setCouponInput(res.offer.code);
      setCouponMessage(`Offer ${res.offer.code} applied — you save ${formatINR(res.discountAmount)}.`);
    } catch (err) {
      setAppliedOffer(null);
      setCouponError(err instanceof Error ? err.message : 'Unable to apply coupon.');
    }
  };

  const handleCopyUpi = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(paymentSettings.upiId).catch(() => {});
    }
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 1800);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createOrder({
        customerName,
        customerEmail,
        customerPhone,
        addressLine,
        city,
        state,
        pincode,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        couponCode: appliedOffer?.code || null,
        paymentMethod,
        transactionRef: paymentMethod === 'ONLINE_QR' ? transactionRef : undefined,
      });
      onOrderSuccess(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-heading"
    >
      <div className="bg-white rounded-2xl border border-slate-200 max-w-5xl w-full overflow-hidden shadow-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 id="checkout-heading" className="text-lg font-bold text-slate-900">
              HOME MURT Checkout
            </h2>
            <p className="text-xs text-slate-500">
              Complete shipping details, apply offers, and choose your payment method.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 max-h-[84vh] overflow-y-auto">
          <div className="lg:col-span-7 p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-slate-200">
            {/* Step 1: Shipping Address */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">1. Delivery Address</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="co-name" className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="co-name"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rakesh Sharma"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label htmlFor="co-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="co-phone"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-email" className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address (for order updates)
                  </label>
                  <input
                    id="co-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-addr" className="block text-xs font-medium text-slate-700 mb-1">
                    House / Street / Locality
                  </label>
                  <input
                    id="co-addr"
                    required
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="Flat, building, street name, landmark"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label htmlFor="co-city" className="block text-xs font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    id="co-city"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Guwahati"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="co-state" className="block text-xs font-medium text-slate-700 mb-1">
                      State
                    </label>
                    <input
                      id="co-state"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Assam"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="co-pin" className="block text-xs font-medium text-slate-700 mb-1">
                      Pincode
                    </label>
                    <input
                      id="co-pin"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="781005"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Step 2: Payment Method & Admin QR */}
            <section className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">2. Payment Method</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentSettings.onlineEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ONLINE_QR')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'ONLINE_QR'
                        ? 'border-blue-700 bg-blue-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Online Payment (UPI QR)</span>
                      <QrCode className="w-4 h-4 text-blue-700" />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Scan store QR via GPay, PhonePe, Paytm, or BHIM
                    </p>
                  </button>
                )}

                {paymentSettings.codEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'COD'
                        ? 'border-blue-700 bg-blue-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Cash on Delivery</span>
                      <Truck className="w-4 h-4 text-slate-700" />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Pay cash or UPI at your doorstep on delivery
                    </p>
                  </button>
                )}
              </div>

              {paymentMethod === 'ONLINE_QR' && (
                <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                    <div className="w-36 h-36 bg-white p-2 rounded-xl border border-slate-200 shrink-0 flex items-center justify-center">
                      <SafeImage
                        src={paymentSettings.qrImageUrl}
                        alt={`UPI Payment QR for ${paymentSettings.merchantName}`}
                        fallbackTitle="Payment QR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <p className="text-xs font-semibold text-slate-500">Pay to Merchant</p>
                      <p className="text-base font-bold text-slate-900">{paymentSettings.merchantName}</p>
                      <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-mono font-medium text-slate-800">
                          {paymentSettings.upiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          aria-label="Copy UPI ID"
                          className="text-blue-700 hover:text-blue-800"
                        >
                          {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {paymentSettings.instructions}
                      </p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        Amount to Pay: {formatINR(totals.grandTotal)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="co-utr" className="block text-xs font-semibold text-slate-800 mb-1">
                      UPI Transaction / UTR Reference ID
                    </label>
                    <input
                      id="co-utr"
                      required={paymentMethod === 'ONLINE_QR'}
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="Enter 12-digit UTR or Transaction Reference (e.g. 429811048219)"
                      className="w-full px-3 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Summary Column */}
          <div className="lg:col-span-5 p-6 bg-slate-50/70 flex flex-col justify-between gap-5">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Order Summary</h3>
                <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{product.title}</p>
                        <p className="text-slate-500 tabular-nums">
                          Qty {quantity} × {formatINR(product.price)}
                        </p>
                      </div>
                      <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                        {formatINR(product.price * quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <label htmlFor="co-coupon" className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-2">
                  <Tag className="w-3.5 h-3.5 text-blue-700" />
                  Apply Promo / Offer Code
                </label>
                <div className="flex gap-2">
                  <input
                    id="co-coupon"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. MURT15)"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                  >
                    Apply
                  </button>
                </div>

                {offers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {offers.map((offer) => (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => handleApplyCoupon(offer.code)}
                        className="text-xs font-mono text-blue-700 hover:underline px-1.5 py-0.5 bg-blue-50 rounded"
                      >
                        {offer.code}
                      </button>
                    ))}
                  </div>
                )}

                {couponMessage && <p className="mt-1.5 text-xs text-emerald-700 font-medium">{couponMessage}</p>}
                {couponError && <p className="mt-1.5 text-xs text-rose-600 font-medium">{couponError}</p>}
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2 text-sm tabular-nums">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span>{formatINR(totals.subtotal)}</span>
                </div>
                {totals.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Offer Discount ({appliedOffer?.code})</span>
                    <span>-{formatINR(totals.couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charges</span>
                  <span className={totals.deliveryFee === 0 ? 'text-emerald-700 font-medium' : ''}>
                    {totals.deliveryFee === 0 ? 'FREE' : formatINR(totals.deliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span>{formatINR(totals.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Placing Order...'
                  : paymentMethod === 'ONLINE_QR'
                  ? `Confirm Payment & Place Order (${formatINR(totals.grandTotal)})`
                  : `Place Order (${formatINR(totals.grandTotal)})`}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Live shipment tracking enabled immediately after order
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
