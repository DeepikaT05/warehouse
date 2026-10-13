import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Building2,
  UserCheck,
  Sparkles,
  Scan,
  Loader2,
  X,
  Eye,
  Search,
  RefreshCw,
  Calendar,
  Layers,
  Truck,
  ShieldCheck,
  Download,
  ExternalLink,
  FileText,
  Phone,
  MapPin,
  Tag,
  AlertTriangle,
  Check
} from 'lucide-react';

export default function InvoiceUpload() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewInvoiceQuery = searchParams.get('view');

  const [dealers, setDealers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvoices, setFetchingInvoices] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrMsg, setOcrMsg] = useState('');

  // Local Search & Filter for History Table
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected Invoice for "View Bill" Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [formData, setFormData] = useState({
    invoiceNo: '',
    orderId: '',
    dealerId: '',
    assignedToUser: 'warehouse1',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [
      { productName: '', batchNumber: '', quantity: 1, weight: '1 kg' }
    ]
  });

  const [fileName, setFileName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setFetchingInvoices(true);
    try {
      const [dRes, iRes, wRes] = await Promise.all([
        api.get('/dealers'),
        api.get('/invoices'),
        api.get('/invoices/workers')
      ]);
      if (dRes.data.success) setDealers(dRes.data.dealers);
      if (iRes.data.success) {
        // Sort newest invoices to top (by invoiceDate desc, then createdAt desc)
        const sorted = (iRes.data.invoices || []).sort((a, b) => {
          const dateA = new Date(a.invoiceDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.invoiceDate || b.createdAt || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (b.invoiceNo || '').localeCompare(a.invoiceNo || '');
        });
        setInvoices(sorted);
      }
      if (wRes.data.success) setWorkers(wRes.data.workers);
    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setFetchingInvoices(false);
    }
  };

  // Automatically open "View Bill" modal if `?view=INV-NO` is in URL
  useEffect(() => {
    if (viewInvoiceQuery && invoices.length > 0) {
      const found = invoices.find(
        inv => (inv.invoiceNo || '').toLowerCase() === viewInvoiceQuery.toLowerCase()
      );
      if (found) {
        setSelectedInvoice(found);
      }
    }
  }, [viewInvoiceQuery, invoices]);

  const handleCloseModal = () => {
    setSelectedInvoice(null);
    if (searchParams.get('view')) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('view');
        return next;
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productName: '', batchNumber: '', quantity: 1, weight: '1 kg' }]
    });
  };

  const removeItemRow = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, idx) => idx !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleFileUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      setOcrScanning(true);
      setOcrSuccess(false);
      setOcrMsg('');

      const ocrData = new FormData();
      ocrData.append('billFile', file);

      try {
        const res = await api.post('/invoices/ocr-extract', ocrData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success && res.data.ocrData) {
          const data = res.data.ocrData;
          setFormData(prev => ({
            ...prev,
            invoiceNo: data.invoiceNo || prev.invoiceNo,
            orderId: data.orderId || prev.orderId,
            dealerId: data.dealerId || prev.dealerId,
            invoiceDate: data.invoiceDate || prev.invoiceDate,
            items: data.items && data.items.length > 0 ? data.items : prev.items
          }));
          setOcrSuccess(true);
          setOcrMsg(`Extracted Invoice #${data.invoiceNo} (${data.items?.length || 1} items) using ${res.data.modelUsed || 'Gemini 3.8 Flash'}!`);
        }
      } catch (err) {
        console.error('OCR extract error:', err);
        alert('OCR Scan Notice: ' + (err.response?.data?.message || err.message));
      } finally {
        setOcrScanning(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.dealerId) {
      alert('Please select a dealer from Dealer Master!');
      return;
    }
    if (!formData.assignedToUser) {
      alert('Please select a warehouse worker to assign this bill!');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/invoices', formData);
      if (res.data.success) {
        alert(res.data.message);
        setFormData({
          invoiceNo: '',
          orderId: '',
          dealerId: '',
          assignedToUser: 'warehouse1',
          invoiceDate: new Date().toISOString().split('T')[0],
          items: [{ productName: '', batchNumber: '', quantity: 1, weight: '1 kg' }]
        });
        setFileName('');
        setOcrSuccess(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(d);
    }
  };

  // Filter invoices for history table
  const filteredInvoices = invoices.filter(inv => {
    if (statusFilter !== 'ALL') {
      const s = (inv.orderStatus || 'new').toLowerCase();
      if (statusFilter === 'NEW' && s !== 'new') return false;
      if (statusFilter === 'PICKING' && s !== 'picking_started') return false;
      if (statusFilter === 'COMPLETED' && s !== 'completed' && s !== 'warehouse_verified' && s !== 'dealer_approved') return false;
      if (statusFilter === 'REJECTED' && s !== 'rejected' && !inv.isRejected) return false;
    }
    if (tableSearch.trim()) {
      const term = tableSearch.toLowerCase().trim();
      const matchNo = inv.invoiceNo?.toLowerCase().includes(term);
      const matchDealer = inv.dealerName?.toLowerCase().includes(term);
      const matchGarage = inv.garageName?.toLowerCase().includes(term);
      const matchOrder = inv.buyerOrderNo?.toLowerCase().includes(term) || inv.orderId?.toLowerCase().includes(term);
      const matchWorker = inv.assignedToUser?.toLowerCase().includes(term);
      const matchDest = inv.destination?.toLowerCase().includes(term);
      const matchProduct = inv.items?.some(it => it.productName?.toLowerCase().includes(term));
      if (!matchNo && !matchDealer && !matchGarage && !matchOrder && !matchWorker && !matchDest && !matchProduct) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#0F6E56]" />
            <span>Assign Sales Bill (OCR Auto-Extract & Worker Assignment)</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Upload bill documents for OCR auto-extraction, review extracted line items, and assign directly to warehouse workers.
          </p>
        </div>
      </div>

      {/* Upload & OCR Dropzone */}
      <div className="border-2 border-dashed border-[#0F6E56] bg-emerald-50/50 rounded-2xl p-6 text-center space-y-3 relative overflow-hidden">
        {ocrScanning && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-10">
            <Loader2 className="w-8 h-8 text-[#0F6E56] animate-spin" />
            <p className="text-xs font-extrabold text-[#0F6E56] animate-pulse">
              Scanning Bill Document with OCR Engine... Extracting Products & Dealer
            </p>
          </div>
        )}

        <Scan className="w-10 h-10 text-[#0F6E56] mx-auto" />
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Upload Sales Bill / Invoice File (PDF, Image, Excel, Text)</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Our OCR engine automatically detects Invoice No, Dealer Profile, Product Names, Batch Numbers & Box Quantities.
          </p>
        </div>

        <input
          type="file"
          id="tally-file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.txt,.xml"
          onChange={handleFileUpload}
        />
        <label
          htmlFor="tally-file"
          className="inline-flex items-center gap-2 bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg cursor-pointer transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>{fileName ? `Uploaded: ${fileName}` : 'Choose Bill Document for OCR Scan'}</span>
        </label>

        {ocrSuccess && (
          <div className="bg-emerald-100 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 font-extrabold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0F6E56] shrink-0" />
              <span>{ocrMsg || 'OCR Extraction Complete! Invoice details & product items populated below.'}</span>
            </div>
            <button
              type="button"
              onClick={() => setOcrSuccess(false)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Manual Review & Worker Assignment Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#0F6E56]" />
            <span>Invoice & Worker Assignment Details</span>
          </h3>
          <span className="text-[11px] font-bold text-slate-400">Step 2: Assign Worker</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
            <input
              type="text"
              required
              value={formData.invoiceNo}
              onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
              placeholder="e.g. SL-INV-1092"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Order ID</label>
            <input
              type="text"
              value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
              placeholder="e.g. ORD-9982"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Dealer / Garage *</label>
            <select
              required
              value={formData.dealerId}
              onChange={(e) => setFormData({ ...formData, dealerId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            >
              <option value="">-- Select Dealer Master --</option>
              {dealers.map(d => (
                <option key={d._id} value={d._id}>
                  {d.dealerName} ({d.garageName}) - {d.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-purple-900 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-purple-700" />
              <span>Assign Worker (APK) *</span>
            </label>
            <select
              required
              value={formData.assignedToUser}
              onChange={(e) => setFormData({ ...formData, assignedToUser: e.target.value })}
              className="w-full bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-xs font-bold text-purple-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              {workers.length > 0 ? (
                workers.map(w => (
                  <option key={w._id} value={w.username}>
                    {w.name} (@{w.username})
                  </option>
                ))
              ) : (
                <option value="warehouse1">Warehouse Operator (@warehouse1)</option>
              )}
            </select>
          </div>
        </div>

        {/* Invoice Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-bold text-xs text-slate-700">Extracted Product Line Items (Quantities & Batches)</label>
            <button
              type="button"
              onClick={addItemRow}
              className="text-[#0F6E56] hover:underline font-bold text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item Line</span>
            </button>
          </div>

          {formData.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="col-span-4">
                <input
                  type="text"
                  required
                  placeholder="Product Name"
                  value={item.productName}
                  onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                />
              </div>

              <div className="col-span-3">
                <input
                  type="text"
                  required
                  placeholder="Batch Number"
                  value={item.batchNumber}
                  onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                />
              </div>

              <div className="col-span-2">
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Qty (Boxes)"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                />
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Weight"
                  value={item.weight}
                  onChange={(e) => handleItemChange(idx, 'weight', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                />
              </div>

              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => removeItemRow(idx)}
                  className="text-red-500 hover:text-red-700 font-bold text-xs p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
        >
          <UserCheck className="w-4 h-4" />
          <span>{loading ? 'Assigning Bill...' : `Assign Sales Bill to @${formData.assignedToUser} for Stock Picking`}</span>
        </button>
      </form>

      {/* Assigned Invoices List Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        {/* Table Top Controls: Title, Search, Refresh */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0F6E56]" />
              <span>Assigned Sales Bills History ({invoices.length})</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Recent bills are shown at the top. Click <strong className="text-slate-600 font-semibold">View Bill</strong> to see all items & details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search bill no, dealer, product..."
                className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] w-56 sm:w-64 transition-all"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchData}
              title="Refresh assigned bills"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchingInvoices ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100 text-xs">
          {[
            { id: 'ALL', label: 'All Bills', count: invoices.length },
            { id: 'NEW', label: 'New / Assigned', count: invoices.filter(i => (i.orderStatus || 'new') === 'new').length },
            { id: 'PICKING', label: 'Picking Started', count: invoices.filter(i => i.orderStatus === 'picking_started').length },
            { id: 'COMPLETED', label: 'Completed', count: invoices.filter(i => ['completed', 'warehouse_verified', 'dealer_approved'].includes(i.orderStatus)).length },
            { id: 'REJECTED', label: 'Rejected', count: invoices.filter(i => i.orderStatus === 'rejected' || i.isRejected).length }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-[#0F6E56] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Invoice No & Date</th>
                <th className="py-2.5 px-3">Dealer & Garage</th>
                <th className="py-2.5 px-3">Assigned Worker</th>
                <th className="py-2.5 px-3">Products & Qty</th>
                <th className="py-2.5 px-3">Picking Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map(inv => {
                const isRejected = inv.orderStatus === 'rejected' || inv.isRejected;
                const isCancelled = inv.orderStatus === 'cancelled' || inv.isCancelled;
                const totalBoxes = inv.items?.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) || 0;

                return (
                  <tr key={inv._id} className="hover:bg-slate-50 transition-colors">
                    {/* Invoice No & Date */}
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-left font-mono font-black text-[#0F6E56] hover:underline flex items-center gap-1 group"
                        title="Click to view bill details"
                      >
                        <span>{inv.invoiceNo}</span>
                        <Eye className="w-3 h-3 text-slate-400 group-hover:text-[#0F6E56] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(inv.invoiceDate || inv.createdAt)}</span>
                      </div>
                    </td>

                    {/* Dealer & Garage */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">
                        {inv.dealerName}
                      </div>
                      {inv.garageName && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          Store: {inv.garageName}
                        </div>
                      )}
                      {inv.destination && (
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{inv.destination}</span>
                        </div>
                      )}
                    </td>

                    {/* Assigned Worker */}
                    <td className="py-3 px-3">
                      <span className="bg-purple-50 text-purple-800 font-bold px-2 py-1 rounded-md border border-purple-100 inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-purple-600" />
                        <span>@{inv.assignedToUser || 'warehouse1'}</span>
                      </span>
                    </td>

                    {/* Products & Qty */}
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-left group text-slate-700 hover:text-[#0F6E56]"
                        title="Click to view full line items breakdown"
                      >
                        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400 group-hover:text-[#0F6E56]" />
                          <span>{totalBoxes} Boxes ({inv.items?.length || 0} items)</span>
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 max-w-xs group-hover:underline">
                          {inv.items?.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                        </div>
                      </button>
                    </td>

                    {/* Picking Status */}
                    <td className="py-3 px-3 font-bold uppercase text-[10px]">
                      {isRejected ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                          REJECTED
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                          CANCELLED
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full ${
                          inv.orderStatus === 'completed' || inv.orderStatus === 'warehouse_verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.orderStatus === 'picking_started'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {inv.orderStatus || 'new'}
                        </span>
                      )}
                    </td>

                    {/* Actions: View Bill + View & Verify */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="bg-emerald-50 hover:bg-[#0F6E56] text-[#0F6E56] hover:text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="View what is inside this bill"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Bill</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/dispatch-verify?invoiceNo=${inv.invoiceNo}`)}
                          className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Open QR Dispatch Verification"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && !fetchingInvoices && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No Sales Bills Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {tableSearch ? `No bills matching "${tableSearch}"` : 'Upload or sync a bill to see it here.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* "VIEW BILL" MODAL: WHAT IS INSIDE THE BILL                */}
      {/* ========================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0F6E56] flex items-center justify-center shrink-0 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Bill #{selectedInvoice.invoiceNo}
                    </h3>
                    {selectedInvoice.orderStatus === 'rejected' || selectedInvoice.isRejected ? (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        REJECTED
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-[#0F6E56] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        {selectedInvoice.orderStatus || 'NEW'}
                      </span>
                    )}
                    {(selectedInvoice.isB2BOrder || selectedInvoice.centralInvoiceId) && (
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        Tally B2B Bill
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Invoice Date: <strong className="text-slate-700">{formatDate(selectedInvoice.invoiceDate || selectedInvoice.createdAt)}</strong>
                    {selectedInvoice.buyerOrderNo && ` • Buyer Order #${selectedInvoice.buyerOrderNo}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Rejection Alert Banner if any */}
              {(selectedInvoice.isRejected || selectedInvoice.orderStatus === 'rejected') && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-black">Bill Rejection Recorded</strong>
                    <span>{selectedInvoice.rejectionReason || 'No rejection reason specified.'}</span>
                    {selectedInvoice.rejectedAt && (
                      <span className="block text-[10px] text-rose-500 mt-0.5">
                        Date: {formatDate(selectedInvoice.rejectedAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Information Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Dealer & Buyer Information */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs pb-1.5 border-b border-slate-200/80">
                    <Building2 className="w-4 h-4 text-[#0F6E56]" />
                    <span>Dealer & Destination Information</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Dealer Name:</span>
                      <strong className="text-slate-900 text-right">{selectedInvoice.dealerName || 'Direct'}</strong>
                    </div>
                    {selectedInvoice.garageName && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Garage / Store:</span>
                        <span className="text-slate-700 font-bold text-right">{selectedInvoice.garageName}</span>
                      </div>
                    )}
                    {selectedInvoice.dealerPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Phone / Mobile:</span>
                        <span className="text-slate-700 font-mono text-right">{selectedInvoice.dealerPhone}</span>
                      </div>
                    )}
                    {selectedInvoice.dealerGst && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">GSTIN:</span>
                        <span className="text-slate-700 font-mono font-bold text-right">{selectedInvoice.dealerGst}</span>
                      </div>
                    )}
                    {selectedInvoice.destination && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Destination:</span>
                        <span className="text-[#0F6E56] font-bold text-right">{selectedInvoice.destination}</span>
                      </div>
                    )}
                    {selectedInvoice.dealerAddress && (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span className="text-slate-400 font-medium block">Address:</span>
                        {selectedInvoice.dealerAddress}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Order & Assignment Metadata */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs pb-1.5 border-b border-slate-200/80">
                    <UserCheck className="w-4 h-4 text-purple-700" />
                    <span>Order & Worker Details</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Assigned Worker:</span>
                      <strong className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        @{selectedInvoice.assignedToUser || 'warehouse1'}
                      </strong>
                    </div>
                    {selectedInvoice.orderId && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Internal Order ID:</span>
                        <span className="font-mono text-slate-700">{selectedInvoice.orderId}</span>
                      </div>
                    )}
                    {selectedInvoice.despatchedThrough && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Despatched Through:</span>
                        <span className="text-slate-700 font-bold">{selectedInvoice.despatchedThrough}</span>
                      </div>
                    )}
                    {selectedInvoice.paymentTerms && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Payment Terms:</span>
                        <span className="text-slate-700">{selectedInvoice.paymentTerms}</span>
                      </div>
                    )}
                    {selectedInvoice.termsOfDelivery && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Terms of Delivery:</span>
                        <span className="text-slate-700">{selectedInvoice.termsOfDelivery}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Products & Line Items Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-[#0F6E56]" />
                    <span>Line Items Breakdown ({selectedInvoice.items?.length || 0} Products)</span>
                  </div>
                  <span className="text-xs font-bold text-slate-600">
                    Total: {selectedInvoice.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} Boxes
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3">Product Name & Specifications</th>
                        <th className="py-2.5 px-3">Batch Number</th>
                        <th className="py-2.5 px-3">Pack / Weight</th>
                        <th className="py-2.5 px-3 text-center">Boxes (Qty)</th>
                        {selectedInvoice.items?.some(it => it.price > 0) && (
                          <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        )}
                        {selectedInvoice.items?.some(it => it.total > 0) && (
                          <th className="py-2.5 px-3 text-right">Total (₹)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {item.productName}
                            {item.hsnCode && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                HSN: {item.hsnCode}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700">
                            {item.batchNumber || 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {item.weight || '1 kg'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-black text-sm text-[#0F6E56] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                              {item.quantity}
                            </span>
                          </td>
                          {selectedInvoice.items?.some(it => it.price > 0) && (
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              {item.price > 0 ? `₹${Number(item.price).toLocaleString('en-IN')}` : '-'}
                            </td>
                          )}
                          {selectedInvoice.items?.some(it => it.total > 0) && (
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {item.total > 0 ? `₹${Number(item.total).toLocaleString('en-IN')}` : '-'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals if available */}
                {(selectedInvoice.totalAmount > 0 || selectedInvoice.subtotal > 0) && (
                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col items-end gap-1 text-xs">
                    {selectedInvoice.subtotal > 0 && (
                      <div className="flex justify-between w-60 text-slate-500 font-medium">
                        <span>Subtotal:</span>
                        <span>₹{Number(selectedInvoice.subtotal).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedInvoice.totalTaxAmount > 0 && (
                      <div className="flex justify-between w-60 text-slate-500 font-medium">
                        <span>Tax / GST:</span>
                        <span>₹{Number(selectedInvoice.totalTaxAmount).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between w-60 text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                      <span>Grand Total:</span>
                      <span className="text-[#0F6E56]">₹{Number(selectedInvoice.totalAmount).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tally Invoice PDF Link if present */}
              {(selectedInvoice.b2bPdfUrl || selectedInvoice.billFileUrl) && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#0F6E56]" />
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">Original Bill / Invoice Document</h4>
                      <p className="text-[11px] text-emerald-700">Official bill PDF attached to this sales order.</p>
                    </div>
                  </div>
                  <a
                    href={selectedInvoice.b2bPdfUrl || selectedInvoice.billFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#0F6E56] hover:bg-[#0B5442] text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View / Download PDF</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseModal}
                className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl border border-slate-200 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const invNo = selectedInvoice.invoiceNo;
                    handleCloseModal();
                    navigate(`/delivery-statement?invoiceNo=${encodeURIComponent(invNo)}`);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Bilty / Statement</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const invNo = selectedInvoice.invoiceNo;
                    handleCloseModal();
                    navigate(`/dispatch-verify?invoiceNo=${encodeURIComponent(invNo)}`);
                  }}
                  className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Proceed to Dispatch Verification</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
