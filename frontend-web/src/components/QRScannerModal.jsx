import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const scanner = new Html5QrcodeScanner(
        "webcam-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
          scanner.clear().catch(err => console.error(err));
          onClose();
        },
        (error) => {
          // ignore scan errors
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error(err));
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2 text-[#0F6E56] font-bold text-sm">
            <Camera className="w-5 h-5" />
            <span>Scan Box QR / Barcode</span>
          </div>
          <button
            onClick={() => {
              if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {});
              }
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-slate-50 border-2 border-emerald-200 p-2 shadow-inner">
          <div id="webcam-reader" className="w-full"></div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Align box QR code inside the camera frame to scan automatically.
        </p>
      </div>
    </div>
  );
}
