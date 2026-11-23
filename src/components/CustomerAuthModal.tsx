import { useState } from 'react';
import { X } from 'lucide-react';
import { api, setCustomerToken } from '../lib/api';
import type { AuthUser } from '../shared/commerce';

interface CustomerAuthModalProps {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export function CustomerAuthModal({ onClose, onSuccess }: CustomerAuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.loginCustomer({ email, password });
        setCustomerToken(res.token);
        onSuccess(res.user);
      } else {
        const res = await api.registerCustomer({ name, email, phone, password });
        setCustomerToken(res.token);
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-auth-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="customer-auth-title" className="text-lg font-bold text-slate-900">
            {mode === 'login' ? 'Sign In to HOME MURT' : 'Create Customer Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
              <div>
                <label htmlFor="auth-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  id="auth-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
            {mode === 'login' ? (
              <>
                New to HOME MURT?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-blue-700 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
