import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  LogOut,
  Package,
  QrCode,
  RotateCcw,
  Store,
  Tag,
  Truck,
} from 'lucide-react';
import { api, setAdminToken, type AdminDashboardResponse } from '../../lib/api';
import { formatINR, type AuthUser } from '../../shared/commerce';
import { AdminOffers } from './AdminOffers';
import { AdminOrders } from './AdminOrders';
import { AdminPaymentQR } from './AdminPaymentQR';
import { AdminProducts } from './AdminProducts';
import { AdminReturns } from './AdminReturns';

type AdminTab = 'overview' | 'orders' | 'products' | 'returns' | 'offers' | 'qr';

interface AdminPortalProps {
  admin: AuthUser;
  onLogout: () => void;
  onOpenStorefront: () => void;
}

export function AdminPortal({ admin, onLogout, onOpenStorefront }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getAdminDashboard();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSignOut = async () => {
    await api.logoutAdmin().catch(() => {});
    setAdminToken(null);
    onLogout();
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders & Tracking', icon: Truck },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'returns', label: 'Returns & Addresses', icon: RotateCcw },
    { id: 'offers', label: 'Offers & Coupons', icon: Tag },
    { id: 'qr', label: 'Payment QR Setup', icon: QrCode },
  ];

  const activeTitle = navItems.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-base font-bold tracking-tight text-white">HOME MURT</p>
            <p className="text-xs text-slate-400">Admin Operations</p>
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Admin navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-800 hidden lg:block space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-white truncate">{admin.name}</p>
            <p className="text-slate-400 truncate">{admin.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>HOME MURT Admin</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900">{activeTitle}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenStorefront}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Store className="w-3.5 h-3.5" />
              View Storefront
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {loading && !data ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Loading admin workspace...
            </div>
          ) : error ? (
            <div className="bg-white border border-rose-200 rounded-xl p-6 text-sm text-rose-700">
              {error}
            </div>
          ) : data ? (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">Store Operations Overview</h1>
                    <p className="text-xs text-slate-500">
                      Real-time metrics across orders, shipments, catalog inventory, and returns.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Total Revenue</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                        {formatINR(data.kpis.totalRevenue)}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Active Shipments</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-blue-700 tabular-nums">
                        {data.kpis.activeOrdersCount}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Catalog Products</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                        {data.kpis.totalProducts}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Pending Returns</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-amber-600 tabular-nums">
                        {data.kpis.pendingReturnsCount}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-900">Recent Orders</h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('orders')}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Manage Tracking
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-2 pr-3">Order ID</th>
                              <th className="py-2 pr-3">Customer</th>
                              <th className="py-2 pr-3">Current Hub</th>
                              <th className="py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.orders.slice(0, 6).map((ord) => (
                              <tr key={ord.id}>
                                <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">
                                  {ord.orderNumber}
                                </td>
                                <td className="py-2.5 pr-3 text-slate-700">{ord.customerName}</td>
                                <td className="py-2.5 pr-3 text-slate-600">
                                  {ord.orderStatus} · {ord.currentLocation}
                                </td>
                                <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                                  {formatINR(ord.totalAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <h2 className="text-sm font-bold text-slate-900">Quick Operations</h2>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('products')}
                          className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          + Add New Product to Catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('qr')}
                          className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Configure Online Payment QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('returns')}
                          className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Manage Return Warehouse Addresses
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('offers')}
                          className="w-full text-left px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Create Storefront Discount Offer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && <AdminOrders orders={data.orders} onRefresh={refresh} />}
              {activeTab === 'products' && <AdminProducts products={data.products} onRefresh={refresh} />}
              {activeTab === 'returns' && (
                <AdminReturns
                  returnAddresses={data.returnAddresses}
                  returnRequests={data.returnRequests}
                  onRefresh={refresh}
                />
              )}
              {activeTab === 'offers' && <AdminOffers offers={data.offers} onRefresh={refresh} />}
              {activeTab === 'qr' && (
                <AdminPaymentQR paymentSettings={data.paymentSettings} onRefresh={refresh} />
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
