import React, { useState } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { PackagePlus, Upload, CheckCircle, QrCode, FileText, Plus, Trash2, Layers, Sparkles, Loader2 } from 'lucide-react';

export default function PurchaseEntry() {
  const navigate = useNavigate();
  const todayDate = new Date().toISOString().split('T')[0];

  const [headerData, setHeaderData] = useState({
    invoiceNumber: '',
    purchaseDate: todayDate,
    manufacturer: '',
    invoiceDate: todayDate,
    transport: '',
    lrNumber: ''
  });

  const [items, setItems] = useState([
    {
      id: 1,
      productName: '',
      batchNumber: '',
      quantity: '',
      weight: '',
      purchaseCost: '',
      mfgDate: todayDate,
      warehouseLocation: '',
      remarks: ''
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const [result, setResult] = useState(null);
  const [billFileName, setBillFileName] = useState('');

  const handleHeaderChange = (e) => {
    setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        productName: '',
        batchNumber: '',
        quantity: 10,
        weight: '1 kg',
        purchaseCost: 0,
        mfgDate: todayDate,
        warehouseLocation: 'Rack A1',
        remarks: ''
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setBillFileName(file.name);
    setOcrLoading(true);
    setOcrSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('billFile', file);

      const res = await api.post('/purchases/ocr-extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        const ocr = res.data.ocrData;

        // Auto-fill header fields
        setHeaderData(prev => ({
          ...prev,
          invoiceNumber: ocr.invoiceNumber || prev.invoiceNumber,
          manufacturer: ocr.manufacturer || prev.manufacturer,
          purchaseDate: ocr.purchaseDate || prev.purchaseDate,
          invoiceDate: ocr.purchaseDate || prev.invoiceDate,
          transport: ocr.transport || prev.transport,
          lrNumber: ocr.lrNumber || prev.lrNumber
        }));

        // Auto-fill product line items
        if (Array.isArray(ocr.items) && ocr.items.length > 0) {
          const formattedItems = ocr.items.map((item, idx) => ({
            id: Date.now() + idx,
            productName: item.productName || '',
            batchNumber: item.batchNumber || `BATCH-${Date.now().toString().slice(-4)}`,
            quantity: item.quantity || 10,
            weight: item.weight || item.packingSize || '1 kg',
            purchaseCost: item.purchaseCost || 0,
            mfgDate: item.mfgDate || todayDate,
            warehouseLocation: item.warehouseLocation || 'Rack A1',
            remarks: item.remarks || ''
          }));
          setItems(formattedItems);
        }

        setOcrSuccessMsg(`✨ Gemini 3.5 Flash-Lite AI extracted Invoice #${ocr.invoiceNumber || ''} with ${ocr.items?.length || 1} product line item(s)! Review and submit below.`);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('AI OCR extraction notice: ' + (err.response?.data?.message || err.message || 'Please fill in details manually.'));
    } finally {
      setOcrLoading(false);
    }
  };

  const totalBoxesCount = items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        ...headerData,
        items
      };
      const res = await api.post('/purchases', payload);
      if (res.data.success) {
        setResult(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
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
            <PackagePlus className="w-5 h-5 text-[#0F6E56]" />
            <span>Purchase Entry & Stock Reception</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log manufacturer purchase bills with single or multiple product line items and auto-generate QR stickers.
          </p>
        </div>
      </div>

      {/* Gemini AI OCR Extraction Success / Progress Banner */}
      {ocrLoading && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 flex items-center gap-3 shadow-md animate-pulse">
          <Loader2 className="w-6 h-6 text-[#0F6E56] animate-spin shrink-0" />
          <div>
            <h4 className="text-xs font-black text-[#0F6E56] uppercase tracking-wider">
              🤖 Gemini 3.5 Flash-Lite OCR in Progress...
            </h4>
            <p className="text-xs text-slate-700 font-medium mt-0.5">
              Analyzing purchase invoice PDF / image, extracting invoice number, manufacturer, dates, and all product line items.
            </p>
          </div>
        </div>
      )}

      {ocrSuccessMsg && !ocrLoading && (
        <div className="bg-gradient-to-r from-emerald-500 to-[#0F6E56] text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-black tracking-wide">AI OCR Extraction Complete</h4>
              <p className="text-xs text-white/90 font-medium">{ocrSuccessMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setOcrSuccessMsg('')}
            className="text-white/80 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border-2 border-[#1D9E75] rounded-2xl p-6 shadow-md text-slate-900 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-bold">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#0F6E56]">Purchase Bill Logged & QR Generated!</h3>
              <p className="text-xs text-slate-600 font-medium">{result.message}</p>
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Total Boxes</span>
              <p className="font-black text-slate-900 text-lg">{result.totalBoxesGenerated}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">First QR ID</span>
              <p className="font-mono font-bold text-[#0F6E56]">{result.firstQrId}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Last QR ID</span>
              <p className="font-mono font-bold text-[#0F6E56]">{result.lastQrId}</p>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => navigate(`/qr-print?purchaseId=${result.purchase._id}`)}
                className="w-full bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs py-2 px-3 rounded-lg shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                <span>Print QR Stickers</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Bill Upload / Gemini OCR Section */}
        <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-5 text-center transition-colors">
          <div className="w-10 h-10 rounded-2xl bg-[#0F6E56] text-white mx-auto flex items-center justify-center shadow-md mb-2">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-extrabold text-slate-800">
            🤖 Smart AI Bill OCR (Gemini 3.5 Flash-Lite)
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Upload Manufacturer Purchase Bill (PDF or JPG/PNG) to automatically extract and populate all fields
          </p>
          <input
            type="file"
            id="bill-file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileUpload}
            disabled={ocrLoading}
          />
          <label
            htmlFor="bill-file"
            className={`mt-3 inline-flex items-center gap-2 bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md transition-all ${
              ocrLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{ocrLoading ? 'Scanning with Gemini AI...' : (billFileName ? `Selected: ${billFileName} (Click to re-scan)` : 'Upload Bill for Instant AI Fill')}</span>
          </label>
        </div>

        {/* Section 1: Purchase & Transport Info */}
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 border-b border-slate-100 pb-1 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#0F6E56]" />
            <span>1. Invoice & Transport Details</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Number *</label>
              <input
                type="text"
                required
                name="invoiceNumber"
                value={headerData.invoiceNumber}
                onChange={handleHeaderChange}
                placeholder="e.g. INV-2026-991"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Manufacturer *</label>
              <input
                type="text"
                required
                name="manufacturer"
                value={headerData.manufacturer}
                onChange={handleHeaderChange}
                placeholder="e.g. Vaniki Crop Science Labs"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={headerData.purchaseDate}
                onChange={handleHeaderChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transport Company</label>
              <input
                type="text"
                name="transport"
                value={headerData.transport}
                onChange={handleHeaderChange}
                placeholder="e.g. VRL Logistics"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">LR Number</label>
              <input
                type="text"
                name="lrNumber"
                value={headerData.lrNumber}
                onChange={handleHeaderChange}
                placeholder="e.g. LR-88471"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Dynamic Product & Box Specifications with + Add Product Button */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0F6E56]" />
              <span>2. Product Specifications ({items.length} Product Item{items.length === 1 ? '' : 's'})</span>
            </h3>

            <button
              type="button"
              onClick={handleAddItem}
              className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product Item</span>
            </button>
          </div>

          {items.map((item, index) => (
            <div
              key={item.id}
              className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3 relative shadow-2xs hover:border-emerald-200 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-extrabold text-slate-800">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#0F6E56] text-[11px] flex items-center justify-center font-black">
                    {index + 1}
                  </span>
                  <span>Product Line Item #{index + 1}</span>
                </span>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                    title="Remove this product item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={item.productName}
                    onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                    placeholder="e.g. Crop Shield Super 500ml"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={item.batchNumber}
                    onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)}
                    placeholder="e.g. BATCH-2026A"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity (No. of Boxes) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="500"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Box Weight</label>
                  <input
                    type="text"
                    value={item.weight}
                    onChange={(e) => handleItemChange(index, 'weight', e.target.value)}
                    placeholder="e.g. 1 kg"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase Cost (per box)</label>
                  <input
                    type="number"
                    value={item.purchaseCost}
                    onChange={(e) => handleItemChange(index, 'purchaseCost', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warehouse Location / Rack</label>
                  <input
                    type="text"
                    value={item.warehouseLocation}
                    onChange={(e) => handleItemChange(index, 'warehouseLocation', e.target.value)}
                    placeholder="e.g. Rack A1-Bay 2"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={item.remarks}
                    onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                    placeholder="Optional notes..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Another Product Secondary Action */}
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 text-[#0F6E56] font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Product to Invoice</span>
          </button>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-600">
            Total Boxes to Generate: <strong className="text-[#0F6E56] font-black text-sm">{totalBoxesCount} Boxes</strong> across {items.length} product(s)
          </span>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#0F6E56] hover:bg-[#0B5442] disabled:opacity-50 text-white font-bold text-xs px-8 py-3 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>
              {loading
                ? 'Saving Purchase & Generating QRs...'
                : `Save Purchase & Generate ${totalBoxesCount} QR Stickers`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

