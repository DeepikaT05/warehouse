import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import TimelineView from '../components/TimelineView';
import StatusBadge from '../components/StatusBadge';
import { useSearchParams } from 'react-router-dom';
import { History, Search, QrCode, Building2, Calendar, ShieldCheck, Box } from 'lucide-react';

export default function ProductHistory() {
  const [searchParams] = useSearchParams();
  const initialQr = searchParams.get('qr') || '';

  const [qrQuery, setQrQuery] = useState(initialQr);
  const [boxData, setBoxData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQr) {
      handleSearch(initialQr);
    }
  }, [initialQr]);

  const handleSearch = async (targetQr) => {
    const query = (targetQr || qrQuery).trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setBoxData(null);

    try {
      const res = await api.get(`/stock/qr/${encodeURIComponent(query)}`);
      if (res.data.success) {
        setBoxData(res.data.box);
      }
    } catch (err) {
      setError(err.response?.data?.message || `No inventory box found matching '${query}'.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-[#0F6E56]" />
            <span>Product Lifecycle History & Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Module 11: Complete historical timeline for any box QR code. Permanent record from purchase to delivery.
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Enter or Scan Box QR ID (e.g. VNK-00000001)..."
              value={qrQuery}
              onChange={(e) => setQrQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>{loading ? 'Searching...' : 'Trace Lifecycle'}</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-bold text-center">
          {error}
        </div>
      )}

      {boxData && (
        <div className="space-y-6">
          {/* Summary Box Profile */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-black text-[#0F6E56]">{boxData.qrId}</span>
                  <StatusBadge status={boxData.status} />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 mt-1">{boxData.productName}</h2>
              </div>

              <div className="bg-[#E1F5EE] border border-emerald-200 px-4 py-2 rounded-xl text-xs">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Current Location</span>
                <p className="font-extrabold text-[#0F6E56]">{boxData.warehouseLocation}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Batch Number</span>
                <p className="font-bold text-slate-800">{boxData.batchNumber}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Manufacturer</span>
                <p className="font-semibold text-slate-700">{boxData.manufacturer}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Box Weight</span>
                <p className="font-semibold text-slate-700">{boxData.weight}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Purchase Bill</span>
                <p className="font-mono font-bold text-slate-800">{boxData.purchaseInvoice}</p>
              </div>
            </div>
          </div>

          {/* Timeline Lifecycle Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0F6E56]" />
              <span>Complete Box Audit Trail & History Events</span>
            </h3>

            <TimelineView history={boxData.history} />
          </div>
        </div>
      )}
    </div>
  );
}
