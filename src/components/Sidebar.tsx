import React from 'react';
import { AnomalyClassConfig, SonarDetection } from '../types/sonar';
import { 
  SlidersHorizontal, 
  UploadCloud, 
  Eye, 
  EyeOff, 
  Layers, 
  Crosshair,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  classes: AnomalyClassConfig[];
  onToggleClass: (id: string) => void;
  confidenceThreshold: number;
  setConfidenceThreshold: (val: number) => void;
  detections: SonarDetection[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
  onOpenExport: () => void;
  onOpenUpload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  classes,
  onToggleClass,
  confidenceThreshold,
  setConfidenceThreshold,
  detections,
  selectedDetection,
  onSelectDetection,
  onOpenExport,
  onOpenUpload,
}) => {
  const filteredDetections = detections.filter((d) => {
    const cls = classes.find((c) => c.id === d.categoryId);
    return (cls?.visible ?? true) && d.confidence >= confidenceThreshold;
  });

  return (
    <aside className="w-72 lg:w-80 flex flex-col bg-white border-r border-slate-200 h-full select-none shrink-0 z-20">
      
      {/* 1. Classes Filter Section */}
      <div className="p-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#0284C7]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Classes
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
            {filteredDetections.length} Targets
          </span>
        </div>

        {/* Clean, compact class rows */}
        <div className="space-y-1">
          {classes.map((c) => (
            <div
              key={c.id}
              onClick={() => onToggleClass(c.id)}
              className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                c.visible 
                  ? 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80' 
                  : 'bg-slate-50/30 border-dashed border-slate-200 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {c.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {c.count}
                </span>
                <button 
                  type="button" 
                  className="text-slate-400 hover:text-slate-700"
                  aria-label={c.visible ? "Hide" : "Show"}
                >
                  {c.visible ? <Eye className="w-3.5 h-3.5 text-sky-600" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Compact Confidence Filter */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              Min Confidence
            </span>
            <span className="font-mono text-[11px] font-bold text-[#0A2540]">
              ≥ {confidenceThreshold}%
            </span>
          </div>
          <input
            type="range"
            min="60"
            max="99"
            step="1"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
          />
        </div>
      </div>

      {/* 2. Detected Targets Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs mb-1 px-1">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Crosshair className="w-3 h-3 text-rose-500" /> Detected Objects
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {filteredDetections.length} total
          </span>
        </div>

        {filteredDetections.map((item) => {
          const isSelected = selectedDetection?.id === item.id;
          const isNet = item.categoryId === 'ghost_net';
          const isShipwreck = item.categoryId === 'shipwreck';
          const color = isNet ? '#DC2626' : isShipwreck ? '#D97706' : '#4F46E5';

          return (
            <div
              key={item.id}
              onClick={() => onSelectDetection(item)}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                isSelected 
                  ? 'bg-sky-50 border-[#0284C7] ring-1 ring-[#0284C7]/40 shadow-xs' 
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {item.id}
                    </span>
                    <span className="text-[11px] text-slate-600 truncate max-w-[110px]">
                      {item.categoryName}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {item.dimensions.lengthM}m × {item.dimensions.widthM}m • {item.depthMeters}m
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                  {item.confidence.toFixed(0)}%
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom Action Dock (Matching 'EXPORT' and 'UPLOAD' in sketch) */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2">
        <button
          onClick={onOpenExport}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs rounded-lg transition-all shadow-2xs cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          Export to CSV
        </button>

        <button
          onClick={onOpenUpload}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0A2540] hover:bg-[#081d33] text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
          Upload Log File
        </button>
      </div>

    </aside>
  );
};
