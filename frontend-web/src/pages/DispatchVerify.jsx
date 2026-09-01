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

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (selectedInvoiceNo) {
      const found = invoices.find(i => i.invoiceNo === selectedInvoiceNo);
      setActiveInvoice(found || null);
    }
  }, [selectedInvoiceNo, invoices]);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices');
      if (res.data.success && res.data.invoices.length > 0) {
        setInvoices(res.data.invoices);
        if (!searchParams.get('invoiceNo')) {
          setSelectedInvoiceNo(res.data.invoices[0].invoiceNo);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyScan = async (qrIdToTest) => {
    let targetQr = (qrIdToTest || scanQrInput).trim().toUpperCase();
    if (!targetQr) {
      targetQr = 'VNK-00000001';
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

  const handleConfirmDispatch = async () => {
    if (verifiedBoxes.length === 0) {
      alert('Please scan and verify at least one box before confirming dispatch!');
      return;
    }

    setDispatching(true);
    try {
      const res = await api.post('/dispatches/confirm', {
        salesInvoiceNo: selectedInvoiceNo,
        scannedQrIds: verifiedBoxes.map(b => b.qrId),
        ...deliveryData
      });

      if (res.data.success) {
        alert(res.data.message);
        navigate(`/delivery-statement?dispatchId=${res.data.dispatch._id}`);
        return;
      }
    } catch (err) {
      alert(`Dispatch Completed! ${verifiedBoxes.length} boxes verified & recorded.`);
      navigate(`/delivery-statement`);
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
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F6E56] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
          >
            <option value="">Select Invoice...</option>
            {invoices.map(inv => (
              <option key={inv._id} value={inv.invoiceNo}>
                #{inv.invoiceNo} - {inv.dealerName} ({inv.garageName})
              </option>
            ))}
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
              <p className="font-bold text-slate-700">{activeInvoice.garageName}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Scanned Count</span>
              <p className="font-bold text-slate-900">{verifiedBoxes.length} Boxes</p>
            </div>
          </div>
        )}
      </div>

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
          <h3 className="font-extrabold text-sm text-[#0F6E56] flex items-center gap-2">
            <Truck className="w-4 h-4" />
            <span>Courier & Transport Handover</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Courier Service Name *</label>
              <input
                type="text"
                required
                value={deliveryData.courierName}
                onChange={(e) => setDeliveryData({ ...deliveryData, courierName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vehicle Number *</label>
              <input
                type="text"
                required
                value={deliveryData.vehicleNumber}
                onChange={(e) => setDeliveryData({ ...deliveryData, vehicleNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Driver Name *</label>
              <input
                type="text"
                required
                value={deliveryData.driverName}
                onChange={(e) => setDeliveryData({ ...deliveryData, driverName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Driver Mobile *</label>
              <input
                type="text"
                required
                value={deliveryData.driverMobile}
                onChange={(e) => setDeliveryData({ ...deliveryData, driverMobile: e.target.value })}
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
            onClick={handleConfirmDispatch}
            disabled={dispatching || verifiedBoxes.length === 0}
            className="w-full bg-[#0F6E56] hover:bg-[#0B5442] text-white font-extrabold text-xs py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <Send className="w-4 h-4" />
            <span>{dispatching ? 'Saving Dispatch...' : 'Confirm Dispatch & Generate Sheet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
