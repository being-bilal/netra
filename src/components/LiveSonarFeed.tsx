import React, { useState, useEffect } from 'react';
import { SonarDetection, AUVTelemetry } from '../types/sonar';
import { 
  Play, 
  Pause, 
  ChevronDown, 
  ChevronUp, 
  Radio, 
  Maximize2, 
  Eye, 
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface LiveSonarFeedProps {
  telemetry: AUVTelemetry;
  detections: (SonarDetection & { echogramImage?: string })[];
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const LiveSonarFeed: React.FC<LiveSonarFeedProps> = ({
  telemetry,
  detections,
  selectedDetection,
  onSelectDetection,
  isExpanded,
  onToggleExpand,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [pingOffset, setPingOffset] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'waterfall' | 'gallery' | 'spectrum'>('waterfall');
  const [selectedGalleryImg, setSelectedGalleryImg] = useState<string>('/sonar/sonar_net_wreck.png');

  // Real-time acoustic scroll simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPingOffset((prev) => (prev + 1) % 1000);
    }, 60);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <section 
      aria-label="Live Side-Scan Sonar Feed"
      className={`border-t border-slate-800 bg-[#050B14] text-white transition-all duration-300 flex flex-col z-20 shrink-0 select-none shadow-2xl ${
        isExpanded ? 'h-64 lg:h-72' : 'h-10'
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="h-10 bg-[#0A1322] border-b border-slate-800/90 px-4 flex items-center justify-between text-xs shrink-0">
        
        {/* Left: Feed Title & Mode Pills */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span className="uppercase tracking-wider text-[11px]">Side-Scan Sonar Live Feed</span>
          </button>

          <span className="text-slate-700">|</span>

          {/* Live Status indicator */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-emerald-500/30 px-2 py-0.5 rounded">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-mono text-[10px] text-emerald-400 font-bold">
              {isPlaying ? '455 kHz LIVE SSS STREAM' : 'FEED PAUSED'}
            </span>
          </div>

          {/* View Mode Tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <button
              onClick={() => setActiveTab('waterfall')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                activeTab === 'waterfall' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dual-Channel Waterfall
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                activeTab === 'gallery' ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Acoustic Targets ({detections.length})
            </button>
          </div>
        </div>

        {/* Right: Metrics & Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-3 font-mono text-[10px] text-slate-400">
            <span>Ping: <strong className="text-slate-200">#{telemetry.totalPingsProcessed + pingOffset}</strong></span>
            <span>•</span>
            <span>Swath: <strong className="text-sky-400">{telemetry.swathWidthMeters}m</strong></span>
            <span>•</span>
            <span>Altitude: <strong className="text-slate-200">{telemetry.altitudeMeters}m</strong></span>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold text-[11px] cursor-pointer transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
            <span>{isPlaying ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
            title={isExpanded ? 'Collapse Sonar Feed' : 'Expand Sonar Feed'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* 2. Expanded Body */}
      {isExpanded && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden relative p-2 bg-[#040810]">
          
          {activeTab === 'waterfall' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Range & Channel Indicator Bar */}
              <div className="grid grid-cols-12 gap-1 text-[10px] font-mono text-center mb-1 text-slate-400 shrink-0">
                <div className="col-span-5 bg-slate-900/90 py-0.5 rounded px-2 flex justify-between items-center text-sky-400 border border-slate-800/80">
                  <span>◄ PORT CHANNEL (12.5m)</span>
                  <span className="text-[9px] text-slate-500">Ch 1 • 455 kHz</span>
                </div>
                <div className="col-span-2 bg-black py-0.5 rounded text-emerald-400 text-[9px] flex items-center justify-center font-bold border border-emerald-950">
                  ▼ NADIR (Alt 2.1m)
                </div>
                <div className="col-span-5 bg-slate-900/90 py-0.5 rounded px-2 flex justify-between items-center text-sky-400 border border-slate-800/80">
                  <span className="text-[9px] text-slate-500">Ch 2 • 455 kHz</span>
                  <span>STARBOARD CHANNEL (12.5m) ►</span>
                </div>
              </div>

              {/* REAL Dual-Channel Side-Scan Sonar Imagery Waterfall */}
              <div className="flex-1 relative rounded border border-slate-800 overflow-hidden bg-black grid grid-cols-12">
                
                {/* 1. Port Channel (Cols 1-5): Real Sonar Waterfall */}
                <div className="col-span-5 relative overflow-hidden bg-black border-r border-slate-900">
                  <img
                    src="/sonar/sonar_waterfall_real.jpg"
                    alt="Port Channel Side Scan Sonar"
                    className="absolute inset-0 w-full h-[250%] object-cover opacity-90 filter contrast-125 brightness-95"
                    style={{
                      transform: `translateY(-${(pingOffset * 0.4) % 60}%)`,
                      transition: isPlaying ? 'transform 0.06s linear' : 'none',
                    }}
                  />
                  {/* Subtle acoustic amber colormap grading */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-950/20 via-transparent to-black/40 pointer-events-none" />

                  {/* Overlaid AI Detection Annotations on Port Channel */}
                  {detections.filter(d => d.channel === 'Port').map((item, idx) => {
                    const isSelected = selectedDetection?.id === item.id;
                    const topPercent = (20 + idx * 35 + (pingOffset * 0.2)) % 80;

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectDetection(item)}
                        className="absolute cursor-pointer transition-transform hover:scale-105 z-10"
                        style={{ top: `${topPercent}%`, left: `${20 + (idx % 2) * 35}%` }}
                      >
                        <div className={`p-1 rounded border-2 backdrop-blur-xs transition-all ${
                          isSelected
                            ? 'border-rose-400 bg-rose-950/80 ring-2 ring-rose-400'
                            : item.categoryId === 'ghost_net'
                            ? 'border-rose-500 bg-rose-950/60'
                            : 'border-indigo-400 bg-indigo-950/60'
                        }`}>
                          <div className="flex items-center gap-1 text-[8px] font-mono font-bold text-white bg-rose-600 px-1 py-0.5 rounded shadow-xs">
                            <span>{item.id}</span>
                            <span className="truncate max-w-[90px]">{item.categoryName}</span>
                            <span className="text-yellow-300 font-bold">{item.confidence}%</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[7px] font-mono text-slate-200">
                            <span className="bg-black/80 px-1 rounded text-emerald-400">ECHO REFLECT</span>
                            <span className="bg-black/80 px-1 rounded text-slate-400">SHADOW {item.acousticShadowM}m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Center Nadir Track (Cols 6-7) */}
                <div className="col-span-2 bg-black relative flex flex-col items-center justify-between py-1 border-r border-slate-900 text-[8px] font-mono text-slate-500 z-10">
                  <span className="text-[8px] text-slate-600 uppercase tracking-widest">Acoustic Nadir</span>
                  <div className="w-1 h-full bg-sky-500/20 border-l border-dashed border-sky-400/50" />
                  <span className="text-emerald-400 font-bold bg-slate-950 px-1 rounded border border-emerald-800">
                    ALT 2.1m
                  </span>
                </div>

                {/* 3. Starboard Channel (Cols 8-12): Real Sonar Waterfall */}
                <div className="col-span-5 relative overflow-hidden bg-black">
                  <img
                    src="/sonar/sonar_shipwreck.jpg"
                    alt="Starboard Channel Side Scan Sonar"
                    className="absolute inset-0 w-full h-[250%] object-cover opacity-90 filter contrast-125 brightness-95 scale-x-[-1]"
                    style={{
                      transform: `translateY(-${(pingOffset * 0.4) % 60}%)`,
                      transition: isPlaying ? 'transform 0.06s linear' : 'none',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-amber-950/20 via-transparent to-black/40 pointer-events-none" />

                  {/* Overlaid AI Detection Annotations on Starboard Channel */}
                  {detections.filter(d => d.channel === 'Starboard').map((item, idx) => {
                    const isSelected = selectedDetection?.id === item.id;
                    const topPercent = (15 + idx * 38 + (pingOffset * 0.2)) % 80;

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectDetection(item)}
                        className="absolute cursor-pointer transition-transform hover:scale-105 z-10"
                        style={{ top: `${topPercent}%`, right: `${15 + (idx % 2) * 35}%` }}
                      >
                        <div className={`p-1 rounded border-2 backdrop-blur-xs transition-all ${
                          isSelected
                            ? 'border-rose-400 bg-rose-950/80 ring-2 ring-rose-400'
                            : item.categoryId === 'ghost_net'
                            ? 'border-rose-500 bg-rose-950/60'
                            : 'border-amber-400 bg-amber-950/60'
                        }`}>
                          <div className="flex items-center gap-1 text-[8px] font-mono font-bold text-white bg-amber-600 px-1 py-0.5 rounded shadow-xs">
                            <span>{item.id}</span>
                            <span className="truncate max-w-[90px]">{item.categoryName}</span>
                            <span className="text-yellow-300 font-bold">{item.confidence}%</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[7px] font-mono text-slate-200">
                            <span className="bg-black/80 px-1 rounded text-emerald-400">ECHO REFLECT</span>
                            <span className="bg-black/80 px-1 rounded text-slate-400">SHADOW {item.acousticShadowM}m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          ) : (
            /* Target Gallery: Real Echogram Results */
            <div className="flex-1 flex gap-3 overflow-hidden">
              
              {/* Target Cards Grid */}
              <div className="flex-1 grid grid-cols-3 gap-2 overflow-y-auto pr-1">
                {detections.map((det) => {
                  const img = det.echogramImage || '/sonar/sonar_net_wreck.png';
                  const isSelected = selectedDetection?.id === det.id;

                  return (
                    <div
                      key={det.id}
                      onClick={() => {
                        onSelectDetection(det);
                        setSelectedGalleryImg(img);
                      }}
                      className={`flex flex-col bg-slate-900 border rounded-lg overflow-hidden cursor-pointer transition-all ${
                        isSelected ? 'border-sky-400 ring-2 ring-sky-400/50' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-20 bg-black relative overflow-hidden">
                        <img
                          src={img}
                          alt={det.categoryName}
                          className="w-full h-full object-cover filter contrast-125"
                        />
                        <span className="absolute top-1 left-1 px-1 py-0.5 bg-black/80 font-mono text-[8px] font-bold rounded text-white border border-slate-700">
                          {det.id}
                        </span>
                        <span className="absolute top-1 right-1 px-1 py-0.5 bg-emerald-600 font-mono text-[8px] font-bold rounded text-white">
                          {det.confidence}%
                        </span>
                      </div>
                      <div className="p-1.5 flex flex-col justify-between flex-1 bg-slate-950 text-[10px]">
                        <span className="font-semibold text-slate-200 truncate">{det.categoryName}</span>
                        <div className="flex justify-between text-slate-400 font-mono text-[9px] mt-1">
                          <span>Ch: {det.channel}</span>
                          <span>Shadow: {det.acousticShadowM}m</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail Preview of Real Sonar Result */}
              <div className="w-72 bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between shrink-0">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-bold text-sky-400 font-mono">
                    <span>REAL ACOUSTIC ECHOGRAM</span>
                    <span className="text-[10px] text-slate-400">455 kHz</span>
                  </div>
                  <div className="h-28 bg-black rounded border border-slate-800 overflow-hidden relative mb-2">
                    <img
                      src={selectedGalleryImg}
                      alt="Real Sonar Result"
                      className="w-full h-full object-cover filter contrast-130 brightness-95"
                    />
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-emerald-400">
                      NOAA / SSS Dataset
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-300 font-mono leading-relaxed">
                    {selectedDetection ? selectedDetection.notes : 'Real side-scan sonar acoustic return captured with high-frequency backscatter highlighting entangled synthetic mesh.'}
                  </p>
                </div>

                <div className="bg-black/60 rounded p-1.5 border border-slate-800/80 text-[9px] font-mono text-slate-400 flex justify-between">
                  <span>SNR: <strong>26.1 dB</strong></span>
                  <span>Speckle: <strong>Optimal</strong></span>
                  <span>Shadow: <strong>3.4m</strong></span>
                </div>
              </div>

            </div>
          )}

          {/* Bottom Feed Status Pill */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 shrink-0 border-t border-slate-900 mt-1">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <Radio className="w-3 h-3" /> Real Sonar Sensor Stream Active
              </span>
              <span>•</span>
              <span>Dataset: <strong>High-Frequency Side-Scan Sonar (455 kHz)</strong></span>
            </div>
            <div>
              <span>Active Target: <strong className="text-sky-300">{selectedDetection ? `${selectedDetection.id} • ${selectedDetection.categoryName} (${selectedDetection.confidence}%)` : 'Select a target to inspect echogram'}</strong></span>
            </div>
          </div>

        </div>
      )}

    </section>
  );
};
