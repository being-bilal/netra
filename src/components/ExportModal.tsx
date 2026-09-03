import React, { useState } from 'react';
import { SonarDetection } from '../types/sonar';
import { X, Download, FileSpreadsheet, FileJson, Check } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  detections: SonarDetection[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  detections,
}) => {
  const [format, setFormat] = useState<'csv' | 'json' | 'geojson'>('csv');
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const generateCsv = () => {
    const headers = 'ID,Class,Confidence(%),Latitude,Longitude,Depth(m),Length(m),Width(m),Shadow(m),Channel,Timestamp\n';
    const rows = detections.map(d => 
      `${d.id},"${d.categoryName}",${d.confidence},${d.latitude},${d.longitude},${d.depthMeters},${d.dimensions.lengthM},${d.dimensions.widthM},${d.acousticShadowM},${d.channel},${d.timestamp}`
    ).join('\n');
    return headers + rows;
  };

  const handleDownload = () => {
    let content = '';
    let mimeType = 'text/plain';
    let filename = `NIOT_NETRA_ANOMALY_REPORT_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      content = generateCsv();
      mimeType = 'text/csv';
      filename += '.csv';
    } else {
      content = JSON.stringify(detections, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => {
      setDownloaded(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none animate-fadeIn">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Export Geotagged Anomaly Report
              </h3>
              <p className="text-xs text-slate-500">
                Ministry of Earth Sciences (MoES) & NIOT Structured Standard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          
          {/* Format Selection Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Select Output Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  format === 'csv'
                    ? 'border-[#0284C7] bg-sky-50 text-sky-900 ring-1 ring-[#0284C7]'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>CSV Format</span>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Excel, Pandas, R compatible tabular coordinates
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  format === 'json'
                    ? 'border-[#0284C7] bg-sky-50 text-sky-900 ring-1 ring-[#0284C7]'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>JSON Payload</span>
                  <FileJson className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  REST API & Edge Robotics Integration
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('geojson')}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  format === 'geojson'
                    ? 'border-[#0284C7] bg-sky-50 text-sky-900 ring-1 ring-[#0284C7]'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>GeoJSON Layer</span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded">GIS</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  QGIS, ArcGIS, & Google Earth Nautical shapefile
                </p>
              </button>
            </div>
          </div>

          {/* Data Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700">
                Payload Preview ({detections.length} Anomaly Records)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Log: TRANSECT_04.XTF
              </span>
            </div>

            <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2">Target ID</th>
                    <th className="p-2">Classification</th>
                    <th className="p-2">Confidence</th>
                    <th className="p-2">Latitude</th>
                    <th className="p-2">Longitude</th>
                    <th className="p-2">Dimensions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                  {detections.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{d.id}</td>
                      <td className="p-2">{d.categoryName}</td>
                      <td className="p-2 text-emerald-700 font-bold">{d.confidence}%</td>
                      <td className="p-2">{d.latitude.toFixed(4)}°N</td>
                      <td className="p-2">{d.longitude.toFixed(4)}°E</td>
                      <td className="p-2">{d.dimensions.lengthM}m × {d.dimensions.widthM}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Certified for National Marine Spatial Planning & Cleanup Deployment
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-2 bg-[#0A2540] hover:bg-[#081d33] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {downloaded ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-sky-400" />}
              <span>{downloaded ? 'Exported Successfully!' : `Download ${format.toUpperCase()} Report`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
