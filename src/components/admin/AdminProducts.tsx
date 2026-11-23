import { useState } from 'react';
import { Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../lib/api';
import { formatINR, type Product } from '../../shared/commerce';
import { SafeImage } from '../SafeImage';

interface AdminProductsProps {
  products: Product[];
  onRefresh: () => Promise<void>;
}

const CATEGORIES = ['Electronics', 'Home & Living', 'Kitchen', 'Fashion', 'Appliances'];

export function AdminProducts({ products, onRefresh }: AdminProductsProps) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Home & Living');
  const [price, setPrice] = useState('1999');
  const [mrp, setMrp] = useState('2999');
  const [stock, setStock] = useState('20');
  const [imageUrl, setImageUrl] = useState('/src/assets/images/prod_ceramic_lamp_1795440016481.jpg');
  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNewForm = () => {
    setEditing(null);
    setTitle('');
    setBrand('');
    setCategory('Home & Living');
    setPrice('');
    setMrp('');
    setStock('25');
    setImageUrl('/src/assets/images/prod_ceramic_lamp_1795440016481.jpg');
    setDescription('');
    setIsFeatured(true);
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditing(product);
    setTitle(product.title);
    setBrand(product.brand);
    setCategory(product.category);
    setPrice(String(product.price));
    setMrp(String(product.mrp));
    setStock(String(product.stock));
    setImageUrl(product.imageUrl);
    setDescription(product.description);
    setIsFeatured(product.isFeatured);
    setError(null);
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image file must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        brand,
        category,
        price: Number(price),
        mrp: Number(mrp) || Number(price),
        stock: Number(stock) || 0,
        imageUrl,
        description,
        specs: editing?.specs || [],
        isFeatured,
      };
      if (editing) {
        await api.updateProduct(editing.id, payload);
      } else {
        await api.createProduct(payload);
      }
      await onRefresh();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await api.deleteProduct(product.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete product.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Catalog Products</h2>
          <p className="text-xs text-slate-500">
            Add new products, update pricing/stock, or upload product images.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              {editing ? `Edit: ${editing.title}` : 'Add New Product'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              aria-label="Close product form"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="prod-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Product Title
              </label>
              <input
                id="prod-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Walnut Desk Organizer"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="prod-brand" className="block text-xs font-semibold text-slate-700 mb-1">
                Brand Name
              </label>
              <input
                id="prod-brand"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. HOME MURT Studio"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="prod-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                id="prod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prod-price" className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price (₹)
              </label>
              <input
                id="prod-price"
                type="number"
                required
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="prod-mrp" className="block text-xs font-semibold text-slate-700 mb-1">
                MRP (₹)
              </label>
              <input
                id="prod-mrp"
                type="number"
                required
                min={1}
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label htmlFor="prod-stock" className="block text-xs font-semibold text-slate-700 mb-1">
                Inventory Stock
              </label>
              <input
                id="prod-stock"
                type="number"
                required
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="prod-img" className="block text-xs font-semibold text-slate-700 mb-1">
                Product Image URL or Upload File
              </label>
              <div className="flex gap-2">
                <input
                  id="prod-img"
                  required
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="prod-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                id="prod-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key materials, dimensions, warranty, and highlights..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-700"
            />
            Feature at top of storefront catalog
          </label>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-right">Price</th>
              <th className="py-3 px-4 text-right">MRP</th>
              <th className="py-3 px-4 text-right">Stock</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-9 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <SafeImage
                        src={product.imageUrl}
                        alt={product.title}
                        fallbackTitle={product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate max-w-xs">{product.title}</p>
                      <p className="text-xs text-slate-500">{product.brand}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-slate-600">{product.category}</td>
                <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                  {formatINR(product.price)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs text-slate-400 tabular-nums">
                  {formatINR(product.mrp)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{product.stock}</td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditForm(product)}
                      aria-label={`Edit ${product.title}`}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product)}
                      aria-label={`Delete ${product.title}`}
                      className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
