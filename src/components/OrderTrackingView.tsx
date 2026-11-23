import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  PackageCheck,
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  formatINR,
  getTrackingStageIndex,
  ORDER_STAGES,
  type AuthUser,
  type Order,
  type ReturnAddress,
} from '../shared/commerce';
import { SafeImage } from './SafeImage';

interface OrderTrackingViewProps {
  initialOrderNumber?: string | null;
  customer: AuthUser | null;
}

export function OrderTrackingView({ initialOrderNumber, customer }: OrderTrackingViewProps) {
  const [searchId, setSearchId] = useState(initialOrderNumber || 'HM-1001');
  const [order, setOrder] = useState<Order | null>(null);
  const [defaultReturnAddress, setDefaultReturnAddress] = useState<ReturnAddress | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);

  const fetchOrder = async (orderNumber: string) => {
    const clean = orderNumber.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setReturnError(null);
    setReturnSuccess(null);
    try {
      const res = await api.trackOrder(clean);
      setOrder(res.order);
      setDefaultReturnAddress(res.defaultReturnAddress);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : 'Order not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber) {
      setSearchId(initialOrderNumber);
      fetchOrder(initialOrderNumber);
    } else {
      fetchOrder('HM-1001');
    }
  }, [initialOrderNumber]);

  useEffect(() => {
    if (!customer) {
      setMyOrders([]);
      return;
    }
    api
      .getMyOrders()
      .then((res) => setMyOrders(res.orders))
      .catch(() => setMyOrders([]));
  }, [customer]);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setReturnSubmitting(true);
    setReturnError(null);
    setReturnSuccess(null);
    try {
      const res = await api.requestReturn(order.orderNumber, returnReason);
      setOrder({ ...order, returnRequest: res.returnRequest });
      setReturnReason('');
      setReturnSuccess('Return request submitted. Dispatch instructions and pickup address are shown below.');
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Unable to submit return request.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const activeStageIdx = order ? getTrackingStageIndex(order.orderStatus) : -1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Track Your Order</h1>
            <p className="mt-1 text-sm text-slate-600">
              Enter your HOME MURT Order ID (for example <span className="font-mono font-medium">HM-1001</span> or{' '}
              <span className="font-mono font-medium">HM-1002</span>) to see live hub location and shipment timeline.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchOrder(searchId);
            }}
            className="flex gap-2 w-full md:w-auto"
          >
            <label htmlFor="track-order-input" className="sr-only">
              Order ID
            </label>
            <input
              id="track-order-input"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Order ID (e.g. HM-1001)"
              className="flex-1 md:w-64 px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Search className="w-4 h-4" />
              Track
            </button>
          </form>
        </div>

        {myOrders.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Your Recent Orders</p>
            <div className="flex flex-wrap gap-2">
              {myOrders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setSearchId(o.orderNumber);
                    fetchOrder(o.orderNumber);
                  }}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                    order?.orderNumber === o.orderNumber
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {o.orderNumber} · {o.orderStatus}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Loading shipment details...
        </div>
      )}

      {error && !loading && (
        <div className="bg-white border border-rose-200 rounded-2xl p-6 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {order && !loading && (
        <div className="space-y-6">
          {/* Status & Flipkart-style 5-Stage Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900">{order.orderNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span>Placed on {new Date(order.createdAt).toLocaleDateString('en-IN')}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {order.paymentMethod === 'ONLINE_QR' ? 'Online UPI QR' : 'Cash on Delivery'} (
                    {order.paymentStatus})
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {order.orderStatus === 'Cancelled'
                    ? 'Order Cancelled'
                    : `Status: ${order.orderStatus}`}
                </h2>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-500">Current Parcel Location</p>
                <p className="text-sm font-semibold text-blue-700 inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {order.currentLocation}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{order.estimatedDelivery}</p>
              </div>
            </div>

            {order.orderStatus !== 'Cancelled' && (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {ORDER_STAGES.map((stage, idx) => {
                  const completed = idx <= activeStageIdx;
                  const isCurrent = idx === activeStageIdx;
                  return (
                    <div
                      key={stage}
                      className={`p-3 rounded-xl border ${
                        isCurrent
                          ? 'border-blue-700 bg-blue-50/70'
                          : completed
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            completed ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          0{idx + 1}
                        </span>
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Truck className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <p
                        className={`text-xs font-semibold ${
                          completed ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {stage}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tracking Checkpoints Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              <div className="lg:col-span-7">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Shipment Activity Log</h3>
                <ol className="space-y-4 border-l border-slate-200 ml-2 pl-5">
                  {(order.trackingEvents || []).slice().reverse().map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-blue-700 ring-4 ring-white" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {ev.status} — <span className="text-blue-700">{ev.location}</span>
                        </p>
                        <time className="text-xs font-mono text-slate-500 tabular-nums">
                          {new Date(ev.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{ev.note}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h3 className="text-xs font-bold text-slate-900">Delivery Address</h3>
                  <p className="text-sm font-semibold text-slate-900">{order.customerName}</p>
                  <p className="text-xs text-slate-600">
                    {order.addressLine}, {order.city}, {order.state} - {order.pincode}
                  </p>
                  <p className="text-xs font-mono text-slate-600">Phone: {order.customerPhone}</p>
                  {order.transactionRef && (
                    <p className="text-xs font-mono text-slate-600 pt-1 border-t border-slate-200">
                      UPI Ref: {order.transactionRef}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <h3 className="text-xs font-bold text-slate-900">Items in Parcel</h3>
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <SafeImage
                          src={item.imageUrl}
                          alt={item.title}
                          fallbackTitle={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          Qty {item.quantity} · {formatINR(item.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-900 tabular-nums">
                    <span>Total Paid</span>
                    <span>{formatINR(order.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Return & Return Warehouse Address Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">Return &amp; Replacement Desk</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Need to return or replace an item? Submit a request and send or hand over the parcel to our designated Return Hub address below.
              </p>
              {defaultReturnAddress && (
                <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                  <p className="font-bold text-slate-900">{defaultReturnAddress.label}</p>
                  <p className="text-slate-700">{defaultReturnAddress.recipientName}</p>
                  <p className="text-slate-600">
                    {defaultReturnAddress.addressLine}, {defaultReturnAddress.city},{' '}
                    {defaultReturnAddress.state} - {defaultReturnAddress.pincode}
                  </p>
                  <p className="font-mono text-slate-600">Desk Phone: {defaultReturnAddress.phone}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              {order.returnRequest ? (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <PackageCheck className="w-4 h-4 text-blue-700" />
                      Return Status: {order.returnRequest.status}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {new Date(order.returnRequest.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    <strong>Reason:</strong> {order.returnRequest.reason}
                  </p>
                  <p className="text-xs text-slate-600">
                    <strong>Return Address:</strong> {order.returnRequest.returnAddressSnapshot}
                  </p>
                  {order.returnRequest.adminNote && (
                    <p className="text-xs text-blue-800 font-medium">
                      <strong>Store Note:</strong> {order.returnRequest.adminNote}
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitReturn} className="space-y-3">
                  <label htmlFor="return-reason" className="block text-xs font-semibold text-slate-900">
                    Request Return for {order.orderNumber}
                  </label>
                  <textarea
                    id="return-reason"
                    rows={3}
                    required
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Describe why you want to return or exchange (e.g., wrong size, damaged box)..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  {returnError && <p className="text-xs text-rose-600 font-medium">{returnError}</p>}
                  {returnSuccess && <p className="text-xs text-emerald-700 font-medium">{returnSuccess}</p>}
                  <button
                    type="submit"
                    disabled={returnSubmitting}
                    className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {returnSubmitting ? 'Submitting...' : 'Submit Return Request'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
