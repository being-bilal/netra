import React from 'react';
import { AUVTelemetry } from '../types/sonar';
import { Compass, HardDrive, Radio } from 'lucide-react';

interface HeaderProps {
  telemetry: AUVTelemetry;
  activeView: 'map' | 'waterfall';
  setActiveView: (view: 'map' | 'waterfall') => void;
  isSonarFeedExpanded: boolean;
  onToggleSonarFeed: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  activeView,
  setActiveView,
  isSonarFeedExpanded,
  onToggleSonarFeed,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 h-14 px-4 flex items-center justify-between gap-4 select-none shrink-0 z-30">
      
      {/* 1. Left: Official NETRA Brand & Ministry Lockup */}
      <div className="flex items-center gap-3">
        <img 
          src="/logos/netra-full.png" 
          alt="NETRA Logo" 
          className="h-8 w-auto object-contain cursor-pointer" 
        />
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#0A2540] bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
            MoES • NIOT
          </span>
          <span className="text-xs font-semibold text-slate-700">
            Automated Sonar Marine Debris AI
          </span>
        </div>
      </div>

      {/* 2. Middle: Streamlined Mission & Log Status */}
      <div className="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono font-bold text-slate-800 text-[11px] truncate max-w-[200px]" title={telemetry.activeLogFile}>
            {telemetry.activeLogFile}
          </span>
        </div>

        <span className="text-slate-300">|</span>

        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600">
          <span>{telemetry.frequencyKhz} kHz SSS</span>
          <span>•</span>
          <span>Swath: {telemetry.swathWidthMeters}m</span>
          <span>•</span>
          <span>Alt: {telemetry.altitudeMeters}m</span>
          <span>•</span>
          <span>Speed: {telemetry.speedKnots} kts</span>
        </div>
      </div>

      {/* 3. Right: Coordinates, View Mode & Action */}
      <div className="flex items-center gap-3">
        {/* GPS readout */}
        <div className="hidden lg:flex items-center gap-1.5 bg-sky-50/80 border border-sky-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-[#0A2540]">
          <Compass className="w-3.5 h-3.5 text-sky-600" />
          <span>{telemetry.latitude.toFixed(6)}°N, {telemetry.longitude.toFixed(6)}°E</span>
        </div>

        {/* View Switcher: Map vs Waterfall */}
        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveView('map')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeView === 'map'
                ? 'bg-white text-[#0A2540] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ocean Map
          </button>
          <button
            onClick={() => setActiveView('waterfall')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              activeView === 'waterfall'
                ? 'bg-white text-[#0A2540] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sonar Waterfall
          </button>
        </div>

        {/* Sonar Live Feed Toggle (on map view) */}
        {activeView === 'map' && (
          <button
            onClick={onToggleSonarFeed}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              isSonarFeedExpanded
                ? 'bg-sky-50 text-sky-900 border-sky-300 font-bold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Live Side-Scan Sonar Waterfall Feed"
          >
            <Radio className={`w-3.5 h-3.5 ${isSonarFeedExpanded ? 'text-sky-600 animate-pulse' : 'text-slate-400'}`} />
            <span>{isSonarFeedExpanded ? 'Hide Sonar Feed' : 'Live Sonar Feed'}</span>
          </button>
        )}
      </div>

    </header>
  );
};
