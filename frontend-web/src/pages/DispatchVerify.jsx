import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import QRScannerModal from '../components/QRScannerModal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, Camera, CheckCircle2, XCircle, AlertTriangle, Truck, Send, Trash2 } from 'lucide-react';

export default function DispatchVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState(searchParams.get('invoiceNo') || '');
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [alreadyDispatchedBoxes, setAlreadyDispatchedBoxes] = useState([]);
  const [existingDispatch, setExistingDispatch] = useState(null);

  const [scanQrInput, setScanQrInput] = useState('');
  const [verifiedBoxes, setVerifiedBoxes] = useState([]);
  const [scanStatus, setScanStatus] = useState(null); // { type: 'GREEN' | 'RED', title, reason, box }
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Delivery Handover Form (Module 9)
  const [deliveryData, setDeliveryData] = useState({
    courierName: '',
    vehicleNumber: '',
    driverName: '',
    driverMobile: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    remarks: '',
    handoverTo: ''
  });

  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState('');
  const [dispatchSuccess, setDispatchSuccess] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (selectedInvoiceNo) {
      const found = invoices.find(i => i.invoiceNo === selectedInvoiceNo);
      setActiveInvoice(found || null);
      fetchExistingDispatchesForInvoice(selectedInvoiceNo);
    }
  }, [selectedInvoiceNo, invoices]);

  const fetchExistingDispatchesForInvoice = async (invNo) => {
    try {
      const res = await api.get('/dispatches');
      if (res.data.success && res.data.dispatches) {
        const found = res.data.dispatches.find(d => d.salesInvoiceNo === invNo);
        if (found) {
          setExistingDispatch(found);
          const boxList = (found.scannedBoxQrIds || []).map(qr => ({
            qrId: qr,
            productName: activeInvoice?.items?.[0]?.productName || 'Verified Product',
            batchNumber: activeInvoice?.items?.[0]?.batchNumber || 'Batch-2026',
            status: 'dispatched'
          }));
          setAlreadyDispatchedBoxes(boxList);
        } else {
          setExistingDispatch(null);
          setAlreadyDispatchedBoxes([]);
        }
      }
    } catch (e) {
      console.log('Error fetching existing dispatches:', e.message);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      if (res.data.success && res.data.invoices.length > 0) {
        setInvoices(res.data.invoices);
        const queryInv = searchParams.get('invoiceNo');
        if (queryInv) {
          setSelectedInvoiceNo(queryInv);
        } else {
          setSelectedInvoiceNo(res.data.invoices[0].invoiceNo);
        }
      }
    } catch (err) {
      console.error(err);
      setDispatchError('Could not load invoice list from server: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleVerifyScan = async (qrIdToTest) => {
    setDispatchError('');
    let targetQr = (qrIdToTest || scanQrInput).trim().toUpperCase();
    if (!targetQr) {
      setDispatchError('Please enter or scan a Box QR ID to verify.');
      return;
    }

    try {
      const res = await api.post('/dispatches/verify-scan', {
        qrId: targetQr,
        salesInvoiceNo: selectedInvoiceNo
      });

      if (res.data && res.data.verified) {
        if (verifiedBoxes.some(b => b.qrId === res.data.box.qrId)) {
          setScanStatus({
            type: 'RED',
            title: 'Already Scanned in Batch',
            reason: `Box ${res.data.box.qrId} is already added to this dispatch list!`
          });
        } else {
          setScanStatus({
            type: 'GREEN',
            title: res.data.title || '✓ VERIFIED - READY FOR DISPATCH',
            reason: res.data.reason || `Box ${targetQr} matches Invoice #${selectedInvoiceNo}.`,
            box: res.data.box
          });
          setVerifiedBoxes(prev => [...prev, res.data.box]);
        }
        setScanQrInput('');
        return;
      } else if (res.data && !res.data.verified) {
        setScanStatus({
          type: 'RED',
          title: res.data.title || '✖ MISMATCH DETECTED',
          reason: res.data.reason || res.data.message || 'Box QR does not match active Sales Invoice!'
        });
        setScanQrInput('');
        return;
      }
    } catch (err) {
      setScanStatus({
        type: 'RED',
        title: '✖ VERIFICATION ERROR',
        reason: err.response?.data?.message || err.message || 'Could not verify box QR with server.'
      });
      setScanQrInput('');
    }
  };

  const handleConfirmDispatch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setDispatchError('');
    setDispatchSuccess('');

    // 1. Validation: Checked boxes
    if (!verifiedBoxes || verifiedBoxes.length === 0) {
      setDispatchError(`⚠️ Cannot Confirm Dispatch: No boxes have been verified for Invoice #${selectedInvoiceNo || 'N/A'}. Please scan or enter at least 1 Box QR code in the Box Verification Guard on the left.`);
      return;
    }

    // 2. Validation: Courier Name
    if (!deliveryData.courierName || !deliveryData.courierName.trim()) {
      setDispatchError('⚠️ Courier Service Name is required. Please enter the transport / courier company name.');
      return;
    }

    // 3. Validation: Vehicle Number
    if (!deliveryData.vehicleNumber || !deliveryData.vehicleNumber.trim()) {
      setDispatchError('⚠️ Vehicle Number is required (e.g. MH-12-AB-1234).');
      return;
    }

    // 4. Validation: Driver Name
    if (!deliveryData.driverName || !deliveryData.driverName.trim()) {
      setDispatchError('⚠️ Driver Name is required.');
      return;
    }

    // 5. Validation: Driver Mobile
    if (!deliveryData.driverMobile || !deliveryData.driverMobile.trim()) {
      setDispatchError('⚠️ Driver Mobile number is required for dispatch handover.');
      return;
    }

    setDispatching(true);
    try {
      const res = await api.post('/dispatches/confirm', {
        salesInvoiceNo: selectedInvoiceNo,
        scannedQrIds: verifiedBoxes.map(b => b.qrId),
        ...deliveryData
      });

      if (res.data && res.data.success) {
        setDispatchSuccess(res.data.message || 'Dispatch confirmed successfully!');
        const dId = res.data.dispatch?._id || '';
        setTimeout(() => {
          if (dId) {
            navigate(`/delivery-statement?dispatchId=${dId}`);
          } else {
            navigate(`/delivery-statement`);
          }
        }, 800);
        return;
      } else {
        setDispatchError(res.data?.message || 'Dispatch confirmation failed. Please check details.');
      }
    } catch (err) {
      console.error('Dispatch confirmation error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Server error occurred while confirming dispatch.';
      setDispatchError(`✖ Dispatch Failed: ${errMsg}`);
    } finally {
      setDispatching(false);
    }
  };

  const removeVerifiedBox = (qrId) => {
    setVerifiedBoxes(prev => prev.filter(b => b.qrId !== qrId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0F6E56]" />
            <span>Dispatch Verification & Green/Red Screen Guard</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Warehouse person scans box QR before dispatch. Zero wrong dispatches guarantee.
          </p>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          <span>Launch Camera Scanner</span>
        </button>
      </div>

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(scannedText) => handleVerifyScan(scannedText)}
      />

      {/* Invoice Selector Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-auto flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Select Sales Invoice:</label>
          <select
            value={selectedInvoiceNo}
            onChange={(e) => setSelectedInvoiceNo(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] max-w-md"
          >
            <option value="">Select Invoice (or leave empty for General Stock Scan)...</option>
            {invoices.map(inv => {
              const productSummary = (inv.items || []).map(i => `${i.productName} (${i.quantity} boxes)`).join(', ') || 'General Products';
              return (
                <option key={inv._id} value={inv.invoiceNo}>
                  #{inv.invoiceNo} - {inv.dealerName || 'Dealer'} | Products: {productSummary}
                </option>
              );
            })}
          </select>
        </div>

        {activeInvoice && (
          <div className="text-xs flex items-center gap-4 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 text-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Assigned Dealer</span>
              <p className="font-extrabold text-[#0F6E56]">{activeInvoice.dealerName}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Garage</span>
              <p className="font-bold text-slate-700">{activeInvoice.garageName || 'Main Store'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Scanned</span>
              <p className="font-bold text-slate-900">{verifiedBoxes.length} Boxes</p>
            </div>
          </div>
        )}
      </div>

      {/* Ordered Products to Dispatch Card */}
      {activeInvoice && activeInvoice.items && activeInvoice.items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Order Bill Products To Dispatch ({activeInvoice.items.length} Products)
              </h2>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Invoice #{activeInvoice.invoiceNo}
            </span>
          </div>

          {existingDispatch && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[#0F6E56]">✓ DISPATCH STATEMENT ALREADY RECORDED:</span>
                <span>Statement #{existingDispatch.dispatchNo} ({existingDispatch.scannedBoxQrIds?.length || 0} boxes dispatched)</span>
              </div>
              <button
                onClick={() => navigate(`/delivery-statement?dispatchId=${existingDispatch._id}`)}
                className="bg-[#0F6E56] text-white font-extrabold px-3 py-1.5 rounded-lg hover:bg-[#0c5946] transition-colors"
              >
                View Delivery Statement ➔
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeInvoice.items.map((item, idx) => {
              const allBoxesForThisProduct = [
                ...alreadyDispatchedBoxes.filter(b => (b.productName || '').toLowerCase().trim() === (item.productName || '').toLowerCase().trim()),
                ...verifiedBoxes.filter(b => (b.productName || '').toLowerCase().trim() === (item.productName || '').toLowerCase().trim())
              ];
              const scannedForThisProduct = allBoxesForThisProduct.length;
              const isComplete = scannedForThisProduct >= item.quantity;
              const progressPct = Math.min(100, Math.round((scannedForThisProduct / (item.quantity || 1)) * 100));

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isComplete
                      ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300'
                      : scannedForThisProduct > 0
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 capitalize block">
                        {item.productName}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Batch: <span className="font-bold text-[#0F6E56]">{item.batchNumber || 'Any Batch'}</span> | Packing: {item.weight || item.packingSize || '1 kg'}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isComplete
                          ? 'bg-emerald-200 text-emerald-900'
                          : scannedForThisProduct > 0
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isComplete ? '✓ COMPLETED' : `${scannedForThisProduct} / ${item.quantity} BOXES`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2.5">
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isComplete ? 'bg-[#0F6E56]' : 'bg-amber-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mt-1">
                      <span>Progress</span>
                      <span>{progressPct}% ({scannedForThisProduct}/{item.quantity} verified)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual / Barcode Gun Input */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); handleVerifyScan(); }} className="flex gap-3">
          <input
            type="text"
            placeholder="Scan QR ID with Barcode Gun or Type (e.g. VNK-00000001)..."
            value={scanQrInput}
            onChange={(e) => setScanQrInput(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          />
          <button
            type="button"
            onClick={() => handleVerifyScan()}
            className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold text-xs px-6 py-3 rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Box QR Now</span>
          </button>
        </form>
      </div>

      {/* Dynamic GREEN / RED Verification Screen Overlay */}
      {scanStatus && (
        <div
          className={`rounded-3xl p-8 text-white shadow-2xl transition-all ${scanStatus.type === 'GREEN'
              ? 'bg-gradient-to-r from-[#1D9E75] to-[#0F6E56] border-4 border-emerald-300'
              : 'bg-gradient-to-r from-[#E53E3E] to-red-800 border-4 border-red-300'
            }`}
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              {scanStatus.type === 'GREEN' ? (
                <CheckCircle2 className="w-10 h-10 text-white animate-bounce" />
              ) : (
                <XCircle className="w-10 h-10 text-white animate-pulse" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                {scanStatus.type === 'GREEN' ? '✓ VERIFIED - MATCH CONFIRMED' : '✖ ALERT - MISMATCH DETECTED'}
              </span>
              <h2 className="text-2xl font-black">{scanStatus.title}</h2>
              <p className="text-sm text-white/90 font-medium">{scanStatus.reason}</p>
            </div>

            <button
              onClick={() => setScanStatus(null)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Verified Boxes Table & Courier Handover */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanned Items Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900">
              Verified Dispatch Queue ({verifiedBoxes.length} Boxes)
            </h3>
            {verifiedBoxes.length > 0 && (
              <button
                onClick={() => setVerifiedBoxes([])}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                Clear Queue
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">QR ID</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Weight</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verifiedBoxes.map((box, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-extrabold text-[#0F6E56]">{box.qrId}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{box.productName}</td>
                    <td className="py-3 px-3 text-slate-600">{box.batchNumber}</td>
                    <td className="py-3 px-3 text-slate-600">{box.weight}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold bg-emerald-100 text-[#0F6E56] px-2 py-0.5 rounded">
                        VERIFIED
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => removeVerifiedBox(box.qrId)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {verifiedBoxes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No boxes verified yet. Scan box QR codes to prepare for dispatch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Courier & Driver Handover Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#0F6E56] flex items-center gap-2">
              <Truck className="w-4 h-4" />
              <span>Courier & Transport Handover</span>
            </h3>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${verifiedBoxes.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {verifiedBoxes.length} Box{verifiedBoxes.length === 1 ? '' : 'es'} Ready
            </span>
          </div>

          {/* Error Banner */}
          {dispatchError && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-black block">Validation / Dispatch Error</span>
                <span className="font-medium text-[11px]">{dispatchError}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setDispatchError('')}
                className="text-red-400 hover:text-red-700 font-bold text-sm px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Success Banner */}
          {dispatchSuccess && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{dispatchSuccess}</span>
            </div>
          )}

          {verifiedBoxes.length === 0 && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Please scan & verify boxes for <strong>Invoice #{selectedInvoiceNo || 'N/A'}</strong> on the left to enable dispatch confirmation.</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Courier Service Name *</label>
              <input
                type="text"
                required
                value={deliveryData.courierName}
                onChange={(e) => {
                  setDispatchError('');
                  setDeliveryData({ ...deliveryData, courierName: e.target.value });
                }}
                placeholder="e.g. VRL Logistics, DTDC, Direct Truck"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vehicle Number *</label>
              <input
                type="text"
                required
                value={deliveryData.vehicleNumber}
                onChange={(e) => {
                  setDispatchError('');
                  setDeliveryData({ ...deliveryData, vehicleNumber: e.target.value });
                }}
                placeholder="e.g. MH-12-AB-8841"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Driver Name *</label>
              <input
                type="text"
                required
                value={deliveryData.driverName}
                onChange={(e) => {
                  setDispatchError('');
                  setDeliveryData({ ...deliveryData, driverName: e.target.value });
                }}
                placeholder="e.g. Rajesh Kumar"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Driver Mobile *</label>
              <input
                type="text"
                required
                value={deliveryData.driverMobile}
                onChange={(e) => {
                  setDispatchError('');
                  setDeliveryData({ ...deliveryData, driverMobile: e.target.value });
                }}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Delivery Date</label>
              <input
                type="date"
                value={deliveryData.deliveryDate}
                onChange={(e) => setDeliveryData({ ...deliveryData, deliveryDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmDispatch}
            disabled={dispatching}
            className={`w-full font-extrabold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 ${
              verifiedBoxes.length === 0 
                ? 'bg-slate-300 text-slate-600 hover:bg-slate-400 cursor-pointer' 
                : 'bg-[#0F6E56] hover:bg-[#0B5442] text-white shadow-emerald-900/10'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{dispatching ? 'Saving Dispatch...' : 'Confirm Dispatch & Generate Sheet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
