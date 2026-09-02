import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  Eye,
  Calendar,
  Layers,
  Building2,
  User,
  Filter,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function BillHistory() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices');
      if (res.data && res.data.success) {
        setInvoices(res.data.invoices || []);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(term)) ||
      (inv.orderId && inv.orderId.toLowerCase().includes(term)) ||
      (inv.dealerName && inv.dealerName.toLowerCase().includes(term)) ||
      (inv.garageName && inv.garageName.toLowerCase().includes(term)) ||
      (inv.assignedToUser && inv.assignedToUser.toLowerCase().includes(term));

    if (!matchSearch) return false;

    if (statusFilter === 'DISPATCHED') return inv.status === 'dispatched' || inv.orderStatus === 'completed';
    if (statusFilter === 'PENDING') return inv.status !== 'dispatched' && inv.orderStatus !== 'completed';
    return true;
  });

  const totalInvoices = invoices.length;
  const dispatchedCount = invoices.filter(i => i.status === 'dispatched' || i.orderStatus === 'completed').length;
  const pendingCount = totalInvoices - dispatchedCount;
  const totalBoxes = invoices.reduce((sum, i) => sum + (Array.isArray(i.items) ? i.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0F6E56]" />
            <span>Bill & Invoice History</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Complete record of sales invoices, worker assignments, and dispatch status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchInvoices}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/invoices')}
            className="bg-[#0F6E56] hover:bg-[#0B5442] text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload & Assign New Bill</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Invoices</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{totalInvoices}</span>
            <span className="text-xs font-medium text-slate-500">bills stored</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Dispatched Bills</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-600">{dispatchedCount}</span>
            <span className="text-xs font-medium text-emerald-700">completed</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pending Verification</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
            <span className="text-xs font-medium text-amber-700">in warehouse</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Quantities (Boxes)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#0F6E56]">{totalBoxes}</span>
            <span className="text-xs font-medium text-slate-500">units</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice #, dealer, order ID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All ({totalInvoices})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1 rounded-lg transition-colors ${statusFilter === 'PENDING' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('DISPATCHED')}
              className={`px-3 py-1 rounded-lg transition-colors ${statusFilter === 'DISPATCHED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Dispatched ({dispatchedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Bill History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice # & Date</th>
                <th className="py-3 px-4">Dealer / Store</th>
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Assigned Worker</th>
                <th className="py-3 px-4">Products & Boxes</th>
                <th className="py-3 px-4">Dispatch Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const isDispatched = inv.status === 'dispatched' || inv.orderStatus === 'completed';
                const totalItemBoxes = Array.isArray(inv.items) ? inv.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
                const formattedDate = inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-GB') : new Date(inv.createdAt).toLocaleDateString('en-GB');

                return (
                  <tr key={inv._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-extrabold text-[#0F6E56] text-xs flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>#{inv.invoiceNo}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.dealerName || 'Direct Dealer'}</span>
                      </div>
                      {inv.garageName && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          Store: {inv.garageName}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {inv.orderId || 'ORD-N/A'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px]">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{inv.assignedToUser || 'Unassigned'}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-left group hover:text-[#0F6E56]"
                      >
                        <div className="font-extrabold text-slate-900 flex items-center gap-1 text-xs">
                          <Layers className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F6E56]" />
                          <span>{totalItemBoxes} Boxes ({inv.items?.length || 0} items)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 group-hover:text-[#0F6E56] flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Click to view details
                        </div>
                      </button>
                    </td>

                    <td className="py-3.5 px-4">
                      {isDispatched ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>DISPATCHED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>PENDING DISPATCH</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/dispatch-verify?invoiceNo=${inv.invoiceNo}`)}
                          className="bg-emerald-50 hover:bg-[#0F6E56] text-[#0F6E56] hover:text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1 shadow-2xs"
                          title="Verify Dispatch Scan"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </button>

                        <button
                          onClick={() => navigate(`/delivery-statement?invoiceNo=${inv.invoiceNo}`)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                          title="Delivery Statement"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Bilty</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No Invoices Found</p>
                    <p className="text-[11px] mt-0.5">Upload sales invoices from the Assign Bill page to see history here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Items Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0F6E56]" />
                  <span>Invoice #{selectedInvoice.invoiceNo} Product Items</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dealer: {selectedInvoice.dealerName} ({selectedInvoice.garageName || 'N/A'})
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {selectedInvoice.items?.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{item.productName}</span>
                    <span className="text-slate-400 text-[11px]">Batch: {item.batchNumber} • Unit: {item.weight || '1 kg'}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 text-sm">{item.quantity}</span>
                    <span className="text-slate-500 text-[11px] block">Boxes</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500">
                Assigned Worker: <strong className="text-slate-800">{selectedInvoice.assignedToUser}</strong>
              </span>
              <button
                onClick={() => {
                  const inv = selectedInvoice.invoiceNo;
                  setSelectedInvoice(null);
                  navigate(`/dispatch-verify?invoiceNo=${inv}`);
                }}
                className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Open Dispatch Verification</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
