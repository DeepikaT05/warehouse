import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';

export default function StickerPrintView({
  boxes = [],
  selectedBoxIds = [],
  onToggleSelect,
  onPrintSingle,
  printerFormat = 'tsc-2up-50x25' // 'tsc-2up-50x25' (Default) | 'tsc-50x50' | 'tsc-50x25' | 'tsc-100x50' | 'sheet-a4'
}) {
  if (!boxes || boxes.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs no-print bg-white rounded-2xl border border-slate-200">
        No stock box stickers match your search or selection criteria.
      </div>
    );
  }

  const is2UpMode = printerFormat === 'tsc-2up-50x25';

  // Chunk boxes into pairs of 2 for the 2-Across label roll
  const pairs = [];
  if (is2UpMode) {
    for (let i = 0; i < boxes.length; i += 2) {
      pairs.push([boxes[i], boxes[i + 1] || null]);
    }
  }

  const renderSingleStickerCard = (box, isSelected = true, inPair = false) => {
    if (!box) return null;
    return (
      <div
        key={box._id || box.qrId}
        className={`sticker-box-card border-2 ${
          isSelected
            ? 'border-slate-900 shadow-sm bg-white'
            : 'border-slate-300 opacity-35 bg-slate-50 no-print'
        } rounded-xl p-2 flex flex-col justify-between transition-all relative`}
        style={{ minHeight: inPair ? '150px' : '180px' }}
      >
        {/* Screen-Only Control Bar */}
        <div className="no-print flex items-center justify-between bg-slate-100 px-2 py-1 rounded-lg mb-1 text-[10px] select-none border border-slate-200">
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
              title="Print 1 sticker on Left label of roll"
            >
              <Printer className="w-3 h-3" />
              <span>Print 1</span>
            </button>
          )}
        </div>

        {/* Printable Sticker Header */}
        <div className="text-center border-b border-black pb-0.5 mb-0.5">
          <h2 className="font-black text-[8px] sm:text-[9px] text-[#0F6E56] tracking-tight uppercase leading-none">
            VANIKI CROP SCIENCE
          </h2>
        </div>

        {/* Content Body: Left Details, Right QR Code */}
        <div className="flex items-center justify-between gap-1.5 my-0.5">
          <div className="text-[8px] leading-tight space-y-0.5 overflow-hidden flex-1">
            <p className="font-bold text-black text-[7.5px] leading-tight line-clamp-2" title={box.productName}>
              {box.productName}
            </p>
            {box.technicalName ? (
              <p className="text-[6.5px] text-slate-600 truncate italic leading-none">
                {box.technicalName}
              </p>
            ) : null}
            <p className="font-semibold text-black text-[7px] leading-tight">
              <span className="text-slate-600 font-normal">BA: </span>{box.batchNumber}
            </p>
            <p className="font-semibold text-black text-[7px] leading-tight">
              <span className="text-slate-600 font-normal">Wt: </span>{box.petiWeight || box.caseWtStr || box.weight || box.packing || '10 LTR'}
            </p>
            <p className="font-bold text-[#0F6E56] font-mono tracking-wider text-[7.5px] leading-tight">
              ID: {box.qrId} {box.petiTag || (box.petiTitle ? `• ${box.petiTitle}` : '')}
            </p>
          </div>

          <div className="bg-white p-0.5 rounded border border-slate-900 flex items-center justify-center shrink-0">
            <QRCodeSVG
              value={box.qrId}
              size={is2UpMode ? 48 : (printerFormat === 'tsc-50x25' ? 52 : 62)}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="printable-sticker-area" className={`print-format-${printerFormat}`}>
      {/* Dynamic Thermal 2-Up and 1-Up CSS Rules */}
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

          /* 2-ACROSS TSC TE244 LABEL ROLL (105mm wide x 25mm row height) */
          .print-format-tsc-2up-50x25 .tsc-2up-row-print {
            width: 103mm !important;
            height: 24.5mm !important;
            max-height: 24.5mm !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .print-format-tsc-2up-50x25 .tsc-2up-label-item {
            width: 50mm !important;
            height: 24.5mm !important;
            max-width: 50mm !important;
            max-height: 24.5mm !important;
            box-sizing: border-box !important;
            padding: 1mm 1.5mm !important;
            border: 0.6px solid #000 !important;
            border-radius: 1.5mm !important;
            background: #FFF !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-format-tsc-2up-50x25 .tsc-2up-label-blank {
            width: 50mm !important;
            height: 24.5mm !important;
            visibility: hidden !important;
          }

          /* Single 50mm x 50mm Roll */
          .print-format-tsc-50x50 .sticker-grid-wrapper {
            display: block !important;
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
            overflow: hidden !important;
          }

          /* Single 50mm x 25mm Roll */
          .print-format-tsc-50x25 .sticker-grid-wrapper {
            display: block !important;
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
            overflow: hidden !important;
          }

          /* A4 Sheet Paper */
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
            min-height: 48mm !important;
          }
        }
      `}</style>

      {/* 2-UP TSC ROLL VIEW */}
      {is2UpMode ? (
        <div className="space-y-4">
          {/* Visual Roll Indication (Screen only) */}
          <div className="no-print bg-emerald-50 text-[#0F6E56] border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span>2-Across Roll Mode Active (Matches your TSC roll with 2 stickers per row)</span>
            </div>
            <span className="bg-[#0F6E56] text-white px-2.5 py-0.5 rounded-lg text-[10px]">
              {boxes.length} Sticker{boxes.length === 1 ? '' : 's'} ({pairs.length} Row{pairs.length === 1 ? '' : 's'})
            </span>
          </div>

          <div className="space-y-3">
            {pairs.map((pair, rowIndex) => {
              const leftBox = pair[0];
              const rightBox = pair[1];
              const isLeftSelected = selectedBoxIds.length === 0 || selectedBoxIds.includes(leftBox._id);
              const isRightSelected = rightBox && (selectedBoxIds.length === 0 || selectedBoxIds.includes(rightBox._id));

              return (
                <div
                  key={rowIndex}
                  className="tsc-2up-row-print flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-200 max-w-2xl mx-auto"
                >
                  {/* Left Label */}
                  <div className="tsc-2up-label-item flex-1">
                    {renderSingleStickerCard(leftBox, isLeftSelected, true)}
                  </div>

                  {/* Right Label */}
                  <div className="tsc-2up-label-item flex-1">
                    {rightBox ? (
                      renderSingleStickerCard(rightBox, isRightSelected, true)
                    ) : (
                      <div className="tsc-2up-label-blank border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-full no-print">
                        <span>(Empty Label Slot)</span>
                        <span className="text-[10px] text-slate-400 mt-1">Left label will print</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Standard Single Grid View */
        <div className="sticker-grid-wrapper grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
          {boxes.map((box) => {
            const isSelected = selectedBoxIds.length === 0 || selectedBoxIds.includes(box._id);
            return renderSingleStickerCard(box, isSelected, false);
          })}
        </div>
      )}
    </div>
  );
}

