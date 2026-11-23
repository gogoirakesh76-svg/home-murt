import { useState } from 'react';
import { QrCode, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import type { PaymentSettings } from '../../shared/commerce';
import { SafeImage } from '../SafeImage';

interface AdminPaymentQRProps {
  paymentSettings: PaymentSettings;
  onRefresh: () => Promise<void>;
}

export function AdminPaymentQR({ paymentSettings, onRefresh }: AdminPaymentQRProps) {
  const [upiId, setUpiId] = useState(paymentSettings.upiId);
  const [merchantName, setMerchantName] = useState(paymentSettings.merchantName);
  const [qrImageUrl, setQrImageUrl] = useState(paymentSettings.qrImageUrl);
  const [instructions, setInstructions] = useState(paymentSettings.instructions);
  const [onlineEnabled, setOnlineEnabled] = useState(paymentSettings.onlineEnabled);
  const [codEnabled, setCodEnabled] = useState(paymentSettings.codEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('QR image file must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQrImageUrl(reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.updatePaymentSettings({
        upiId,
        merchantName,
        qrImageUrl,
        instructions,
        onlineEnabled,
        codEnabled,
      });
      await onRefresh();
      setMessage('Payment QR & UPI settings saved. Customers will see this QR at checkout immediately.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save payment settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Online Payment QR &amp; UPI Settings</h2>
        <p className="text-xs text-slate-500">
          Upload your own UPI / Bank QR code image. Whenever a customer selects Online Payment at checkout, this QR is displayed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="qr-merchant" className="block text-xs font-semibold text-slate-700 mb-1">
                Merchant / Payee Name
              </label>
              <input
                id="qr-merchant"
                required
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="qr-upi" className="block text-xs font-semibold text-slate-700 mb-1">
                UPI ID (VPA)
              </label>
              <input
                id="qr-upi"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="rakeshgogoi@okicici"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="qr-url" className="block text-xs font-semibold text-slate-700 mb-1">
              Upload Your Payment QR Image (PNG / JPG / WebP) or Enter Image URL
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="qr-url"
                required
                value={qrImageUrl}
                onChange={(e) => setQrImageUrl(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                Upload QR File
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleQrFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="qr-instr" className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Payment Instructions
            </label>
            <textarea
              id="qr-instr"
              rows={3}
              required
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={onlineEnabled}
                onChange={(e) => setOnlineEnabled(e.target.checked)}
              />
              Enable Online QR Payment at Checkout
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={codEnabled}
                onChange={(e) => setCodEnabled(e.target.checked)}
              />
              Enable Cash on Delivery (COD)
            </label>
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          {message && <p className="text-xs text-emerald-700 font-medium">{message}</p>}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving QR Settings...' : 'Save Payment QR Settings'}
          </button>
        </form>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <QrCode className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">Live Customer Checkout Preview</h3>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center space-y-3">
            <div className="w-48 h-48 bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center">
              <SafeImage
                src={qrImageUrl}
                alt={`Preview QR for ${merchantName}`}
                fallbackTitle="QR Preview"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{merchantName}</p>
              <p className="text-xs font-mono text-blue-700 mt-0.5">{upiId}</p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{instructions}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
