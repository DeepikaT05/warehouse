import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Edit2, Trash2, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

export default function MasterDataTab() {
  const [activeSection, setActiveSection] = useState('purchases');
  const [data, setData] = useState({ purchases: [], dealers: [], dispatches: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeSection]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeSection === 'purchases') {
        const res = await api.get('/purchases');
        if (res.data.success) setData({ ...data, purchases: res.data.purchases });
      } else if (activeSection === 'dealers') {
        const res = await api.get('/dealers');
        if (res.data.success) setData({ ...data, dealers: res.data.dealers });
      } else if (activeSection === 'dispatches') {
        const res = await api.get('/dispatches');
        if (res.data.success) setData({ ...data, dispatches: res.data.dispatches });
      }
    } catch (err) {
      setError('Failed to fetch data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, section, label) => {
    if (!window.confirm(`Are you sure you want to permanently delete this ${label}?`)) return;
    try {
      const res = await api.delete(`/admin/${section}/${id}`);
      if (res.data.success) {
        setMessage(`${label} deleted successfully.`);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveSection('purchases')} 
          className={`px-4 py-2 text-xs font-bold rounded-t-lg ${activeSection === 'purchases' ? 'bg-purple-100 text-purple-800' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Purchases
        </button>
        <button 
          onClick={() => setActiveSection('dealers')} 
          className={`px-4 py-2 text-xs font-bold rounded-t-lg ${activeSection === 'dealers' ? 'bg-purple-100 text-purple-800' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Dealers
        </button>
        <button 
          onClick={() => setActiveSection('dispatches')} 
          className={`px-4 py-2 text-xs font-bold rounded-t-lg ${activeSection === 'dispatches' ? 'bg-purple-100 text-purple-800' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          Dispatches
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="text-xs text-slate-500">Loading data...</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">ID / Reference</th>
                <th className="py-2.5 px-3">Primary Info</th>
                <th className="py-2.5 px-3">Date / Status</th>
                <th className="py-2.5 px-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSection === 'purchases' && data.purchases.map(item => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold">{item.invoiceNumber}</td>
                  <td className="py-3 px-3">{item.manufacturer} - {item.productName}</td>
                  <td className="py-3 px-3">{new Date(item.purchaseDate).toLocaleDateString()}</td>
                  <td className="py-3 px-3 text-right">
                    <button onClick={() => handleDelete(item._id, 'purchases', 'Purchase')} className="text-rose-600 hover:underline font-bold">Delete</button>
                  </td>
                </tr>
              ))}
              {activeSection === 'dealers' && data.dealers.map(item => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold">{item.dealerName}</td>
                  <td className="py-3 px-3">{item.garageName} - {item.city}</td>
                  <td className="py-3 px-3">{item.phone}</td>
                  <td className="py-3 px-3 text-right">
                    <button onClick={() => handleDelete(item._id, 'dealers', 'Dealer')} className="text-rose-600 hover:underline font-bold">Delete</button>
                  </td>
                </tr>
              ))}
              {activeSection === 'dispatches' && data.dispatches.map(item => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold">{item._id.slice(-6)}</td>
                  <td className="py-3 px-3">{item.dealerName}</td>
                  <td className="py-3 px-3">{new Date(item.dispatchDate).toLocaleDateString()} - {item.status}</td>
                  <td className="py-3 px-3 text-right">
                    <button onClick={() => handleDelete(item._id, 'dispatches', 'Dispatch')} className="text-rose-600 hover:underline font-bold">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
