import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Plus, Building2, UserCheck, Sparkles, Scan, Loader2 } from 'lucide-react';

export default function InvoiceUpload() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);

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
    try {
      const [dRes, iRes, wRes] = await Promise.all([
        api.get('/dealers'),
        api.get('/invoices'),
        api.get('/invoices/workers')
      ]);
      if (dRes.data.success) setDealers(dRes.data.dealers);
      if (iRes.data.success) setInvoices(iRes.data.invoices);
      if (wRes.data.success) setWorkers(wRes.data.workers);
    } catch (err) {
      console.error('Fetch data error:', err);
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

  const [ocrMsg, setOcrMsg] = useState('');

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
          setOcrMsg(`✨ Extracted Invoice #${data.invoiceNo} (${data.items?.length || 1} items) using ${res.data.modelUsed || 'Gemini 3.5 Flash-Lite'}!`);
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
              🤖 Scanning Bill Document with OCR Engine... Extracting Products & Dealer
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
              ✕
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
                    👤 {w.name} (@{w.username})
                  </option>
                ))
              ) : (
                <option value="warehouse1">👤 Warehouse Operator (@warehouse1)</option>
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
                  ✕
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

      {/* Assigned Invoices List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-sm text-slate-900 mb-4">Assigned Sales Bills History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Invoice No</th>
                <th className="py-2.5 px-3">Dealer & Garage</th>
                <th className="py-2.5 px-3">Assigned Worker</th>
                <th className="py-2.5 px-3">Products & Qty</th>
                <th className="py-2.5 px-3">Picking Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-[#0F6E56]">{inv.invoiceNo}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {inv.dealerName} <span className="text-slate-400 font-normal">({inv.garageName})</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-purple-700">
                    <span className="bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                      👤 @{inv.assignedToUser || 'warehouse1'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {inv.items.map(i => `${i.productName} (${i.quantity} boxes)`).join(', ')}
                  </td>
                  <td className="py-3 px-3 font-bold uppercase text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full ${
                      inv.orderStatus === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      inv.orderStatus === 'picking_started' ? 'bg-amber-100 text-amber-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {inv.orderStatus || 'new'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => navigate(`/dispatch-verify?invoiceNo=${inv.invoiceNo}`)}
                      className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-[11px] px-3 py-1 rounded-lg"
                    >
                      View & Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

