import { useState } from 'react';
import { MapPin, Truck } from 'lucide-react';
import { api } from '../../lib/api';
import {
  formatINR,
  ORDER_STAGES,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from '../../shared/commerce';

interface AdminOrdersProps {
  orders: Order[];
  onRefresh: () => Promise<void>;
}

const STATUS_OPTIONS: OrderStatus[] = [...ORDER_STAGES, 'Cancelled'];
const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  'Pending',
  'Verification Pending',
  'Verified',
  'Failed',
];

export function AdminOrders({ orders, onRefresh }: AdminOrdersProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(orders[0] || null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    orders[0]?.orderStatus || 'Order Placed'
  );
  const [currentLocation, setCurrentLocation] = useState(orders[0]?.currentLocation || '');
  const [estimatedDelivery, setEstimatedDelivery] = useState(orders[0]?.estimatedDelivery || '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    orders[0]?.paymentStatus || 'Pending'
  );
  const [trackingNote, setTrackingNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderStatus(order.orderStatus);
    setCurrentLocation(order.currentLocation);
    setEstimatedDelivery(order.estimatedDelivery);
    setPaymentStatus(order.paymentStatus);
    setTrackingNote('');
    setMessage(null);
  };

  const handleUpdateTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.updateOrderTracking(selectedOrder.id, {
        orderStatus,
        currentLocation,
        estimatedDelivery,
        paymentStatus,
        trackingNote,
      });
      setSelectedOrder(res.order);
      setTrackingNote('');
      setMessage(`Tracking checkpoint added for ${res.order.orderNumber}.`);
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Orders &amp; Live Shipment Tracking</h2>
        <p className="text-xs text-slate-500">
          Verify UPI QR payments, update parcel location/hub, and publish live tracking updates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status &amp; Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {orders.map((order) => {
                const active = selectedOrder?.id === order.id;
                return (
                  <tr
                    key={order.id}
                    className={`transition-colors ${active ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => selectOrder(order)}
                        className="text-blue-700 hover:underline font-semibold"
                      >
                        {order.orderNumber}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{order.customerName}</p>
                      <p className="text-slate-500">
                        {order.city}, {order.pincode}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                      {formatINR(order.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {order.paymentMethod === 'ONLINE_QR' ? 'UPI QR' : 'COD'}
                      </p>
                      <p className="text-slate-500">{order.paymentStatus}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{order.orderStatus}</p>
                      <p className="text-slate-500 truncate max-w-[160px]">{order.currentLocation}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-5">
          {selectedOrder ? (
            <form
              onSubmit={handleUpdateTracking}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono text-slate-500">Editing Order</span>
                  <h3 className="text-base font-bold text-slate-900">{selectedOrder.orderNumber}</h3>
                </div>
                <Truck className="w-5 h-5 text-blue-700" />
              </div>

              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p>
                  <strong className="text-slate-900">Ship To:</strong> {selectedOrder.customerName} (
                  {selectedOrder.customerPhone})
                </p>
                <p>
                  {selectedOrder.addressLine}, {selectedOrder.city}, {selectedOrder.state} -{' '}
                  {selectedOrder.pincode}
                </p>
                {selectedOrder.transactionRef && (
                  <p className="font-mono text-slate-800 pt-1">
                    <strong>Submitted UPI Ref:</strong> {selectedOrder.transactionRef}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adm-ord-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Shipment Stage
                  </label>
                  <select
                    id="adm-ord-status"
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="adm-pay-status" className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Verification
                  </label>
                  <select
                    id="adm-pay-status"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    {PAYMENT_STATUS_OPTIONS.map((ps) => (
                      <option key={ps} value={ps}>
                        {ps}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="adm-ord-loc" className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Location / Hub (Visible to Customer)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="adm-ord-loc"
                    required
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value)}
                    placeholder="e.g. Dispatched from Guwahati Hub"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="adm-ord-eta" className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Delivery Text
                </label>
                <input
                  id="adm-ord-eta"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  placeholder="e.g. Arriving Tomorrow by 6 PM"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label htmlFor="adm-ord-note" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tracking Log Note
                </label>
                <input
                  id="adm-ord-note"
                  value={trackingNote}
                  onChange={(e) => setTrackingNote(e.target.value)}
                  placeholder="e.g. Scanned at sorting hub and loaded for local delivery."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              {message && <p className="text-xs text-emerald-700 font-medium">{message}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Publish Live Tracking Update'}
              </button>
            </form>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Select an order from the table to update tracking location and payment status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
