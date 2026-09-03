import React, { useState } from 'react';
import { X, UploadCloud, FileCode2, FileCheck } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogUploaded: (filename: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onLogUploaded,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  if (!isOpen) return null;

  const handleSimulateUpload = (fileName: string) => {
    setIsProcessing(true);
    setProgress(15);
    setStage('Decoding XTF Header & Ping Geometry...');

    setTimeout(() => {
      setProgress(45);
      setStage('Running 2D CFAR Speckle Noise Suppression...');
    }, 600);

    setTimeout(() => {
      setProgress(80);
      setStage('Executing YOLOv8 Marine Debris Segmentation...');
    }, 1200);

    setTimeout(() => {
      setProgress(100);
      setStage('Generating Geotagged Hazard Report...');
      setTimeout(() => {
        setIsProcessing(false);
        onLogUploaded(fileName);
        onClose();
      }, 500);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none animate-fadeIn">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0A2540] flex items-center justify-center">
              <UploadCloud className="w-4 h-4 text-[#0284C7]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Upload Sonar Log File
              </h3>
              <p className="text-xs text-slate-500">
                Side-scan sonar acoustic recordings & ping logs
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

        {/* Body */}
        <div className="p-5 space-y-4">
          
          {/* Dropzone Area */}
          <div 
            onClick={() => handleSimulateUpload('TRANSECT_CHENNAI_SURVEY_NEW.XTF')}
            className="border-2 border-dashed border-sky-300 hover:border-[#0284C7] bg-sky-50/40 hover:bg-sky-50/80 rounded-xl p-6 text-center cursor-pointer transition-all group"
          >
            <UploadCloud className="w-10 h-10 text-[#0284C7] mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <p className="font-bold text-xs text-slate-800">
              Drag and drop raw sonar file here, or <span className="text-[#0284C7] underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports .XTF (eXtended Triton), .JSF (EdgeTech), .TIFF, .CSV headers
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-mono text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded">
              <FileCode2 className="w-3.5 h-3.5 text-sky-600" /> Max file size: 2.5 GB (Edge Streamed)
            </div>
          </div>

          {/* Quick preset test logs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Or Load NIOT Reference Benchmark Logs:
            </label>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => handleSimulateUpload('NIOT_BAY_BENGAL_DEBRIS_TRANSECT_01.XTF')}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-800">
                      NIOT_BAY_BENGAL_DEBRIS_TRANSECT_01.XTF
                    </span>
                    <p className="text-[10px] text-slate-500">
                      455 kHz • 120m Swath • 8 Ghost Nets & 3 Shipwreck fragments
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">342 MB</span>
              </button>

              <button
                type="button"
                onClick={() => handleSimulateUpload('COASTAL_TAMIL_NADU_REEF_TRANSECT_03.JSF')}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-sky-600" />
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-800">
                      COASTAL_TAMIL_NADU_REEF_TRANSECT_03.JSF
                    </span>
                    <p className="text-[10px] text-slate-500">
                      900 kHz Ultra-Res • High Natural Rock Shadow Complexity
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">512 MB</span>
              </button>
            </div>
          </div>

          {/* Upload & Ingestion Progress */}
          {isProcessing && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{stage}</span>
                <span className="font-mono font-bold text-[#0A2540]">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#0284C7] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
