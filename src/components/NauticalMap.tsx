import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SonarDetection, AUVTelemetry, AnomalyClassConfig } from '../types/sonar';
import { 
  Crosshair, 
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface NauticalMapProps {
  telemetry: AUVTelemetry;
  detections: SonarDetection[];
  classes: AnomalyClassConfig[];
  confidenceThreshold: number;
  selectedDetection: SonarDetection | null;
  onSelectDetection: (detection: SonarDetection) => void;
}

export const NauticalMap: React.FC<NauticalMapProps> = ({
  telemetry,
  detections,
  classes,
  confidenceThreshold,
  selectedDetection,
  onSelectDetection,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const swathLayerRef = useRef<L.LayerGroup | null>(null);
  const auvMarkerRef = useRef<L.Marker | null>(null);

  const [mapType, setMapType] = useState<'hybrid' | 'osm_terrain' | 'roadmap'>('osm_terrain');
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  // Filter detections based on visibility & confidence
  const activeDetections = detections.filter((d) => {
    const cls = classes.find((c) => c.id === d.categoryId);
    return (cls?.visible ?? true) && d.confidence >= confidenceThreshold;
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [telemetry.latitude, telemetry.longitude],
        zoom: 18,
        zoomControl: false,
        attributionControl: false,
      });

      const swathLayer = L.layerGroup().addTo(map);
      const markersLayer = L.layerGroup().addTo(map);

      swathLayerRef.current = swathLayer;
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Map Tile Layer (OSM Terrain, Google Satellite, Google Light)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    if (mapType === 'osm_terrain') {
      // OpenTopoMap - Definitive OSM Topographic Terrain Layer
      const osmTerrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        subdomains: ['a', 'b', 'c'],
        maxZoom: 17,
        attribution: 'OpenTopoMap / OpenStreetMap contributors',
      }).addTo(map);
      currentTileLayerRef.current = osmTerrain;
    } else if (mapType === 'hybrid') {
      // Google Hybrid Satellite
      const googleHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: 'Google Maps',
      }).addTo(map);
      currentTileLayerRef.current = googleHybrid;
    } else {
      // Google Light Roadmap
      const googleRoadmap = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: 'Google Maps',
      }).addTo(map);
      currentTileLayerRef.current = googleRoadmap;
    }
  }, [mapType]);

  // Update AUV Swath and Track (Confined inside Shekha Lake waters)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const swathLayer = swathLayerRef.current;
    if (!map || !swathLayer) return;

    swathLayer.clearLayers();
    map.setView([telemetry.latitude, telemetry.longitude], map.getZoom() || 18);

    // AUV Lake Pool Survey Transect Track (100% inside the circular open-water pool)
    const trackPoints: [number, number][] = [
      [27.85616, 78.218074],
      [telemetry.latitude, telemetry.longitude],
      [27.85658, 78.218074],
    ];

    // Swath Coverage Corridor (Tightly hugs the pool transect: 25m total width)
    const swathPolygonCoords: [number, number][] = [
      [27.85616, 78.21798],
      [telemetry.latitude, 78.21798],
      [27.85658, 78.21798],
      // east side
      [27.85658, 78.21816],
      [telemetry.latitude, 78.21816],
      [27.85616, 78.21816],
    ];

    // Swath Polygon Overlay
    L.polygon(swathPolygonCoords, {
      color: '#38BDF8',
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: '#0284C7',
      fillOpacity: 0.22,
    }).addTo(swathLayer);

    // Centerline Survey Track
    L.polyline(trackPoints, {
      color: '#FFFFFF',
      weight: 2,
      dashArray: '6, 4',
      opacity: 0.95,
    }).addTo(swathLayer);

    // Sonar Ping Radius around AUV (16m radius inside the open pool)
    L.circle([telemetry.latitude, telemetry.longitude], {
      radius: 16,
      color: '#38BDF8',
      weight: 1.5,
      fillColor: '#38BDF8',
      fillOpacity: 0.12,
      dashArray: '3, 3',
    }).addTo(swathLayer);

    // AUV Vehicle Marker Icon with heading
    const auvIcon = L.divIcon({
      className: 'custom-auv-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-left: -22px; margin-top: -22px;">
          <!-- Sonar Ping Wave -->
          <div style="position: absolute; inset: 0; border-radius: 9999px; border: 2px solid #38BDF8; opacity: 0.8; animation: sonar-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          
          <!-- AUV Vehicle Body -->
          <div style="width: 34px; height: 34px; border-radius: 9999px; background-color: #0A2540; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; transform: rotate(${telemetry.headingDeg}deg);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#38BDF8" stroke="#38BDF8" stroke-width="2">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
          
          <!-- Vehicle Label -->
          <div style="position: absolute; top: 35px; white-space: nowrap; background-color: #0A2540; color: #FFFFFF; font-size: 10px; font-weight: 700; font-family: monospace; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.3);">
            AUV-04 MATSYA
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (auvMarkerRef.current) {
      auvMarkerRef.current.setLatLng([telemetry.latitude, telemetry.longitude]);
      auvMarkerRef.current.setIcon(auvIcon);
    } else {
      auvMarkerRef.current = L.marker([telemetry.latitude, telemetry.longitude], {
        icon: auvIcon,
        zIndexOffset: 1000,
      }).addTo(swathLayer);
    }
  }, [telemetry]);

  // Update Debris Anomaly Markers
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.clearLayers();

    activeDetections.forEach((item) => {
      const isSelected = selectedDetection?.id === item.id;
      const isGhostNet = item.categoryId === 'ghost_net';
      const isShipwreck = item.categoryId === 'shipwreck';
      const isPipeline = item.categoryId === 'pipeline';

      const color = isGhostNet ? '#DC2626' : isShipwreck ? '#D97706' : isPipeline ? '#4F46E5' : '#64748B';
      const symbol = isGhostNet ? '✱' : '●';

      const markerHtml = `
        <div style="position: relative; display: flex; align-items: center; cursor: pointer; user-select: none;">
          <!-- Reticle Ring -->
          <div style="
            width: 26px; 
            height: 26px; 
            border-radius: 9999px; 
            background: ${isSelected ? color : '#FFFFFF'}; 
            border: 2.5px solid ${color}; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.35); 
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-weight: 800;
            font-size: 13px;
            color: ${isSelected ? '#FFFFFF' : color};
            transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'};
            transition: transform 0.15s ease;
          ">
            ${symbol}
          </div>

          <!-- Confidence Tag matching user sketch (e.g. 99%) -->
          <div style="
            margin-left: 6px; 
            background-color: ${isSelected ? '#0A2540' : '#FFFFFF'}; 
            color: ${isSelected ? '#FFFFFF' : '#0F172A'}; 
            border: 1px solid ${isSelected ? '#0A2540' : '#CBD5E1'}; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: monospace; 
            font-size: 11px; 
            font-weight: 700; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: ${color};"></span>
            <span>${item.confidence.toFixed(0)}%</span>
            <span style="color: ${isSelected ? '#94A3B8' : '#64748B'}; font-size: 9px; font-weight: 500;">${item.id}</span>
          </div>
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'custom-sonar-marker',
        html: markerHtml,
        iconSize: [110, 30],
        iconAnchor: [13, 15],
      });

      const marker = L.marker([item.latitude, item.longitude], {
        icon: markerIcon,
        zIndexOffset: isSelected ? 900 : 500,
      });

      marker.on('click', () => {
        onSelectDetection(item);
      });

      marker.bindTooltip(`
        <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
          <strong style="color: ${color}">${item.categoryName}</strong> (${item.confidence}%)<br/>
          <span>Dims: ${item.dimensions.lengthM}m × ${item.dimensions.widthM}m</span><br/>
          <span>Depth: ${item.depthMeters}m (${item.channel} Swath)</span>
        </div>
      `, { direction: 'top', offset: [0, -12] });

      marker.addTo(markersLayer);
    });
  }, [activeDetections, selectedDetection]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleCenterAUV = () => {
    mapInstanceRef.current?.setView([telemetry.latitude, telemetry.longitude], 18, {
      animate: true,
    });
  };

  return (
    <div className="relative flex-1 h-full w-full bg-slate-900 overflow-hidden select-none">
      
      {/* Real Google Maps Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Controls Bar */}
      <div className="absolute top-3 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
        
        {/* Oceanographic Location Pill */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-lg px-3 py-1.5 shadow-md pointer-events-auto flex items-center gap-2.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-pulse" />
          <span className="font-bold text-[#0A2540]">
            Shekha Lake Open-Water Pool • {telemetry.latitude.toFixed(6)}° N, {telemetry.longitude.toFixed(6)}° E
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-slate-600 text-[11px]">
            OSM & Google Geo Feed
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-bold text-[11px]">
            Swath: 25m
          </span>
        </div>

        {/* Map Layer Switcher (OSM Terrain / Google Satellite / Google Light) */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-lg p-1 shadow-md pointer-events-auto flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => setMapType('osm_terrain')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              mapType === 'osm_terrain'
                ? 'bg-[#0A2540] text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            OSM Terrain
          </button>
          <button
            onClick={() => setMapType('hybrid')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              mapType === 'hybrid'
                ? 'bg-[#0A2540] text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Google Satellite
          </button>
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              mapType === 'roadmap'
                ? 'bg-[#0A2540] text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Google Light
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <button
            onClick={handleCenterAUV}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            title="Recenter on AUV"
          >
            <Crosshair className="w-4 h-4 text-[#0284C7]" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Floating Bottom Quick Legend */}
      <div className="absolute bottom-3 left-4 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-lg px-3 py-1.5 shadow-md flex items-center gap-3 text-xs font-mono text-slate-700">
        <span className="flex items-center gap-1.5 font-sans font-medium text-[11px]">
          <span className="text-rose-600 font-bold text-sm leading-none">✱</span> Ghost Nets ({activeDetections.filter(d => d.categoryId === 'ghost_net').length})
        </span>
        <span className="text-slate-300">•</span>
        <span className="flex items-center gap-1.5 font-sans font-medium text-[11px]">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Shipwrecks ({activeDetections.filter(d => d.categoryId === 'shipwreck').length})
        </span>
        <span className="text-slate-300">•</span>
        <span className="flex items-center gap-1.5 font-sans font-medium text-[11px]">
          <span className="w-2 h-2 rounded-full bg-indigo-600" /> Subsea Pipes ({activeDetections.filter(d => d.categoryId === 'pipeline').length})
        </span>
        <span className="text-slate-300">•</span>
        <span className="flex items-center gap-1.5 font-sans font-medium text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0A2540] border border-white" /> AUV-04 (138° SE)
        </span>
      </div>

    </div>
  );
};
