import { useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { api, setAdminToken } from '../../lib/api';
import type { AuthUser } from '../../shared/commerce';

interface AdminLoginProps {
  adminInitialized: boolean;
  suggestedEmail: string;
  onSuccess: (admin: AuthUser) => void;
  onBackToStorefront: () => void;
}

export function AdminLogin({
  adminInitialized,
  suggestedEmail,
  onSuccess,
  onBackToStorefront,
}: AdminLoginProps) {
  const [email, setEmail] = useState(suggestedEmail || 'rakeshgogoi9988@gmail.com');
  const [name, setName] = useState('Rakesh Gogoi');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminInitialized) {
      if (password.length < 6) {
        setError('Admin password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (!adminInitialized) {
        const res = await api.claimAdmin({ email, name, password });
        setAdminToken(res.token);
        onSuccess(res.admin);
      } else {
        const res = await api.loginAdmin({ email, password });
        setAdminToken(res.token);
        onSuccess(res.admin);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToStorefront}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to HOME MURT Storefront
          </button>
          <span className="text-xs font-mono font-semibold text-slate-500">ADMIN PORTAL</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              {adminInitialized ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {adminInitialized ? 'HOME MURT Admin Sign In' : 'Claim Store Admin Account'}
              </h1>
              <p className="text-xs text-slate-500">
                {adminInitialized
                  ? 'Manage products, orders, tracking hubs, returns, offers, and Payment QR.'
                  : 'First-time setup: claim your admin credentials to lock this portal.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!adminInitialized && (
              <div>
                <label htmlFor="admin-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Name
                </label>
                <input
                  id="admin-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rakeshgogoi9988@gmail.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-700 mb-1">
                {adminInitialized ? 'Admin Password' : 'Create Admin Password'}
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {!adminInitialized && (
              <div>
                <label
                  htmlFor="admin-confirm-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Confirm Admin Password
                </label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter admin password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {loading
                ? 'Verifying...'
                : adminInitialized
                ? 'Sign In to Admin Panel'
                : 'Claim Admin Access & Open Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
