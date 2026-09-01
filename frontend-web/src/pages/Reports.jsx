import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { BarChart3, FileSpreadsheet, ShieldAlert, Boxes, Truck, CheckCircle2, History, Layers } from 'lucide-react';

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/summary');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (reportName, items) => {
    if (!items || items.length === 0) return alert('No data to export!');
    const headers = Object.keys(items[0]).join(',');
    const rows = items.map(item => Object.values(item).map(v => `"${v}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading reports analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#0F6E56]" />
            Warehouse Operation & Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete operational oversight, stock movements, box tracking, and dealer dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800">
            STAFF REPORTS PORTAL
          </span>
        </div>
      </div>

      <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Stock Units</span>
                <Boxes className="w-5 h-5 text-[#0F6E56]" />
              </div>
              <p className="text-2xl font-black text-slate-900">{data?.reports?.metrics?.totalStockUnits || 0}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Active inventory tracked</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Purchases</span>
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{data?.reports?.metrics?.totalPurchases || 0}</p>
              <p className="text-[11px] text-blue-600 font-semibold mt-1">Stock batches received</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Dispatches</span>
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{data?.reports?.metrics?.totalDispatches || 0}</p>
              <p className="text-[11px] text-purple-600 font-semibold mt-1">Dispatches generated</p>
            </div>
          </div>

          {/* Soft-Deleted Records Audit Report */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Soft-Deleted Inventory Entries Log
                </h3>
                <p className="text-xs text-slate-500">Track entries deleted by Admins for audit compliance.</p>
              </div>

              <button
                onClick={() => handleExportCSV('deleted_inventory_log', data?.reports?.deletedBoxes)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">QR ID</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3">Deleted By</th>
                    <th className="p-3">Deleted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!data?.reports?.deletedBoxes || data.reports.deletedBoxes.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-slate-400">No deleted records found. Clean audit record!</td>
                    </tr>
                  ) : (
                    data.reports.deletedBoxes.map((b) => (
                      <tr key={b._id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-rose-600">{b.qrId}</td>
                        <td className="p-3 font-bold">{b.productName}</td>
                        <td className="p-3">{b.batchNumber}</td>
                        <td className="p-3 font-semibold text-slate-800">{b.deletedBy || 'Admin'}</td>
                        <td className="p-3">{new Date(b.deletedAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* User Limited Reports Panel */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase">Available Stock</div>
              <p className="text-2xl font-black text-[#0F6E56] mt-1">{data?.reports?.metrics?.availableStock || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase">Today's Received Stock</div>
              <p className="text-2xl font-black text-blue-600 mt-1">{data?.reports?.metrics?.todayPurchases || 0}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase">Today's Dispatches</div>
              <p className="text-2xl font-black text-purple-600 mt-1">{data?.reports?.metrics?.todayDispatches || 0}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#0F6E56]" />
                  Generated Delivery Statements
                </h3>
                <p className="text-xs text-slate-500">Overview of recent dispatch orders and delivery statements.</p>
              </div>

              <button
                onClick={() => handleExportCSV('delivery_statements', data?.reports?.myDeliveryStatements)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Dispatch No</th>
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Dealer</th>
                    <th className="p-3">Scanned Items</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!data?.reports?.myDeliveryStatements || data.reports.myDeliveryStatements.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-4 text-center text-slate-400">No delivery statements created yet.</td>
                    </tr>
                  ) : (
                    data.reports.myDeliveryStatements.map((d) => (
                      <tr key={d._id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-[#0F6E56]">{d.dispatchNo}</td>
                        <td className="p-3 font-bold">{d.salesInvoiceNo}</td>
                        <td className="p-3 font-semibold text-slate-700">{d.dealerId?.firmName || d.dealerId?.name || 'N/A'}</td>
                        <td className="p-3">{d.scannedBoxQrIds?.length || 0} boxes</td>
                        <td className="p-3">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            {d.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">{new Date(d.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </div>
  );
}
