import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Plus, Building2 } from 'lucide-react';

export default function InvoiceUpload() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    invoiceNo: '',
    orderId: '',
    dealerId: '',
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
      const [dRes, iRes] = await Promise.all([
        api.get('/dealers'),
        api.get('/invoices')
      ]);
      if (dRes.data.success) setDealers(dRes.data.dealers);
      if (iRes.data.success) setInvoices(iRes.data.invoices);
    } catch (err) {
      console.error(err);
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

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      // Mock Tally Invoice Extraction Auto-fill
      setFormData(prev => ({
        ...prev,
        invoiceNo: `TALLY-${Math.floor(1000 + Math.random() * 9000)}`,
        orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.dealerId) {
      alert('Please select a dealer from Dealer Master!');
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
          invoiceDate: new Date().toISOString().split('T')[0],
          items: [{ productName: '', batchNumber: '', quantity: 1, weight: '1 kg' }]
        });
        setFileName('');
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#0F6E56]" />
            <span>Import Sales Invoice (Tally / Excel)</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Import sales invoices to assign products, dealer profiles, and expected dispatch quantities.
          </p>
        </div>
      </div>

      {/* Upload Tally Box */}
      <div className="border-2 border-dashed border-[#0F6E56] bg-emerald-50/50 rounded-2xl p-6 text-center space-y-2">
        <Upload className="w-8 h-8 text-[#0F6E56] mx-auto" />
        <h3 className="font-extrabold text-sm text-slate-900">Upload Tally Export / Excel Sales Invoice</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Upload Tally XML, Excel, or PDF file to automatically extract Invoice No, Dealer, Products, and Quantities.
        </p>
        <input
          type="file"
          id="tally-file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.pdf,.xml"
          onChange={handleFileUpload}
        />
        <label
          htmlFor="tally-file"
          className="inline-block bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg cursor-pointer transition-colors"
        >
          {fileName ? `File Selected: ${fileName}` : 'Choose Tally / Excel File'}
        </label>
      </div>

      {/* Manual / Verified Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
          Sales Invoice Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
            <label className="block font-bold text-slate-700 mb-1">Assign Dealer / Garage *</label>
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
        </div>

        {/* Invoice Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-bold text-xs text-slate-700">Invoice Items (Products & Quantity)</label>
            <button
              type="button"
              onClick={addItemRow}
              className="text-[#0F6E56] hover:underline font-bold text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
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
                  placeholder="Qty"
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
          <FileSpreadsheet className="w-4 h-4" />
          <span>{loading ? 'Importing Sales Invoice...' : 'Save & Assign Sales Invoice for Dispatch'}</span>
        </button>
      </form>

      {/* Imported Invoices List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-extrabold text-sm text-slate-900 mb-4">Imported Sales Invoices</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Invoice No</th>
                <th className="py-2.5 px-3">Order ID</th>
                <th className="py-2.5 px-3">Dealer Name</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-[#0F6E56]">{inv.invoiceNo}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{inv.orderId}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {inv.dealerName} <span className="text-slate-400 font-normal">({inv.garageName})</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {inv.items.map(i => `${i.productName} (${i.quantity} boxes)`).join(', ')}
                  </td>
                  <td className="py-3 px-3 font-bold uppercase text-[10px] text-[#0F6E56]">
                    {inv.status}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => navigate(`/dispatch-verify?invoiceNo=${inv.invoiceNo}`)}
                      className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-[11px] px-3 py-1 rounded-lg"
                    >
                      Scan & Dispatch
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
