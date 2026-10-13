import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Plus,
  Upload,
  Play,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Package,
  X,
  FileText,
  Building2,
  RefreshCw,
  AlertTriangle,
  Ban,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Receipt,
  Download,
  Check,
  Copy,
  ExternalLink,
  Truck,
  XCircle,
  Sparkles
} from 'lucide-react';

export default function AssignedOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [orders, setOrders] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [copiedInvoice, setCopiedInvoice] = useState(null);

  // Cancel Order Modal State
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Admin Bill Upload Form Toggle & State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tallyFileName, setTallyFileName] = useState('');

  const initialBillState = {
    invoiceNo: '',
    orderId: '',
    dealerId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [
      { productName: '', batchNumber: '', quantity: 1, weight: '1 kg', hsnCode: '38089190', price: 0 }
    ]
  };

  const [billForm, setBillForm] = useState(initialBillState);

  useEffect(() => {
    fetchOrders();
    fetchDealers();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/orders', { params: { status: statusFilter } });
      if (res.data.success) {
        setOrders(res.data.orders);
        if (res.data.lastSync) {
          setLastSyncTime(new Date(res.data.lastSync));
        }
      }
    } catch (err) {
      console.error('Fetch assigned orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDealers = async () => {
    try {
      const res = await api.get('/dealers');
      if (res.data.success) {
        setDealers(res.data.dealers);
      }
    } catch (err) {
      console.error('Fetch dealers error:', err);
    }
  };

  // Trigger manual sync from central Vaniki Crop B2B portal
  const handleSyncB2B = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/invoices/sync-b2b');
      if (res.data.success) {
        setLastSyncTime(new Date());
        await fetchOrders();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Sync failed. Please check network connection.');
    } finally {
      setSyncing(false);
    }
  };

  // Cancel order locally from warehouse
  const handleCancelOrderSubmit = async (e) => {
    e.preventDefault();
    if (!cancelModalOrder) return;
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason.');
      return;
    }

    setCancelling(true);
    try {
      const res = await api.post(`/user/orders/${cancelModalOrder._id}/cancel`, {
        reason: cancelReason.trim()
      });
      if (res.data.success) {
        setCancelModalOrder(null);
        setCancelReason('');
        await fetchOrders();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setCancelling(false);
    }
  };

  // Download Authentic Tally PDF Invoice
  const handleDownloadPdf = (order) => {
    const targetId = order.centralInvoiceId || order.invoiceNo || order._id;
    const token = localStorage.getItem('token');
    const pdfUrl = `/api/invoices/${targetId}/b2b-pdf?token=${encodeURIComponent(token || '')}`;
    window.open(pdfUrl, '_blank');
  };

  // Copy invoice number to clipboard
  const handleCopyInvoice = (invNo) => {
    navigator.clipboard?.writeText(invNo);
    setCopiedInvoice(invNo);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  // Bill Upload Form Handlers
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...billForm.items];
    updatedItems[index][field] = value;
    setBillForm({ ...billForm, items: updatedItems });
  };

  const handleAddItemRow = () => {
    setBillForm({
      ...billForm,
      items: [...billForm.items, { productName: '', batchNumber: '', quantity: 1, weight: '1 kg', hsnCode: '38089190', price: 0 }]
    });
  };

  const handleRemoveItemRow = (index) => {
    if (billForm.items.length === 1) return;
    const updatedItems = billForm.items.filter((_, idx) => idx !== index);
    setBillForm({ ...billForm, items: updatedItems });
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTallyFileName(file.name);
      setBillForm(prev => ({
        ...prev,
        invoiceNo: `TALLY-${Math.floor(1000 + Math.random() * 9000)}`,
        orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`
      }));
    }
  };

  const handleCreateBillSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.dealerId) {
      alert('Please select a dealer from the dropdown!');
      return;
    }

    setUploading(true);
    try {
      const res = await api.post('/invoices', billForm);
      if (res.data.success) {
        setShowUploadForm(false);
        setBillForm(initialBillState);
        setTallyFileName('');
        fetchOrders();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStartPicking = async (order) => {
    if (order.orderStatus === 'rejected' || order.orderStatus === 'cancelled' || order.isCancelled || order.isRejected) {
      alert(`Cannot start picking. Order #${order.invoiceNo} has been ${order.orderStatus.toUpperCase()}!`);
      return;
    }

    try {
      if (order._id) {
        await api.post(`/user/orders/${order._id}/start-picking`);
      }
    } catch (err) {}
    const inv = order.invoiceNo || order._id;
    navigate(`/dispatch-verify?invoiceNo=${inv}`);
  };

  const getStatusBadge = (order) => {
    const isRejectedOrCancelled = order.orderStatus === 'rejected' || order.orderStatus === 'cancelled' || order.isRejected || order.isCancelled;

    if (isRejectedOrCancelled) {
      if (order.orderStatus === 'cancelled' || order.isCancelled) {
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-black px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs animate-pulse">
            <XCircle className="w-3.5 h-3.5 text-rose-700" />
            <span>ORDER CANCELLED</span>
          </span>
        );
      }
      return (
        <span className="bg-red-100 text-red-800 border border-red-300 text-[11px] font-black px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
          <Ban className="w-3.5 h-3.5 text-red-700" />
          <span>REJECTED IN B2B PORTAL</span>
        </span>
      );
    }

    switch (order.orderStatus) {
      case 'new':
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">NEW B2B BILL</span>;
      case 'viewed':
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">VIEWED</span>;
      case 'picking_started':
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">PICKING IN PROGRESS</span>;
      case 'picking_completed':
        return <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">PICKING COMPLETED</span>;
      case 'warehouse_verified':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">WAREHOUSE VERIFIED</span>;
      case 'invoice_generated':
        return <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">INVOICE GENERATED</span>;
      case 'sent_to_dealer':
        return <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg">SENT TO DEALER</span>;
      case 'dealer_approved':
      case 'completed':
        return <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg">COMPLETED</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">{order.orderStatus?.toUpperCase()}</span>;
    }
  };

  // Metrics counts
  const totalCount = orders.length;
  const newCount = orders.filter(o => o.orderStatus === 'new' && !o.isRejected && !o.isCancelled).length;
  const pickingCount = orders.filter(o => o.orderStatus === 'picking_started').length;
  const completedCount = orders.filter(o => ['picking_completed', 'warehouse_verified', 'invoice_generated', 'sent_to_dealer', 'completed'].includes(o.orderStatus)).length;
  const rejectedOrCancelledCount = orders.filter(o => o.orderStatus === 'rejected' || o.orderStatus === 'cancelled' || o.isRejected || o.isCancelled).length;

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'rejected_or_cancelled') {
      if (!(o.orderStatus === 'rejected' || o.orderStatus === 'cancelled' || o.isRejected || o.isCancelled)) return false;
    }
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      o.invoiceNo?.toLowerCase().includes(query) ||
      o.dealerName?.toLowerCase().includes(query) ||
      o.garageName?.toLowerCase().includes(query) ||
      o.buyerOrderNo?.toLowerCase().includes(query) ||
      o.destination?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0F6E56]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Assigned Dealer Bills & B2B Orders</span>
                <span className="bg-emerald-100 text-[#0F6E56] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Synced
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Orders generated from Dealer Product Requests & Tally Invoices. Pick stock, scan QR codes, and track cancellations.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Sync & Manual Upload */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleSyncB2B}
            disabled={syncing}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-60"
            title="Fetch latest orders and rejections from Central Vaniki Crop system"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0F6E56] ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing with Portal...' : 'Sync B2B Orders'}</span>
            {lastSyncTime && !syncing && (
              <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                ({lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              {showUploadForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showUploadForm ? 'Close Form' : 'Log Manual Sales Bill'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bills</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{totalCount}</p>
          <span className="text-[10px] text-slate-400 font-semibold">Central B2B & local</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">New Ready to Pick</span>
          <p className="text-2xl font-black text-blue-700 mt-1">{newCount}</p>
          <span className="text-[10px] text-blue-500 font-semibold">Awaiting stock picking</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">In Picking</span>
          <p className="text-2xl font-black text-amber-700 mt-1">{pickingCount}</p>
          <span className="text-[10px] text-amber-500 font-semibold">Active scanning session</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed / Ready</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{completedCount}</p>
          <span className="text-[10px] text-emerald-600 font-semibold">Picked & verified</span>
        </div>

        {/* Highlighted Rejected / Cancelled KPI Card */}
        <div className="bg-rose-50/70 p-4 rounded-2xl border-2 border-rose-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">Cancelled / Rejected</span>
            <Ban className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-1">{rejectedOrCancelledCount}</p>
          <span className="text-[10px] text-rose-600 font-bold">Do not pick or dispatch</span>
        </div>
      </div>

      {/* Admin Bill Upload Expandable Form (Admin Only) */}
      {isAdmin && showUploadForm && (
        <form onSubmit={handleCreateBillSubmit} className="bg-white border-2 border-[#0F6E56] rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-sm text-[#0F6E56] flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Admin Sales Bill Upload & Assignment</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Assigns order directly to warehouse panel</span>
          </div>

          <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-4 text-center">
            <Upload className="w-6 h-6 text-[#0F6E56] mx-auto mb-1" />
            <p className="text-xs font-bold text-slate-800">Upload Tally Export / Excel Bill Document</p>
            <input
              type="file"
              id="tally-file-assigned"
              className="hidden"
              accept=".xlsx,.xls,.csv,.pdf,.xml"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="tally-file-assigned"
              className="mt-2 inline-block bg-white border border-emerald-300 text-[#0F6E56] font-bold text-xs px-4 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
            >
              {tallyFileName ? `File: ${tallyFileName}` : 'Choose Tally / Excel File'}
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                value={billForm.invoiceNo}
                onChange={(e) => setBillForm({ ...billForm, invoiceNo: e.target.value })}
                placeholder="e.g. SL-INV-2026-901"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Order ID</label>
              <input
                type="text"
                value={billForm.orderId}
                onChange={(e) => setBillForm({ ...billForm, orderId: e.target.value })}
                placeholder="e.g. ORD-8812"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Assign Dealer / Garage *</label>
              <select
                required
                value={billForm.dealerId}
                onChange={(e) => setBillForm({ ...billForm, dealerId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              >
                <option value="">-- Select Dealer Master --</option>
                {dealers.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.dealerName} ({d.garageName}) - {d.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-slate-700">Products & Quantities to Pick</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[#0F6E56] hover:underline font-bold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            {billForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="col-span-5">
                  <input
                    type="text"
                    required
                    placeholder="Product Name"
                    value={item.productName}
                    onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div className="col-span-3">
                  <input
                    type="text"
                    required
                    placeholder="Batch Number"
                    value={item.batchNumber}
                    onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div className="col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="text-red-500 hover:text-red-700 font-bold text-xs p-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{uploading ? 'Uploading Bill...' : 'Save & Assign Bill'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search invoice number, dealer name, city, order ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { label: 'All Bills', value: '', count: totalCount },
            { label: 'New', value: 'new', count: newCount },
            { label: 'Picking', value: 'picking_started', count: pickingCount },
            { label: 'Completed', value: 'completed', count: completedCount },
            { label: 'Cancelled / Rejected', value: 'rejected_or_cancelled', count: rejectedOrCancelledCount, isRed: true }
          ].map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? tab.isRed
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-[#0F6E56] text-white shadow-xs'
                    : tab.isRed
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive ? 'bg-white/20 text-white' : tab.isRed ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <RefreshCw className="w-6 h-6 text-[#0F6E56] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">Loading assigned dealer bills & B2B invoices...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No Assigned Bills Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {search
                ? `No orders matching "${search}". Try clearing your search.`
                : 'No dealer bills match the selected status filter. Click "Sync B2B Orders" above to fetch latest requests.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const totalItems = order.items?.reduce((acc, i) => acc + (i.quantity || i.requestedQuantity || 0), 0) || 0;
            const totalPicked = order.pickedItems?.length || 0;
            const isRejectedOrCancelled = order.orderStatus === 'rejected' || order.orderStatus === 'cancelled' || order.isRejected || order.isCancelled;
            const isPickingDone = (totalItems > 0 && totalPicked >= totalItems) || ['picking_completed', 'warehouse_verified', 'invoice_generated', 'sent_to_dealer', 'completed'].includes(order.orderStatus);
            const progressPercent = totalItems > 0 ? Math.min(100, Math.round((totalPicked / totalItems) * 100)) : 0;

            return (
              <div
                key={order._id}
                className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md ${
                  isRejectedOrCancelled
                    ? 'border-rose-300 bg-rose-50/20'
                    : 'border-slate-200/80 hover:border-emerald-300'
                }`}
              >
                {/* Order Card Top Bar */}
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5 font-mono font-black text-base text-[#0F6E56]">
                        <span>Bill #{order.invoiceNo}</span>
                        <button
                          onClick={() => handleCopyInvoice(order.invoiceNo)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          title="Copy bill number"
                        >
                          {copiedInvoice === order.invoiceNo ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {order.isB2BOrder && (
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>Central B2B</span>
                        </span>
                      )}

                      {getStatusBadge(order)}

                      {order.paymentStatus === 'paid' && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                          PAID
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[#0F6E56]" />
                        <span>{order.dealerName} {order.garageName && order.garageName !== order.dealerName ? `(${order.garageName})` : ''}</span>
                      </span>

                      {order.buyerOrderNo && (
                        <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          Ref: {order.buyerOrderNo}
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(order.createdAt || order.invoiceDate).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions Header: Download Tally PDF, Start Picking, Cancel Order */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Direct Tally PDF Download */}
                    <button
                      onClick={() => handleDownloadPdf(order)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                      title="Download authentic A4 Tally Tax Invoice PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Tally PDF</span>
                    </button>

                    {/* Start Picking OR Disabled State */}
                    {isRejectedOrCancelled ? (
                      <div className="bg-rose-100 border border-rose-300 text-rose-800 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-not-allowed">
                        <Ban className="w-4 h-4 text-rose-700" />
                        <span>Picking Blocked (Cancelled)</span>
                      </div>
                    ) : isPickingDone ? (
                      <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-4 py-2.5 rounded-xl border border-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Picking Done</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartPicking(order)}
                        className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{order.orderStatus === 'picking_started' ? 'Continue Picking' : 'Start Picking & Scan'}</span>
                      </button>
                    )}

                    {/* Verify & Dispatch Shortcut */}
                    {!isRejectedOrCancelled && (
                      <button
                        onClick={() => navigate(`/dispatch-verify?invoiceNo=${order.invoiceNo}`)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                        title="Open Dispatch & Verification screen"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                        <span>Verify</span>
                      </button>
                    )}

                    {/* Warehouse Cancel Button (for active orders) */}
                    {!isRejectedOrCancelled && (
                      <button
                        onClick={() => {
                          setCancelModalOrder(order);
                          setCancelReason('');
                        }}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 font-bold text-xs px-2.5 py-2 rounded-xl transition-all"
                        title="Cancel this order"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* PROMINENT REJECTION / CANCELLATION BANNER */}
                {isRejectedOrCancelled && (
                  <div className="mx-5 mt-4 p-4 rounded-xl bg-rose-100/70 border-2 border-rose-300 flex items-start gap-3 animate-in fade-in">
                    <div className="w-8 h-8 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-rose-700" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-rose-900 tracking-wide uppercase flex items-center gap-1.5">
                        <span>ATTENTION: ORDER {order.orderStatus === 'cancelled' ? 'CANCELLED BY WAREHOUSE' : 'REJECTED IN CENTRAL DEALER SYSTEM'}</span>
                      </h4>
                      <p className="text-xs text-rose-800 font-semibold">
                        <strong className="font-bold">Reason: </strong>
                        "{order.cancellationReason || order.rejectionReason || 'Order rejected by Superadmin or Dealer. Do not dispatch.'}"
                      </p>
                      <p className="text-[10px] text-rose-600 font-medium">
                        Logged by {order.cancelledBy || order.rejectedBy || 'Central Admin'} on{' '}
                        {new Date(order.cancelledAt || order.rejectedAt || order.updatedAt || order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Details Body: Store Address & Products */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
                  {/* Store & Destination Column */}
                  <div className="lg:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Dealer & Delivery Details
                    </span>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a href={`tel:${order.dealerPhone}`} className="text-[#0F6E56] font-bold hover:underline">
                          {order.dealerPhone || 'N/A'}
                        </a>
                      </div>

                      <div className="flex items-start gap-2 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{order.dealerAddress || order.destination || 'Ambagarh Chauki, Chhattisgarh'}</span>
                      </div>

                      {order.dealerGst && (
                        <div className="flex items-center gap-2 text-slate-600 text-[11px] font-mono">
                          <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>GSTIN: {order.dealerGst}</span>
                        </div>
                      )}

                      {order.dispatchDocNo && (
                        <div className="flex items-center gap-2 text-slate-600 text-[11px]">
                          <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Dispatch LR: <strong>{order.dispatchDocNo}</strong></span>
                        </div>
                      )}
                    </div>

                    {order.totalAmount > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-500 font-bold">Total Bill Value:</span>
                        <span className="font-mono font-black text-[#0F6E56] text-sm">
                          ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Items List Column */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Assigned Products to Pick ({order.items?.length || 0} line items)
                      </span>
                      <span className="text-[11px] font-black text-[#0F6E56]">
                        {totalItems} total units
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {order.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Batch: {item.batchNumber} {item.hsnCode ? `| HSN: ${item.hsnCode}` : ''} {item.weight ? `(${item.weight})` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="bg-emerald-50 text-[#0F6E56] font-black px-2.5 py-1 rounded-lg text-xs border border-emerald-200">
                              {item.quantity || item.requestedQuantity || 0} units
                            </span>
                            {item.price > 0 && (
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">₹{item.price}/unit</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Picking Progress Column */}
                  <div className="lg:col-span-3 flex flex-col justify-between bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                        Picking Progress
                      </span>

                      <div className="bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isRejectedOrCancelled ? 'bg-rose-500' : 'bg-[#0F6E56]'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2 text-xs font-bold text-slate-700">
                        <span>{totalPicked} of {totalItems} picked</span>
                        <span className="text-[#0F6E56]">{progressPercent}%</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-400 space-y-0.5">
                      <p>Terms: {order.termsOfDelivery || 'Door Delivery'}</p>
                      <p>Tally Status: <strong className="text-slate-600 uppercase font-mono">{order.tallySyncStatus || 'synced'}</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cancel Order Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <Ban className="w-5 h-5 text-rose-600" />
                <span>Cancel Order #{cancelModalOrder.invoiceNo}</span>
              </div>
              <button
                onClick={() => setCancelModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cancelling this order will mark it as <strong className="text-rose-700">CANCELLED</strong> across the warehouse web and mobile apps. Any picked boxes will be restored to available stock.
            </p>

            <form onSubmit={handleCancelOrderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Cancellation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Stock damaged, product unavailable, dealer requested cancellation..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  <span>{cancelling ? 'Cancelling...' : 'Confirm Order Cancellation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
