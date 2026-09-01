import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, QrCode, CheckCircle2, AlertTriangle, ArrowLeft, Trash2, PackageCheck, Layers, FileSpreadsheet } from 'lucide-react';

export default function StockPicking() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');

  const [scanResult, setScanResult] = useState(null); // { valid: true/false, message, title }
  const [scanProcessing, setScanProcessing] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/user/orders/${id}`);
      if (res.data.success) {
        setOrder(res.data.order);
      }
    } catch (err) {
      console.error('Fetch order error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPicking = async () => {
    try {
      const res = await api.post(`/user/orders/${id}/start-picking`);
      if (res.data.success) {
        fetchOrderDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const executeScan = async (codeToScan) => {
    const targetCode = (codeToScan || barcodeInput).trim();
    if (!targetCode) return;

    setScanProcessing(true);
    setScanResult(null);

    try {
      const res = await api.post(`/user/orders/${id}/scan-item`, {
        barcode: targetCode
      });

      if (res.data.valid) {
        setScanResult({
          valid: true,
          title: res.data.alreadyPicked ? 'Already Picked' : '✓ Item Picked Successfully',
          message: res.data.message
        });
        setBarcodeInput('');
        fetchOrderDetails();
      } else {
        setScanResult({
          valid: false,
          title: res.data.title || 'Scan Error',
          message: res.data.message || 'Invalid product scan.'
        });
        setBarcodeInput('');
      }
    } catch (err) {
      setScanResult({
        valid: false,
        title: 'Scan Mismatch',
        message: err.response?.data?.message || err.message
      });
    } finally {
      setScanProcessing(false);
    }
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    executeScan();
  };

  const handleCompletePicking = async () => {
    try {
      const res = await api.post(`/user/orders/${id}/complete-picking`);
      if (res.data.success) {
        alert('Stock picking completed for this bill!');
        navigate(`/dispatch-verify?orderId=${order._id}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading stock picking session...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center text-xs text-slate-500 font-medium">Order bill not found.</div>;
  }

  const totalRequired = order.items?.reduce((acc, item) => acc + (item.quantity || item.requestedQuantity || 0), 0) || 0;
  const totalPicked = order.pickedItems?.length || 0;
  const isFullyPicked = totalPicked >= totalRequired;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/assigned-orders')}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assigned Orders</span>
          </button>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-[#0F6E56]" />
            <span>Stock Picking & Barcode Scan Matching</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Order Bill #{order.invoiceNo} • Dealer: <strong>{order.dealerName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {order.orderStatus === 'new' || order.orderStatus === 'viewed' ? (
            <button
              onClick={handleStartPicking}
              className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Start Stock Picking</span>
            </button>
          ) : (
            <button
              onClick={handleCompletePicking}
              disabled={!isFullyPicked}
              className={`font-bold text-xs px-5 py-2.5 rounded-xl shadow flex items-center gap-2 transition-all ${
                isFullyPicked ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isFullyPicked ? 'Complete Stock Picking' : `Picking In Progress (${totalPicked}/${totalRequired})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Picking Progress Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700">Stock Picking Completion Progress</span>
          <span className="text-[#0F6E56]">{totalPicked} of {totalRequired} Units Scanned ({totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0}%)</span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-[#0F6E56] h-full rounded-full transition-all"
            style={{ width: `${totalRequired > 0 ? Math.min(100, (totalPicked / totalRequired) * 100) : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Barcode Scanner Input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#0F6E56]" />
          <span>Scan Product Barcode / QR Sticker</span>
        </h3>

        <form onSubmit={handleScanSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              autoFocus
              placeholder="Scan QR sticker or enter Product Name / Product ID / Barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-4 py-3 text-sm font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>
          <button
            type="submit"
            disabled={scanProcessing || !barcodeInput.trim()}
            className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-6 py-3 rounded-xl shadow transition-all flex items-center gap-2"
          >
            <span>{scanProcessing ? 'Validating...' : 'Validate & Add Item'}</span>
          </button>
        </form>

        {/* Real-time Scan Result Alert Banner */}
        {scanResult && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            scanResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {scanResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div>
              <p className="font-extrabold">{scanResult.title}</p>
              <p className="mt-0.5">{scanResult.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bill Items vs Picked Items Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Required Order Lines */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#0F6E56]" />
            <span>Required Bill Line Items</span>
          </h3>

          <div className="space-y-3">
            {order.items?.map((item, idx) => {
              const pickedCount = order.pickedItems?.filter(p =>
                p.productName.toLowerCase().trim() === item.productName.toLowerCase().trim()
              ).length || 0;

              const reqQty = item.quantity || item.requestedQuantity || 0;
              const isCompleted = pickedCount >= reqQty;

              return (
                <div key={idx} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCompleted ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <p className="font-extrabold text-xs text-slate-900">{item.productName}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {item.batchNumber ? `Batch: ${item.batchNumber} • ` : ''}Packing: {item.weight || '1 kg'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      isCompleted ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {pickedCount} / {reqQty} Picked
                    </span>

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => executeScan(item.productName)}
                        disabled={scanProcessing}
                        className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg shadow-xs transition-all flex items-center gap-1"
                      >
                        <span>+ Pick Item</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Currently Picked Scanned Items */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0F6E56]" />
            <span>Scanned & Verified Picked Items ({order.pickedItems?.length || 0})</span>
          </h3>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">QR ID</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3">Scanned Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!order.pickedItems || order.pickedItems.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-slate-400 font-medium">
                      No items scanned yet. Scan a sticker barcode above.
                    </td>
                  </tr>
                ) : (
                  order.pickedItems.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-[#0F6E56]">{p.qrId}</td>
                      <td className="p-3 font-bold">{p.productName}</td>
                      <td className="p-3 font-medium text-slate-600">{p.batchNumber}</td>
                      <td className="p-3 text-slate-400 text-[11px]">{new Date(p.scannedAt).toLocaleTimeString()}</td>
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
