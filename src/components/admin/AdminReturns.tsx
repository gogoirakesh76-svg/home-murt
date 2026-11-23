import { useState } from 'react';
import { Check, MapPin, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { ReturnAddress, ReturnRequest, ReturnStatus } from '../../shared/commerce';

interface AdminReturnsProps {
  returnAddresses: ReturnAddress[];
  returnRequests: ReturnRequest[];
  onRefresh: () => Promise<void>;
}

const RETURN_STATUSES: ReturnStatus[] = [
  'Requested',
  'Approved',
  'Pickup Scheduled',
  'Completed',
  'Rejected',
];

export function AdminReturns({ returnAddresses, returnRequests, onRefresh }: AdminReturnsProps) {
  const [label, setLabel] = useState('');
  const [recipientName, setRecipientName] = useState('HOME MURT Returns Desk');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  const [noteById, setNoteById] = useState<Record<number, string>>({});
  const [statusById, setStatusById] = useState<Record<number, ReturnStatus>>({});

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddr(true);
    setAddrError(null);
    try {
      await api.createReturnAddress({
        label,
        recipientName,
        phone,
        addressLine,
        city,
        state,
        pincode,
        isDefault,
      });
      setLabel('');
      setPhone('');
      setAddressLine('');
      setCity('');
      setState('');
      setPincode('');
      await onRefresh();
    } catch (err) {
      setAddrError(err instanceof Error ? err.message : 'Unable to save return address.');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleUpdateReturn = async (req: ReturnRequest) => {
    const nextStatus = statusById[req.id] || req.status;
    const nextNote = noteById[req.id] !== undefined ? noteById[req.id] : req.adminNote;
    await api.updateReturnRequest(req.id, { status: nextStatus, adminNote: nextNote });
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Returns &amp; Return Warehouse Addresses</h2>
        <p className="text-xs text-slate-500">
          Configure where returned parcels are shipped and approve or schedule customer return requests.
        </p>
      </div>

      {/* Return Addresses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAddAddress}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Plus className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">Add Return Address</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label htmlFor="ret-label" className="block text-xs font-semibold text-slate-700 mb-1">
                Hub / Warehouse Label
              </label>
              <input
                id="ret-label"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. East Zone Returns Hub"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="ret-rec" className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Name
              </label>
              <input
                id="ret-rec"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="ret-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                id="ret-phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98640..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="ret-line" className="block text-xs font-semibold text-slate-700 mb-1">
                Street / Warehouse Address
              </label>
              <input
                id="ret-line"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Plot, street, industrial park"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="ret-city" className="block text-xs font-semibold text-slate-700 mb-1">
                City
              </label>
              <input
                id="ret-city"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="ret-state" className="block text-xs font-semibold text-slate-700 mb-1">
                State
              </label>
              <input
                id="ret-state"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="ret-pin" className="block text-xs font-semibold text-slate-700 mb-1">
                Pincode
              </label>
              <input
                id="ret-pin"
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Set as default return hub
              </label>
            </div>
          </div>

          {addrError && <p className="text-xs text-rose-600">{addrError}</p>}

          <button
            type="submit"
            disabled={savingAddr}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {savingAddr ? 'Saving...' : 'Save Return Address'}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-3">
          {returnAddresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${
                addr.isDefault ? 'border-blue-700' : 'border-slate-200'
              }`}
            >
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-700" />
                  <span className="text-sm font-bold text-slate-900">{addr.label}</span>
                  {addr.isDefault && (
                    <span className="text-emerald-700 font-semibold">· Default Active Return Address</span>
                  )}
                </div>
                <p className="text-slate-700 font-medium">{addr.recipientName}</p>
                <p className="text-slate-600">
                  {addr.addressLine}, {addr.city}, {addr.state} - {addr.pincode}
                </p>
                <p className="font-mono text-slate-500">{addr.phone}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.setDefaultReturnAddress(addr.id);
                      await onRefresh();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await api.deleteReturnAddress(addr.id);
                    await onRefresh();
                  }}
                  aria-label={`Delete return address ${addr.label}`}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Return Requests */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-700" />
          <h3 className="text-sm font-bold text-slate-900">Customer Return Requests</h3>
        </div>

        {returnRequests.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            No customer return requests yet. Submitted returns from Track Order appear here.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {returnRequests.map((req) => (
              <div key={req.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <p className="text-sm font-bold text-slate-900">
                    Order <span className="font-mono">{req.orderNumber}</span> · {req.customerName} (
                    {req.customerPhone})
                  </p>
                  <p className="text-slate-700">
                    <strong>Reason:</strong> {req.reason}
                  </p>
                  <p className="text-slate-500">
                    <strong>Assigned Return Hub:</strong> {req.returnAddressSnapshot}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Return status for ${req.orderNumber}`}
                    value={statusById[req.id] || req.status}
                    onChange={(e) =>
                      setStatusById({ ...statusById, [req.id]: e.target.value as ReturnStatus })
                    }
                    className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    {RETURN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    value={noteById[req.id] !== undefined ? noteById[req.id] : req.adminNote}
                    onChange={(e) => setNoteById({ ...noteById, [req.id]: e.target.value })}
                    placeholder="Admin pickup note..."
                    className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg w-48"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateReturn(req)}
                    className="px-3 py-2 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                  >
                    Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
