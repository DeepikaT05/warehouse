import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { Printer } from 'lucide-react';

export default function StickerPrintView({
  boxes = [],
  selectedBoxIds = [],
  onToggleSelect,
  onPrintSingle,
  printerFormat = 'tsc-50x50' // 'tsc-50x50' | 'tsc-50x25' | 'tsc-100x50' | 'tsc-2up-50x25' | 'sheet-a4'
}) {
  if (!boxes || boxes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs no-print bg-white rounded-2xl border border-slate-200">
        No stock box stickers match your search or selection criteria.
      </div>
    );
  }

  const isThermalSingle = printerFormat === 'tsc-50x50' || printerFormat === 'tsc-50x25' || printerFormat === 'tsc-100x50';

  return (
    <div id="printable-sticker-area" className={`print-format-${printerFormat}`}>
      {/* Thermal & Sheet Print Styles embedded */}
      <style>{`
        @media print {
          @page {
            margin: 0mm !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-sticker-area {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          
          /* Single Thermal Label Roll (50mm x 50mm - Standard TSC TE244) */
          .print-format-tsc-50x50 .sticker-grid-wrapper {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-format-tsc-50x50 .sticker-box-card {
            width: 50mm !important;
            height: 50mm !important;
            max-width: 50mm !important;
            max-height: 50mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 1.8mm !important;
            box-sizing: border-box !important;
            border: 0.8px solid #000 !important;
            border-radius: 1.5mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #FFF !important;
            overflow: hidden !important;
          }

          /* Compact Thermal Roll (50mm x 25mm / 2" x 1") */
          .print-format-tsc-50x25 .sticker-grid-wrapper {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-format-tsc-50x25 .sticker-box-card {
            width: 50mm !important;
            height: 25mm !important;
            max-width: 50mm !important;
            max-height: 25mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 1mm !important;
            box-sizing: border-box !important;
            border: 0.8px solid #000 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #FFF !important;
            overflow: hidden !important;
          }

          /* Large Thermal Roll (100mm x 50mm / 4" x 2") */
          .print-format-tsc-100x50 .sticker-grid-wrapper {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-format-tsc-100x50 .sticker-box-card {
            width: 100mm !important;
            height: 50mm !important;
            max-width: 100mm !important;
            max-height: 50mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 2.5mm !important;
            box-sizing: border-box !important;
            border: 1px solid #000 !important;
            border-radius: 2mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #FFF !important;
            overflow: hidden !important;
          }

          /* 2-Across Thermal Roll (2 labels on 105mm wide roll) */
          .print-format-tsc-2up-50x25 .sticker-grid-wrapper {
            display: grid !important;
            grid-template-columns: 50mm 50mm !important;
            gap: 2mm !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-format-tsc-2up-50x25 .sticker-box-card {
            width: 50mm !important;
            height: 25mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 1mm !important;
            box-sizing: border-box !important;
            border: 0.8px solid #000 !important;
          }

          /* A4 Sheet Paper Grid */
          .print-format-sheet-a4 .sticker-grid-wrapper {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6mm !important;
            padding: 6mm !important;
          }
          .print-format-sheet-a4 .sticker-box-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #64748B !important;
            border-radius: 3mm !important;
            padding: 3mm !important;
            min-height: 50mm !important;
          }
        }
      `}</style>

      {/* Screen layout & Print container */}
      <div className="sticker-grid-wrapper grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
        {boxes.map((box) => {
          const isSelected = selectedBoxIds.length === 0 || selectedBoxIds.includes(box._id);
          return (
            <div
              key={box._id || box.qrId}
              className={`sticker-box-card border-2 ${
                isSelected
                  ? 'border-slate-900 shadow-sm bg-white'
                  : 'border-slate-300 opacity-35 bg-slate-50 no-print'
              } rounded-xl p-2.5 flex flex-col justify-between transition-all relative`}
              style={{ minHeight: isThermalSingle ? '180px' : '190px' }}
            >
              {/* Screen-Only Control Bar */}
              <div className="no-print flex items-center justify-between bg-slate-100 px-2 py-1 rounded-lg mb-1.5 text-[10px] select-none border border-slate-200">
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
                    className="bg-[#0F6E56] hover:bg-[#0B5442] text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"
                    title="Print this single QR sticker"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print 1</span>
                  </button>
                )}
              </div>

              {/* Printable Sticker Header */}
              <div className="text-center border-b border-black pb-0.5 mb-1">
                <h2 className="font-black text-[9px] sm:text-[10px] text-[#0F6E56] tracking-tight uppercase">
                  VANIKI CROP SCIENCE
                </h2>
              </div>

              {/* Content Body: Left QR Code, Right Details */}
              <div className="flex items-center gap-2 my-0.5">
                <div className="bg-white p-0.5 rounded border border-black flex items-center justify-center shrink-0">
                  <QRCodeSVG
                    value={box.qrId}
                    size={printerFormat === 'tsc-50x25' ? 44 : 58}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="text-[8.5px] leading-tight space-y-0.5 overflow-hidden flex-1">
                  <p className="font-extrabold text-black truncate" title={box.productName}>
                    {box.productName}
                  </p>
                  {box.technicalName ? (
                    <p className="text-[7px] text-slate-600 truncate italic">
                      {box.technicalName}
                    </p>
                  ) : null}
                  <p className="font-bold text-black">
                    <span className="text-slate-600 font-normal">Batch: </span>{box.batchNumber}
                  </p>
                  <p className="font-bold text-black">
                    <span className="text-slate-600 font-normal">Pack: </span>{box.packing || box.weight || '1 kg'}
                  </p>
                  <p className="font-black text-[#0F6E56] font-mono tracking-wider text-[9px] pt-0.5">
                    {box.qrId}
                  </p>
                </div>
              </div>

              {/* Barcode Footer */}
              <div className="text-center border-t border-black pt-1 mt-0.5 flex flex-col items-center justify-center">
                <Barcode
                  value={box.barcode || box.qrId.replace('-', '')}
                  height={printerFormat === 'tsc-50x25' ? 12 : 16}
                  width={1.15}
                  fontSize={8}
                  margin={0}
                  displayValue={false}
                />
                <span className="font-mono font-bold text-[7.5px] text-black tracking-widest leading-none mt-0.5">
                  *{box.qrId}*
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

