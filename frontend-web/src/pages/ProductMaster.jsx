import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Package, Plus, Search, Trash2, Edit3, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ProductMaster() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [formData, setFormData] = useState({
    productCode: '',
    name: '',
    category: 'Crop Protection',
    unit: 'kg',
    packingSize: '1 kg',
    mrp: '0',
    minStockThreshold: '20',
    description: ''
  });

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products', { params: { search } });
      if (res.data.success) {
        setProducts(res.data.products);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        productCode: product.productCode,
        name: product.name,
        category: product.category || 'Crop Protection',
        unit: product.unit || 'kg',
        packingSize: product.packingSize || '1 kg',
        mrp: product.mrp || '0',
        minStockThreshold: product.minStockThreshold || '20',
        description: product.description || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        productCode: `PRD-${Math.floor(100000 + Math.random() * 900000)}`,
        name: '',
        category: 'Crop Protection',
        unit: 'kg',
        packingSize: '1 kg',
        mrp: '0',
        minStockThreshold: '20',
        description: ''
      });
    }
    setShowModal(true);
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct._id}`, formData);
        if (res.data.success) {
          setMessage('Product updated successfully!');
          setShowModal(false);
          fetchProducts();
        }
      } else {
        const res = await api.post('/products', formData);
        if (res.data.success) {
          setMessage('New Product created in catalog!');
          setShowModal(false);
          fetchProducts();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to soft delete product "${name}"?`)) return;
    try {
      const res = await api.delete(`/products/${id}`);
      if (res.data.success) {
        setMessage(`Product "${name}" deleted.`);
        fetchProducts();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#0F6E56]" />
            Product Master Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage product master information, categories, packing sizes, and stock alert thresholds.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#0c5946] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Search Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search product by name, code, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Product Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Packing</th>
                <th className="p-3.5">MRP (₹)</th>
                <th className="p-3.5">Current Available Stock</th>
                <th className="p-3.5">Min Alert</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-400 font-medium">Loading product catalog...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-400 font-medium">No products found.</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50 transition-all">
                    <td className="p-3.5 font-bold text-slate-900">{p.productCode}</td>
                    <td className="p-3.5 font-bold text-[#0F6E56]">{p.name}</td>
                    <td className="p-3.5">{p.category}</td>
                    <td className="p-3.5">{p.packingSize} ({p.unit})</td>
                    <td className="p-3.5">₹{p.mrp}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        (p.availableStock || 0) < Number(p.minStockThreshold || 20)
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-[#0F6E56] border border-emerald-300'
                      }`}>
                        {p.availableStock || 0} Boxes Available
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-amber-700">{p.minStockThreshold} units</td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenModal(p)}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                        title="Edit Product"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p._id, p.name)}
                        className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#0F6E56]" />
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Product Code</label>
                  <input
                    type="text"
                    required
                    value={formData.productCode}
                    onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vaniki Super Crop"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  >
                    <option value="Insecticides">Insecticides</option>
                    <option value="Fungicides">Fungicides</option>
                    <option value="Herbicides">Herbicides</option>
                    <option value="Bio-Stimulants">Bio-Stimulants</option>
                    <option value="Fertilizers">Fertilizers</option>
                    <option value="Crop Protection">Crop Protection</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Packing Size</label>
                  <input
                    type="text"
                    value={formData.packingSize}
                    onChange={(e) => setFormData({ ...formData, packingSize: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  >
                    <option value="kg">kg</option>
                    <option value="Ltr">Ltr</option>
                    <option value="gm">gm</option>
                    <option value="ml">ml</option>
                    <option value="Pouch">Pouch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min Stock Threshold</label>
                  <input
                    type="number"
                    value={formData.minStockThreshold}
                    onChange={(e) => setFormData({ ...formData, minStockThreshold: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F6E56] hover:bg-[#0c5946] text-white rounded-xl font-bold shadow-md"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
