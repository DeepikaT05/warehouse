import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Building2, Phone, Mail, MapPin, ShieldAlert, Eye, Pencil, Trash2 } from 'lucide-react';

export default function DealerMaster() {
  const { user } = useAuth();

  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDealerId, setEditingDealerId] = useState(null);

  const initialFormState = {
    dealerName: '',
    garageName: '',
    ownerName: '',
    gstNumber: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    district: '',
    city: '',
    pincode: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchDealers();
  }, []);

  const fetchDealers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dealers');
      if (res.data.success) {
        setDealers(res.data.dealers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddNewClick = () => {
    if (showForm) {
      setShowForm(false);
      setEditingDealerId(null);
      setFormData(initialFormState);
    } else {
      setEditingDealerId(null);
      setFormData(initialFormState);
      setShowForm(true);
    }
  };

  const handleEdit = (dealer) => {
    setEditingDealerId(dealer._id);
    setFormData({
      dealerName: dealer.dealerName || '',
      garageName: dealer.garageName || '',
      ownerName: dealer.ownerName || '',
      gstNumber: dealer.gstNumber || '',
      phone: dealer.phone || '',
      email: dealer.email || '',
      address: dealer.address || '',
      state: dealer.state || '',
      district: dealer.district || '',
      city: dealer.city || '',
      pincode: dealer.pincode || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (dealerId, dealerName) => {
    if (!window.confirm(`Are you sure you want to delete dealer "${dealerName}"?`)) {
      return;
    }
    try {
      const res = await api.delete(`/dealers/${dealerId}`);
      if (res.data.success) {
        alert(res.data.message || 'Dealer deleted successfully');
        fetchDealers();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDealerId) {
        const res = await api.put(`/dealers/${editingDealerId}`, formData);
        if (res.data.success) {
          alert('Dealer profile updated successfully!');
          setShowForm(false);
          setEditingDealerId(null);
          setFormData(initialFormState);
          fetchDealers();
        }
      } else {
        const res = await api.post('/dealers', formData);
        if (res.data.success) {
          alert('Dealer created successfully!');
          setShowForm(false);
          setFormData(initialFormState);
          fetchDealers();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0F6E56]" />
            <span>Dealer Master Directory ({dealers.length})</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage dealer profiles and garage distributor records
          </p>
        </div>

        <button
          onClick={handleAddNewClick}
          className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Cancel' : 'Add New Dealer'}</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#0F6E56]">
              {editingDealerId ? 'Edit Dealer Profile' : 'Register New Dealer Profile'}
            </h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingDealerId(null); setFormData(initialFormState); }}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dealer Name *</label>
              <input
                type="text"
                required
                name="dealerName"
                value={formData.dealerName}
                onChange={handleChange}
                placeholder="e.g. Ramesh Agro Traders"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Garage Name *</label>
              <input
                type="text"
                required
                name="garageName"
                value={formData.garageName}
                onChange={handleChange}
                placeholder="e.g. Ramesh Auto & Garage"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Owner Name</label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="Owner Full Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">GST Number</label>
              <input
                type="text"
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="24AAAAA0000A1Z5"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="text"
                required
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 9876543210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="dealer@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Address *</label>
              <input
                type="text"
                required
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Shop / Premises Address"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Rajkot"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">District *</label>
              <input
                type="text"
                required
                name="district"
                value={formData.district}
                onChange={handleChange}
                placeholder="e.g. Rajkot"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">State *</label>
              <input
                type="text"
                required
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. Gujarat"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pincode *</label>
              <input
                type="text"
                required
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="360002"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingDealerId(null); setFormData(initialFormState); }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow"
            >
              {editingDealerId ? 'Update Dealer Profile' : 'Save Dealer Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Dealer Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading dealer directory...</div>
      ) : dealers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 font-medium">
          No registered dealers found in directory. Click "Add New Dealer" to register one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dealers.map(d => (
            <div key={d._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-emerald-300 transition-colors flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{d.dealerName}</h3>
                    <p className="text-xs font-bold text-[#0F6E56] flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{d.garageName}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 shrink-0">
                    {d.gstNumber || 'NO GST'}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-600 border-t border-b border-slate-100 py-2">
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{d.phone}</span>
                  </p>
                  {d.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{d.email}</span>
                    </p>
                  )}
                  <p className="flex items-start gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{d.address}, {d.city}, {d.state} - {d.pincode}</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Owner: {d.ownerName || 'N/A'}</span>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(d)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#0F6E56] hover:bg-emerald-50 transition-colors flex items-center gap-1 text-[11px] font-bold"
                    title="Edit Dealer Profile"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(d._id, d.dealerName)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-rose-50 transition-colors flex items-center gap-1 text-[11px] font-bold"
                    title="Delete Dealer Profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
