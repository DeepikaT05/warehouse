import React from 'react';
import { CheckCircle2, Clock, PackageCheck, Printer, Warehouse, FileText, Truck, ShieldCheck } from 'lucide-react';

const getStageIcon = (stage) => {
  switch (stage?.toLowerCase()) {
    case 'purchase received':
      return <FileText className="w-4 h-4 text-emerald-600" />;
    case 'qr generated':
      return <Printer className="w-4 h-4 text-[#0F6E56]" />;
    case 'stock available':
      return <Warehouse className="w-4 h-4 text-blue-600" />;
    case 'invoice assigned':
      return <PackageCheck className="w-4 h-4 text-indigo-600" />;
    case 'verified':
      return <ShieldCheck className="w-4 h-4 text-[#1D9E75]" />;
    case 'dispatched':
      return <Truck className="w-4 h-4 text-purple-600" />;
    case 'delivered':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    default:
      return <Clock className="w-4 h-4 text-slate-500" />;
  }
};

export default function TimelineView({ history = [] }) {
  if (!history || history.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-xs">
        No lifecycle events recorded for this stock item yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200">
      {history.map((event, index) => (
        <div key={index} className="relative flex items-start gap-4 group">
          {/* Node Icon */}
          <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-white border-2 border-[#0F6E56] flex items-center justify-center shadow-sm z-10 group-hover:scale-110 transition-transform">
            {getStageIcon(event.stage)}
          </div>

          {/* Event Content Card */}
          <div className="bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl p-4 w-full transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0F6E56] bg-emerald-100/70 px-2 py-0.5 rounded">
                {event.stage}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>

            <h4 className="font-bold text-xs text-slate-900 mt-2">{event.title}</h4>
            {event.description && (
              <p className="text-xs text-slate-600 mt-1">{event.description}</p>
            )}

            <div className="mt-2 text-[10px] text-slate-500 font-medium flex items-center gap-1">
              <span>Performed by:</span>
              <span className="font-bold text-slate-800">{event.performedBy}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
