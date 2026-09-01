import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { Printer, CheckSquare, Square } from 'lucide-react';

export default function StickerPrintView({
  boxes = [],
  selectedBoxIds = [],
  onToggleSelect,
  onPrintSingle
}) {
  if (!boxes || boxes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs no-print bg-white rounded-2xl border border-slate-200">
        No stock box stickers match your search or selection criteria.
      </div>
    );
  }

  return (
    <div id="printable-sticker-area" className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {boxes.map((box) => {
          const isSelected = selectedBoxIds.length === 0 || selectedBoxIds.includes(box._id);
          return (
            <div
              key={box._id || box.qrId}
              className={`border-2 ${
                isSelected
                  ? 'border-slate-900 shadow-md bg-white'
                  : 'border-slate-300 opacity-40 bg-slate-50 no-print'
              } rounded-xl p-3 flex flex-col justify-between transition-all break-inside-avoid relative group`}
              style={{ width: '100%', minHeight: '185px' }}
            >
              {/* Screen-Only Control Bar (hidden during printing) */}
              <div className="no-print flex items-center justify-between bg-slate-100 px-2 py-1 rounded-lg mb-2 text-[10px] select-none border border-slate-200">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 hover:text-[#0F6E56]">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect && onToggleSelect(box._id)}
                    className="w-3.5 h-3.5 accent-[#0F6E56] cursor-pointer rounded"
                  />
                  <span>{isSelected ? 'Selected' : 'Select'}</span>
                </label>

                {onPrintSingle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrintSingle(box._id);
                    }}
                    className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                    title="Print this single QR sticker"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print 1</span>
                  </button>
                )}
              </div>

              {/* Printable Sticker Header */}
              <div className="text-center border-b border-slate-300 pb-1 mb-1">
                <h2 className="font-extrabold text-xs text-[#0F6E56] tracking-tight uppercase">
                  VANIKI CROP SCIENCE
                </h2>
              </div>

              {/* Content Body: Left QR Code, Right Details */}
              <div className="flex items-center gap-2.5 my-1">
                <div className="bg-white p-1 rounded border border-slate-300 flex items-center justify-center shrink-0">
                  <QRCodeSVG
                    value={box.qrId}
                    size={66}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="text-[10px] space-y-0.5 overflow-hidden">
                  <p className="font-bold text-slate-900 truncate" title={box.productName}>
                    <span className="text-slate-500">Product: </span>{box.productName}
                  </p>
                  <p className="font-semibold text-slate-700">
                    <span className="text-slate-500">Batch: </span>{box.batchNumber}
                  </p>
                  <p className="font-semibold text-slate-700">
                    <span className="text-slate-500">Weight: </span>{box.weight || '1 kg'}
                  </p>
                  <p className="font-extrabold text-[#0F6E56] font-mono tracking-wider pt-0.5">
                    ID: {box.qrId}
                  </p>
                </div>
              </div>

              {/* Barcode Footer */}
              <div className="text-center border-t border-slate-300 pt-1.5 mt-1 flex justify-center">
                <Barcode
                  value={box.barcode || box.qrId.replace('-', '')}
                  height={20}
                  fontSize={9}
                  margin={0}
                  displayValue={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

