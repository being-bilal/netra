import React, { useState } from 'react';
import { SonarDetection, AUVTelemetry } from '../types/sonar';
import { 
  Play, 
  Pause, 
  CheckCircle2
} from 'lucide-react';

interface WaterfallViewProps {
  telemetry: AUVTelemetry;
  detections: SonarDetection[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
}

export const WaterfallView: React.FC<WaterfallViewProps> = ({
  telemetry,
  detections,
  selectedDetection,
  onSelectDetection,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showShadows, setShowShadows] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'cfar' | 'raw' | 'enhanced'>('cfar');

  return (
    <div className="flex-1 h-full w-full bg-slate-950 text-slate-100 flex flex-col select-none overflow-hidden">
      
      {/* Waterfall Control Strip */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-10 text-xs">
        
        {/* Waterfall Stream Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#0A2540] hover:bg-sky-900 text-sky-200 border border-sky-700 rounded-md font-semibold cursor-pointer transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Live Ping Scroll' : 'Stream Paused'}</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <span className="font-mono text-slate-300">
            Current Ping: <strong className="text-white">#{telemetry.totalPingsProcessed}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-slate-400">
            Sweep Speed: <strong className="text-sky-400">15 lines/sec</strong>
          </span>
        </div>

        {/* Filter & Overlay Toggles */}
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-slate-800 p-0.5 rounded-md border border-slate-700 text-[11px] font-mono">
            <button
              onClick={() => setFilterMode('cfar')}
              className={`px-2 py-0.5 rounded cursor-pointer ${filterMode === 'cfar' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              CFAR Speckle Filter
            </button>
            <button
              onClick={() => setFilterMode('raw')}
              className={`px-2 py-0.5 rounded cursor-pointer ${filterMode === 'raw' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Raw Acoustic Echo
            </button>
            <button
              onClick={() => setFilterMode('enhanced')}
              className={`px-2 py-0.5 rounded cursor-pointer ${filterMode === 'enhanced' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Shadow Enhanced
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showBoxes}
              onChange={(e) => setShowBoxes(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            <span>YOLO Bounding Boxes</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showShadows}
              onChange={(e) => setShowShadows(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Acoustic Shadows</span>
          </label>
        </div>

      </div>

      {/* Main Dual-Channel Waterfall Echogram Canvas */}
      <div className="flex-1 relative overflow-hidden flex flex-col justify-between p-4">
        
        {/* Channel Labels */}
        <div className="grid grid-cols-12 gap-2 text-center text-[11px] font-mono font-bold uppercase tracking-wider mb-2 text-slate-400">
          <div className="col-span-5 bg-slate-900/80 py-1 rounded border border-slate-800 flex items-center justify-between px-3 text-sky-400">
            <span>◄ 60m Port Swath</span>
            <span className="text-[10px] text-slate-500">Ch 1 (455 kHz)</span>
          </div>
          <div className="col-span-2 bg-black py-1 rounded border border-slate-800 text-slate-400 text-[10px] flex items-center justify-center">
            ▼ NADIR / WATER COLUMN (8.5m Alt)
          </div>
          <div className="col-span-5 bg-slate-900/80 py-1 rounded border border-slate-800 flex items-center justify-between px-3 text-sky-400">
            <span className="text-[10px] text-slate-500">Ch 2 (455 kHz)</span>
            <span>60m Starboard Swath ►</span>
          </div>
        </div>

        {/* Sonar Acoustic Echogram Simulation */}
        <div className="flex-1 relative rounded-lg border border-slate-800 overflow-hidden bg-radial from-slate-900 to-black grid grid-cols-12">
          
          {/* PORT CHANNEL */}
          <div className="col-span-5 relative bg-black overflow-hidden border-r border-slate-900">
            {/* Real Sonar Waterfall Imagery */}
            <img
              src="/sonar/sonar_waterfall_real.jpg"
              alt="Port Side Scan Sonar"
              className="absolute inset-0 w-full h-full object-cover filter contrast-125 brightness-95 opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-amber-950/25 via-transparent to-black/40 pointer-events-none" />

            {detections.filter(d => d.channel === 'Port').map((d, index) => {
              const isSelected = selectedDetection?.id === d.id;
              const topPos = 18 + index * 26;
              const leftPos = Math.min(75, Math.max(15, (d.rangeMeters / 60) * 100));

              return (
                <div
                  key={d.id}
                  onClick={() => onSelectDetection(d)}
                  className="absolute cursor-pointer transition-transform hover:scale-105 z-10"
                  style={{ top: `${topPos}%`, right: `${100 - leftPos}%` }}
                >
                  {showBoxes && (
                    <div className={`p-1 rounded border-2 backdrop-blur-xs transition-all ${
                      isSelected 
                        ? 'border-rose-400 bg-rose-950/80 ring-2 ring-rose-400' 
                        : 'border-rose-500/80 bg-rose-950/50 hover:border-white'
                    }`}>
                      <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-white bg-rose-600 px-1 py-0.5 rounded shadow-xs">
                        <span>{d.id}</span>
                        <span>{d.categoryName}</span>
                        <span className="text-yellow-300 font-bold">({d.confidence}%)</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-10 h-5 bg-white/90 rounded-xs flex items-center justify-center text-[7px] font-bold text-black">
                          ECHO
                        </div>
                        {showShadows && (
                          <div className="w-14 h-5 bg-black/90 border border-slate-700 rounded-xs flex items-center justify-center text-[7px] text-slate-300">
                            SHADOW {d.acousticShadowM}m
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* NADIR / WATER COLUMN */}
          <div className="col-span-2 bg-black relative flex flex-col items-center justify-between py-4 border-r border-slate-900 z-10">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">AUV Trackline</div>
            <div className="w-0.5 h-full bg-sky-500/30 border-l border-dashed border-sky-400/50" />

            <div className="absolute inset-y-0 flex flex-col justify-around text-[9px] font-mono text-slate-500 pointer-events-none">
              <span>Ping #3400</span>
              <span>Ping #3200</span>
              <span>Ping #3000</span>
              <span>Ping #2800</span>
            </div>

            <div className="text-[9px] font-mono text-emerald-400 font-bold bg-slate-950 px-1 rounded border border-emerald-900">ALT 2.1m</div>
          </div>

          {/* STARBOARD CHANNEL */}
          <div className="col-span-5 relative bg-black overflow-hidden">
            {/* Real Sonar Echogram Imagery */}
            <img
              src="/sonar/sonar_shipwreck.jpg"
              alt="Starboard Side Scan Sonar"
              className="absolute inset-0 w-full h-full object-cover filter contrast-125 brightness-95 opacity-85 scale-x-[-1]"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-amber-950/25 via-transparent to-black/40 pointer-events-none" />

            {detections.filter(d => d.channel === 'Starboard').map((d, index) => {
              const isSelected = selectedDetection?.id === d.id;
              const topPos = 24 + index * 32;
              const leftPos = Math.min(80, Math.max(20, (d.rangeMeters / 60) * 100));

              const isNet = d.categoryId === 'ghost_net';
              const boxColor = isNet ? 'border-rose-400 bg-rose-500/20' : 'border-amber-400 bg-amber-500/20';
              const badgeColor = isNet ? 'bg-rose-600' : 'bg-amber-600';

              return (
                <div
                  key={d.id}
                  onClick={() => onSelectDetection(d)}
                  className="absolute cursor-pointer transition-transform hover:scale-105"
                  style={{ top: `${topPos}%`, left: `${leftPos}%` }}
                >
                  {showBoxes && (
                    <div className={`p-1 rounded border-2 transition-all ${
                      isSelected ? `${boxColor} ring-2 ring-sky-300` : `${boxColor} hover:border-white`
                    }`}>
                      <div className={`flex items-center gap-1 text-[9px] font-mono font-bold text-white ${badgeColor} px-1 py-0.5 rounded shadow-xs`}>
                        <span>{d.id}</span>
                        <span>{d.categoryName}</span>
                        <span className="text-yellow-300">({d.confidence}%)</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-12 h-6 bg-white/90 rounded-xs flex items-center justify-center text-[8px] font-bold text-black">
                          ECHO
                        </div>
                        {showShadows && (
                          <div className="w-16 h-6 bg-black/95 border border-slate-700 rounded-xs flex items-center justify-center text-[8px] text-slate-400">
                            SHADOW {d.acousticShadowM}m
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* Bottom Waterfall Metrology Bar */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> AI Speckle Filtering: Optimal (24.8 dB SNR)
          </span>
          <span className="text-slate-600">|</span>
          <span>Sampling Interval: <strong>3.2 cm / pixel</strong></span>
          <span className="text-slate-600">|</span>
          <span>Acoustic Beam Grazing Angle: <strong>22.4°</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            Selected: <strong className="text-white">{selectedDetection ? selectedDetection.id : 'Click any box to inspect'}</strong>
          </span>
        </div>
      </div>

    </div>
  );
};
