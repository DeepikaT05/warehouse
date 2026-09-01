import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Truck, CheckCircle2, Clock, FileText, Camera, AlertCircle, Eye, X } from 'lucide-react';

export default function DealerApprovalTracker() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPhoto, setModalPhoto] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/orders');
      if (res.data.success) {
        // Filter orders that have been sent to dealer or are completed
        const tracked = res.data.orders.filter(o =>
          ['sent_to_dealer', 'dealer_approved', 'completed'].includes(o.orderStatus)
        );
        setOrders(tracked);
      }
    } catch (err) {
      console.error('Fetch dealer tracking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e, order) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoUrl = reader.result;
        try {
          const res = await api.post('/dispatches/upload-photo', {
            salesInvoiceNo: order.invoiceNo,
            photoUrl
          });
          if (res.data.success) {
            alert('📷 Physical Goods Photo Proof saved successfully!');
            fetchOrders();
          }
        } catch (err) {
          alert('Could not save photo proof.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-[#0F6E56]" />
            <span>Dealer Receiving & Dispatched Goods Photo Tracker</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track real-time dealer approval status, bilty transport proof, and physical loaded goods photo proof.
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium">Loading dealer approval status...</div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs font-medium">
            No dispatched orders currently pending dealer receiving or approval.
          </div>
        ) : (
          orders.map((order) => (
            <div key={order._id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-[#0F6E56]">Bill #{order.invoiceNo}</span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${order.orderStatus === 'completed' || order.dealerApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                      }`}>
                      {order.dealerApproved ? 'DEALER APPROVED' : 'RECEIVING PENDING'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    Dealer: {order.dealerName} {order.garageName ? `(${order.garageName})` : ''}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 text-[11px] font-medium block">Dispatched On:</span>
                  <span className="font-bold text-xs text-slate-700">
                    {order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* 1. Dealer Receiving Status */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700">Dealer Receiving Status</span>
                  {order.dealerApproved ? (
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approved by Dealer</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600 font-bold mt-1">
                      <Clock className="w-4 h-4" />
                      <span>Waiting for Dealer App</span>
                    </div>
                  )}
                  {order.dealerApprovedAt && (
                    <p className="text-[11px] text-slate-500">Time: {new Date(order.dealerApprovedAt).toLocaleString()}</p>
                  )}
                </div>

                {/* 2. Bilty Document Status */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700">Bilty / Transport Document</span>
                  {order.biltyUploaded && order.biltyUrl ? (
                    <div className="mt-1">
                      <a
                        href={order.biltyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F6E56] underline"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View / Download Bilty</span>
                      </a>
                      <p className="text-[10px] text-slate-400 mt-1">Uploaded by Dealer App</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-500 font-medium mt-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>Bilty pending from dealer</span>
                    </div>
                  )}
                </div>

                {/* 3. Dispatched Goods Photo Proof */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700">Dispatched Goods Photo Proof</span>
                  {order.dispatchPhotoUrl ? (
                    <div className="mt-1 flex items-center gap-2">
                      <img
                        src={order.dispatchPhotoUrl}
                        alt="Goods Proof"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-300 cursor-pointer shadow-xs"
                        onClick={() => setModalPhoto(order.dispatchPhotoUrl)}
                      />
                      <div>
                        <button
                          onClick={() => setModalPhoto(order.dispatchPhotoUrl)}
                          className="text-[11px] font-bold text-[#0F6E56] hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Photo
                        </button>
                        <span className="text-[9px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          ✓ Photo Saved
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <input
                        type="file"
                        id={`photo-${order._id}`}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, order)}
                      />
                      <label
                        htmlFor={`photo-${order._id}`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#0F6E56] hover:bg-[#0c5946] px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" /> Upload Goods Photo
                      </label>
                    </div>
                  )}
                </div>

                {/* 4. Transport Details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700">Transport & Vehicle Info</span>
                  <p className="font-medium text-slate-800 mt-1">{order.transportName || 'Direct Transport'}</p>
                  <p className="text-[11px] text-slate-500">Vehicle: {order.vehicleNumber || 'N/A'} • LR: {order.lrNumber || 'N/A'}</p>
                  <p className="text-[11px] text-slate-500">Driver: {order.driverName} ({order.driverPhone})</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FULL PHOTO LIGHTBOX MODAL */}
      {modalPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl p-2">
            <button
              onClick={() => setModalPhoto(null)}
              className="absolute top-4 right-4 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={modalPhoto} alt="Dispatched Goods Photo Proof" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
