import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useSearchParams } from 'react-router-dom';
import { Truck, Printer, Download, Share2, FileText, Camera, CheckCircle2, Image as ImageIcon, Upload, Eye, X } from 'lucide-react';

export default function DeliveryStatement() {
  const [searchParams] = useSearchParams();
  const dispatchId = searchParams.get('dispatchId');

  const [dispatches, setDispatches] = useState([]);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // Photo upload states
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fullImageModal, setFullImageModal] = useState(null);

  useEffect(() => {
    fetchDispatches();
  }, [dispatchId]);

  const fetchDispatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dispatches');
      if (res.data.success) {
        setDispatches(res.data.dispatches);
        if (dispatchId) {
          const found = res.data.dispatches.find(d => d._id === dispatchId);
          if (found) setSelectedDispatch(found);
        } else if (res.data.dispatches.length > 0) {
          setSelectedDispatch(res.data.dispatches[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = (id) => {
    window.open(`/api/dispatches/${id}/pdf`, '_blank');
  };

  const handleWhatsAppShare = (dispatch) => {
    const text = `*VANIKI CROP SCIENCE - DELIVERY STATEMENT*\n\nStatement No: ${dispatch.dispatchNo}\nInvoice No: ${dispatch.salesInvoiceNo}\nDealer: ${dispatch.dealerId?.dealerName} (${dispatch.dealerId?.garageName})\nCourier: ${dispatch.courierName}\nVehicle: ${dispatch.vehicleNumber}\nTotal Boxes: ${dispatch.scannedBoxQrIds?.length || 0}\nDate: ${new Date(dispatch.dispatchDate).toLocaleDateString()}\n\nStatus: DISPATCH COMPLETED & VERIFIED.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Handle Photo selection from camera / file input
  const handlePhotoSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload photo proof to backend
  const handleSavePhotoProof = async () => {
    if (!photoPreview || !selectedDispatch) return;
    setUploadingPhoto(true);
    try {
      const res = await api.post('/dispatches/upload-photo', {
        dispatchId: selectedDispatch._id,
        salesInvoiceNo: selectedDispatch.salesInvoiceNo,
        photoUrl: photoPreview
      });
      if (res.data.success) {
        setSelectedDispatch(prev => ({
          ...prev,
          dispatchPhotoUrl: res.data.dispatchPhotoUrl,
          dispatchPhotoUploadedAt: new Date()
        }));
        setPhotoPreview(null);
        alert('📷 Loaded products photo proof saved successfully!');
        fetchDispatches();
      }
    } catch (err) {
      console.error('Photo save error:', err);
      alert(err.response?.data?.message || 'Could not save goods photo proof.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header (Hidden on Print) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#0F6E56]" />
            <span>Delivery Statements & Handover Sheet</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Auto-generated statements with QR box list, courier details, and final dispatched products photo proof.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading Delivery Statements...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dispatch List (Hidden on Print) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 no-print">
            <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider px-2">
              Recent Dispatches ({dispatches.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {dispatches.map(d => (
                <div
                  key={d._id}
                  onClick={() => {
                    setSelectedDispatch(d);
                    setPhotoPreview(null);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedDispatch?._id === d._id
                      ? 'bg-[#E1F5EE] border-[#0F6E56] shadow-sm'
                      : 'bg-white border-slate-200 hover:border-emerald-200'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-xs text-[#0F6E56]">{d.dispatchNo}</span>
                    <span className="text-[10px] text-slate-500">{new Date(d.dispatchDate).toLocaleDateString()}</span>
                  </div>
                  <p className="font-bold text-xs text-slate-900 mt-1">{d.dealerId?.dealerName}</p>
                  <p className="text-[11px] text-slate-600 font-medium">{d.dealerId?.garageName}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Invoice: #{d.salesInvoiceNo}</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md ${d.dispatchPhotoUrl ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {d.dispatchPhotoUrl ? '📷 Photo Proof Attached' : '📷 Photo Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statement Detail Card */}
          {selectedDispatch && (
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 printable-area">
              {/* Toolbar Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 no-print">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0F6E56] bg-emerald-100/70 px-2.5 py-1 rounded-full">
                    Statement #{selectedDispatch.dispatchNo}
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-1">Delivery Sheet Preview</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Statement</span>
                  </button>

                  <button
                    onClick={() => handleDownloadPdf(selectedDispatch._id)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2 rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={() => handleWhatsAppShare(selectedDispatch)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-colors flex items-center gap-1.5"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* LAST STEP: PHOTO CAPTURE PROOF BOX (Hidden on Print) */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-4 no-print border border-slate-800 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#0F6E56] text-white flex items-center justify-center font-bold">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">FINAL STEP: Dispatched Goods Photo Proof</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Click / Upload photo of loaded boxes/truck as final proof of dispatch</p>
                    </div>
                  </div>

                  {selectedDispatch.dispatchPhotoUrl && (
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Photo Proof Saved</span>
                    </span>
                  )}
                </div>

                {/* Display Saved Photo or Upload Controls */}
                {selectedDispatch.dispatchPhotoUrl ? (
                  <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={selectedDispatch.dispatchPhotoUrl}
                      alt="Dispatched Goods Proof"
                      className="w-32 h-24 object-cover rounded-lg border border-slate-600 cursor-pointer shadow"
                      onClick={() => setFullImageModal(selectedDispatch.dispatchPhotoUrl)}
                    />
                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <p className="text-xs font-bold text-emerald-400 flex items-center justify-center sm:justify-start gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Loaded Products Photo Verified & Stored
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Uploaded: {selectedDispatch.dispatchPhotoUploadedAt ? new Date(selectedDispatch.dispatchPhotoUploadedAt).toLocaleString() : 'Just now'}
                      </p>
                      <button
                        onClick={() => setFullImageModal(selectedDispatch.dispatchPhotoUrl)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Full Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {photoPreview ? (
                      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400">Preview Captured Photo:</span>
                          <button onClick={() => setPhotoPreview(null)} className="text-slate-400 hover:text-white text-xs font-bold">Retake / Clear</button>
                        </div>
                        <img src={photoPreview} alt="Captured Preview" className="w-full max-h-56 object-cover rounded-xl border border-slate-600" />
                        <button
                          onClick={handleSavePhotoProof}
                          disabled={uploadingPhoto}
                          className="w-full bg-[#0F6E56] hover:bg-[#0c5946] text-white font-extrabold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{uploadingPhoto ? 'Saving Photo Proof...' : '✅ Save Dispatched Products Photo Proof'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-800/50 rounded-xl p-5 text-center transition-colors">
                        <input
                          type="file"
                          id="dispatch-goods-photo"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handlePhotoSelect}
                        />
                        <label htmlFor="dispatch-goods-photo" className="cursor-pointer space-y-2 block">
                          <div className="w-12 h-12 bg-slate-700 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center shadow">
                            <Camera className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-white">Click Phone Camera / Select Photo of Loaded Products</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Capture all boxes on truck before finalizing dispatch</p>
                          </div>
                          <span className="inline-block bg-[#0F6E56] hover:bg-[#0c5946] text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow mt-2">
                            📷 Take / Upload Loaded Products Photo
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Action Bar (Hidden on Print) */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 text-[#0F6E56] font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                    #{selectedDispatch.dispatchNo}
                  </span>
                  <span className="text-xs font-bold text-slate-700">Invoice #{selectedDispatch.salesInvoiceNo}</span>
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-slate-300">
                    📦 A5 Box Attachment Format
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="bg-[#0F6E56] hover:bg-[#0c5946] text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print A5 Statement</span>
                  </button>

                  <button
                    onClick={() => handleDownloadPdf(selectedDispatch._id)}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download A5 PDF</span>
                  </button>

                  <button
                    onClick={() => handleWhatsAppShare(selectedDispatch)}
                    className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Statement Sheet Document (A5 Print & Box Attachment Optimized) */}
              <div id="printable-statement-area" className="border border-slate-300 rounded-xl p-4 bg-white space-y-3 font-sans shadow-sm max-w-[148mm] mx-auto text-xs">
                {/* Statement Header */}
                <div className="bg-[#0F6E56] text-white p-3.5 rounded-lg flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm tracking-tight">VANIKI CROP SCIENCE</h3>
                    <p className="text-[9px] text-emerald-100 font-medium uppercase tracking-wider">DELIVERY STATEMENT & BOX PACKING SLIP</p>
                  </div>
                  <div className="text-right text-[10px]">
                    <p className="font-mono font-bold text-xs">DSP #{selectedDispatch.dispatchNo}</p>
                    <p className="text-emerald-200">Invoice: #{selectedDispatch.salesInvoiceNo}</p>
                    <p className="text-emerald-200">{new Date(selectedDispatch.dispatchDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-[10px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="space-y-1">
                    <h4 className="font-black text-[#0F6E56] uppercase text-[9px] border-b border-slate-200 pb-0.5">
                      DEALER & DESTINATION
                    </h4>
                    <p className="font-extrabold text-slate-900 text-xs">{selectedDispatch.dealerId?.dealerName || selectedDispatch.dealerId?.firmName || 'N/A'}</p>
                    {selectedDispatch.dealerId?.garageName && (
                      <p className="font-bold text-[#0F6E56]">Store: {selectedDispatch.dealerId?.garageName}</p>
                    )}
                    <p className="text-slate-700 leading-tight">
                      📍 {[selectedDispatch.dealerId?.address, selectedDispatch.dealerId?.city, selectedDispatch.dealerId?.state, selectedDispatch.dealerId?.pincode].filter(Boolean).join(', ') || 'Address on file'}
                    </p>
                    <p className="text-slate-600">
                      Phone: <span className="font-bold text-slate-800">{selectedDispatch.dealerId?.phone || 'N/A'}</span> | GST: <span className="font-mono">{selectedDispatch.dealerId?.gstNumber || 'N/A'}</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-black text-[#0F6E56] uppercase text-[9px] border-b border-slate-200 pb-0.5">
                      COURIER & LOGISTICS
                    </h4>
                    <p className="text-slate-800 font-bold">Courier: <span className="text-slate-900">{selectedDispatch.courierName}</span></p>
                    <p className="font-mono font-bold text-slate-900">Vehicle: {selectedDispatch.vehicleNumber}</p>
                    <p className="text-slate-700">Driver: <span className="font-bold">{selectedDispatch.driverName}</span> ({selectedDispatch.driverMobile})</p>
                    <p className="text-slate-600">Handover To: {selectedDispatch.handoverTo || 'Delivery Agent'}</p>
                  </div>
                </div>

                {/* Scanned Items Summary */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <h4 className="font-extrabold text-[10px] text-slate-800">
                      Dispatched Boxes ({selectedDispatch.scannedBoxQrIds?.length || 0} Total Boxes)
                    </h4>
                    <span className="text-[10px] font-black text-[#0F6E56] bg-emerald-50 px-2 py-0.5 rounded">
                      Total: {selectedDispatch.scannedBoxQrIds?.length || 0} Boxes
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedDispatch.scannedBoxQrIds?.map((qr, idx) => (
                      <span key={idx} className="bg-slate-100 text-[#0F6E56] border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                        {qr}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Display Photo Proof on Printable Sheet if Available */}
                {selectedDispatch.dispatchPhotoUrl && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <h4 className="font-bold text-[10px] text-slate-800 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-[#0F6E56]" />
                      <span>Loaded Goods Physical Photo Proof</span>
                    </h4>
                    <img
                      src={selectedDispatch.dispatchPhotoUrl}
                      alt="Dispatched Loaded Goods Proof"
                      className="w-full max-h-36 object-cover rounded-lg border border-slate-300"
                    />
                  </div>
                )}

                {/* Signature Blocks */}
                <div className="grid grid-cols-3 gap-2 pt-3 text-[9px] text-slate-600 text-center border-t border-slate-300">
                  <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                    Prepared By: {selectedDispatch.verifiedBy || 'Warehouse'}
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    Driver Sign: ________
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    Dealer Sign: ________
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FULL IMAGE LIGHTBOX MODAL */}
      {fullImageModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl p-2">
            <button
              onClick={() => setFullImageModal(null)}
              className="absolute top-4 right-4 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={fullImageModal} alt="Full Loaded Goods Proof" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
