import React from 'react';
import { SonarDetection } from '../types/sonar';
import { 
  X, 
  AlertTriangle, 
  Copy, 
  Anchor,
  Check
} from 'lucide-react';

interface TargetInspectorProps {
  detection: SonarDetection | null;
  onClose: () => void;
}

export const TargetInspector: React.FC<TargetInspectorProps> = ({
  detection,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!detection) return null;

  const isGhostNet = detection.categoryId === 'ghost_net';
  const isShipwreck = detection.categoryId === 'shipwreck';

  const badgeColor = 
    isGhostNet ? 'bg-rose-100 text-rose-800 border-rose-200' :
    isShipwreck ? 'bg-amber-100 text-amber-800 border-amber-200' :
    'bg-indigo-100 text-indigo-800 border-indigo-200';

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${detection.latitude}, ${detection.longitude}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-80 sm:w-96 bg-white border-l border-slate-200 h-full flex flex-col select-none shadow-lg z-20 shrink-0">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-[#0A2540]">
              {detection.id}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {detection.categoryName}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Ping #{detection.pingIndex} • {detection.timestamp}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Synthetic Sonar Echogram Crop Preview */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span>Acoustic Echogram Crop (455 kHz)</span>
            <span className="font-mono text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              YOLOv8-OBB Mask
            </span>
          </div>

          <div className="relative h-48 rounded-lg border border-slate-300 bg-slate-950 overflow-hidden flex items-center justify-center">
            {/* Real Sonar Echogram Image */}
            <img
              src={detection.echogramImage || (isGhostNet ? '/sonar/sonar_net_wreck.png' : isShipwreck ? '/sonar/sonar_shipwreck.jpg' : '/sonar/sonar_structure.jpg')}
              alt={detection.categoryName}
              className="w-full h-full object-cover filter contrast-125 brightness-95"
            />
            
            {/* AI YOLO Overlay */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            <div className="absolute inset-4 border-2 border-rose-400 rounded bg-rose-500/10 p-2 flex flex-col justify-between pointer-events-none">
              <div className="flex items-center justify-between text-[9px] font-mono font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded self-start">
                <span>{detection.id} • {detection.categoryName}</span>
                <span className="ml-1 text-yellow-300">{detection.confidence}%</span>
              </div>
              <div className="flex justify-between items-center text-[8px] font-mono text-white bg-black/80 px-1.5 py-0.5 rounded self-end">
                <span>ACOUSTIC BACKSCATTER</span>
                <span className="text-emerald-400 ml-1">SHADOW: {detection.acousticShadowM}m</span>
              </div>
            </div>
            {/* Nadir distance label */}
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-400">
              Ch: {detection.channel} • {detection.rangeMeters}m
            </div>
          </div>
        </div>

        {/* Confidence & AI Verification Score */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-800">Confidence Metric</span>
            <span className="font-mono font-extrabold text-emerald-700 text-sm">
              {detection.confidence.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${detection.confidence}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1.5">
            <span>Speckle Rejection: {detection.speckleFilteringScore}%</span>
            <span>SNR: +{detection.signalToNoiseRatioDb} dB</span>
          </div>
        </div>

        {/* Physical Geotag & Hydrographic Metrology */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Acoustic & Spatial Geotag
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 block">Latitude</span>
              <strong className="text-slate-800 text-[11px]">{detection.latitude.toFixed(6)}° N</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 block">Longitude</span>
              <strong className="text-slate-800 text-[11px]">{detection.longitude.toFixed(6)}° E</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 block">Target Length × Width</span>
              <strong className="text-slate-800 text-[11px]">{detection.dimensions.lengthM}m × {detection.dimensions.widthM}m</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 block">Seabed Elevation</span>
              <strong className="text-slate-800 text-[11px]">+{detection.dimensions.heightM}m</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 block">Seafloor Depth</span>
              <strong className="text-slate-800 text-[11px]">{detection.depthMeters} meters</strong>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 block">Acoustic Shadow</span>
              <strong className="text-slate-800 text-[11px]">{detection.acousticShadowM} meters</strong>
            </div>
          </div>
        </div>

        {/* Operational Description & Hazard Warning */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Operational Assessment</span>
          </div>
          <p className="text-slate-700 leading-relaxed text-[11px]">
            {detection.notes}
          </p>
        </div>

      </div>

      {/* Bottom Action Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-2">
        <button
          onClick={handleCopyCoords}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Coordinates Copied!' : 'Copy GPS Coordinates'}</span>
        </button>

        <button
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0A2540] hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <Anchor className="w-3.5 h-3.5 text-sky-400" />
          <span>Dispatch Clean-Up / ROV Tag</span>
        </button>
      </div>

    </aside>
  );
};
