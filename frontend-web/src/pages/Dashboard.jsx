import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import { useNavigate } from 'react-router-dom';
import {
  PackagePlus,
  Truck,
  Boxes,
  Clock,
  AlertTriangle,
  Search,
  ArrowRight,
  ShieldCheck,
  QrCode
} from 'lucide-react';

import GlobalSearchDropdown from '../components/GlobalSearchDropdown';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [recentBoxes, setRecentBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/stock/dashboard');
      if (res.data.success) {
        setMetrics(res.data.metrics);
        setRecentBoxes(res.data.recentBoxes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (qrQuery.trim()) {
      navigate(`/history?qr=${encodeURIComponent(qrQuery.trim())}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading Dashboard Metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0F6E56] to-[#1D9E75] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full">
            VANIKI CROP SCIENCE WMS
          </span>
          <h1 className="text-2xl font-black mt-2 tracking-tight">Warehouse Operations Center</h1>
          <p className="text-xs text-emerald-100 mt-1 max-w-xl font-medium">
            Real-time stock box tracking, QR identity verification, and dispatch accuracy guard.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dispatch-verify')}
            className="bg-white text-[#0F6E56] font-extrabold text-xs px-4 py-2.5 rounded-xl shadow hover:bg-emerald-50 transition-colors flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Dispatch</span>
          </button>
          <button
            onClick={() => navigate('/purchase')}
            className="bg-emerald-800/60 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/20 transition-colors flex items-center gap-2"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Receive Stock</span>
          </button>
        </div>
      </div>

      {/* Module 1 Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Today's Purchase</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0F6E56] flex items-center justify-center font-bold">
              <PackagePlus className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{metrics?.todayPurchases || 0}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Boxes Received Today</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Today's Dispatch</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{metrics?.todayDispatches || 0}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Boxes Dispatched</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Pending Dispatch</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{metrics?.pendingDispatches || 0}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Reserved for Orders</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Stock</span>
            <div className="w-8 h-8 rounded-lg bg-[#E1F5EE] text-[#0F6E56] flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{metrics?.totalStock || 0}</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Total Warehouse Boxes</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Low Stock Alert</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {metrics?.lowStock ? 'ALERT' : 'NORMAL'}
          </p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Available: {metrics?.availableStock || 0}</p>
        </div>
      </div>

      {/* Quick Search QR Box & Live Multi-Entity Lookup */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-3">
          <QrCode className="w-4 h-4 text-[#0F6E56]" />
          <span>Quick Live Search (Products, QR Boxes, Invoices, Dealers)</span>
        </h3>
        <GlobalSearchDropdown placeholder="Type any letter (e.g. 'v', '1', product name, QR ID)..." />
      </div>

      {/* Recently Scanned / Updated Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-sm text-slate-900">Recently Processed Stock Boxes</h3>
          <button
            onClick={() => navigate('/stock')}
            className="text-xs text-[#0F6E56] font-bold hover:underline"
          >
            View All Stock Inventory →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">QR ID</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">Manufacturer</th>
                <th className="py-2.5 px-3">Rack</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentBoxes.map((box) => (
                <tr key={box._id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-mono font-extrabold text-[#0F6E56]">{box.qrId}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">{box.productName}</td>
                  <td className="py-3 px-3 font-medium text-slate-600">{box.batchNumber}</td>
                  <td className="py-3 px-3 text-slate-600">{box.manufacturer}</td>
                  <td className="py-3 px-3 font-medium text-slate-700">{box.warehouseLocation}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={box.status} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => navigate(`/history?qr=${box.qrId}`)}
                      className="text-[11px] text-[#0F6E56] font-bold hover:underline"
                    >
                      History
                    </button>
                  </td>
                </tr>
              ))}
              {recentBoxes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                    No recent inventory boxes found. Create a purchase entry to generate boxes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
