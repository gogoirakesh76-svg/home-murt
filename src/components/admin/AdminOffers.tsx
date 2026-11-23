import { useState } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatINR, type Offer } from '../../shared/commerce';

interface AdminOffersProps {
  offers: Offer[];
  onRefresh: () => Promise<void>;
}

export function AdminOffers({ offers, onRefresh }: AdminOffersProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxDiscount, setMaxDiscount] = useState('1000');
  const [minOrderAmount, setMinOrderAmount] = useState('999');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createOffer({
        code,
        title,
        description,
        discountType,
        discountValue: Number(discountValue),
        maxDiscount: Number(maxDiscount) || 0,
        minOrderAmount: Number(minOrderAmount) || 0,
        expiresAt: null,
      });
      setCode('');
      setTitle('');
      setDescription('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create offer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Storefront Offers &amp; Promo Codes</h2>
        <p className="text-xs text-slate-500">
          Create percentage or flat discount codes that customers apply at checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Plus className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">Create New Offer</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="off-code" className="block text-xs font-semibold text-slate-700 mb-1">
                Promo Code
              </label>
              <input
                id="off-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="FESTIVE20"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="off-type" className="block text-xs font-semibold text-slate-700 mb-1">
                Discount Type
              </label>
              <select
                id="off-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value === 'flat' ? 'flat' : 'percent')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label htmlFor="off-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Headline Title
              </label>
              <input
                id="off-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Festive 20% Off Everything"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="off-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <input
                id="off-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Save 20% up to ₹1,000 on orders ₹999+"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="off-val" className="block text-xs font-semibold text-slate-700 mb-1">
                {discountType === 'percent' ? 'Percent (%)' : 'Flat Discount (₹)'}
              </label>
              <input
                id="off-val"
                type="number"
                required
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="off-max" className="block text-xs font-semibold text-slate-700 mb-1">
                Max Cap (₹)
              </label>
              <input
                id="off-max"
                type="number"
                min={0}
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="off-min" className="block text-xs font-semibold text-slate-700 mb-1">
                Minimum Order Amount (₹)
              </label>
              <input
                id="off-min"
                type="number"
                min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Publish Offer'}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-700" />
                  <span className="font-mono text-sm font-bold text-slate-900">{offer.code}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span
                    className={`text-xs font-semibold ${
                      offer.isActive ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {offer.isActive ? 'Active on Storefront' : 'Paused'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
                <p className="text-xs text-slate-600">{offer.description}</p>
                <p className="text-xs font-mono text-slate-500 tabular-nums">
                  {offer.discountType === 'percent'
                    ? `${offer.discountValue}% off (cap ${formatINR(offer.maxDiscount)})`
                    : `${formatINR(offer.discountValue)} flat off`}{' '}
                  · Min order {formatINR(offer.minOrderAmount)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await api.toggleOffer(offer.id, !offer.isActive);
                    await onRefresh();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {offer.isActive ? 'Pause' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await api.deleteOffer(offer.id);
                    await onRefresh();
                  }}
                  aria-label={`Delete offer ${offer.code}`}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
