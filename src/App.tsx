import { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NauticalMap } from './components/NauticalMap';
import { WaterfallView } from './components/WaterfallView';
import { LiveSonarFeed } from './components/LiveSonarFeed';
import { TargetInspector } from './components/TargetInspector';
import { ExportModal } from './components/ExportModal';
import { UploadModal } from './components/UploadModal';
import { 
  INITIAL_CLASSES, 
  INITIAL_TELEMETRY, 
  MOCK_DETECTIONS 
} from './data/mockSonarData';
import { SonarDetection, AnomalyClassConfig, AUVTelemetry } from './types/sonar';

export default function App() {
  const [classes, setClasses] = useState<AnomalyClassConfig[]>(INITIAL_CLASSES);
  const [telemetry, setTelemetry] = useState<AUVTelemetry>(INITIAL_TELEMETRY);
  const [detections] = useState<SonarDetection[]>(MOCK_DETECTIONS);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(85);
  // Default to null so the map has maximum screen real estate and zero clutter!
  const [selectedDetection, setSelectedDetection] = useState<SonarDetection | null>(null);
  const [activeView, setActiveView] = useState<'map' | 'waterfall'>('map');
  const [isSonarFeedExpanded, setIsSonarFeedExpanded] = useState<boolean>(true);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleClass = (id: string) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleLogUploaded = (filename: string) => {
    setTelemetry((prev) => ({
      ...prev,
      activeLogFile: filename,
      totalPingsProcessed: prev.totalPingsProcessed + 2400,
    }));
    showToast(`Sonar log parsed: ${filename} (2,400 acoustic pings ingested)`);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sleek, Single-Bar Top Header */}
      <Header
        telemetry={telemetry}
        activeView={activeView}
        setActiveView={setActiveView}
        isSonarFeedExpanded={isSonarFeedExpanded}
        onToggleSonarFeed={() => setIsSonarFeedExpanded(!isSonarFeedExpanded)}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Streamlined Left Sidebar matching sketch */}
        <Sidebar
          classes={classes}
          onToggleClass={handleToggleClass}
          confidenceThreshold={confidenceThreshold}
          setConfidenceThreshold={setConfidenceThreshold}
          detections={detections}
          selectedDetection={selectedDetection}
          onSelectDetection={(d) => setSelectedDetection(d)}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenUpload={() => setIsUploadOpen(true)}
        />

        {/* Central Stage: Nautical Map + Live Side-Scan Sonar Feed Section */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeView === 'map' ? (
            <>
              <div className="flex-1 w-full h-full relative overflow-hidden">
                <NauticalMap
                  telemetry={telemetry}
                  detections={detections}
                  classes={classes}
                  confidenceThreshold={confidenceThreshold}
                  selectedDetection={selectedDetection}
                  onSelectDetection={(d) => setSelectedDetection(d)}
                />

                {/* Target Inspector Drawer: Confined inside map viewport with z-[1500] above Leaflet tiles */}
                {selectedDetection && (
                  <div className="absolute right-0 top-0 bottom-0 z-[1500] shadow-2xl animate-in slide-in-from-right duration-200">
                    <TargetInspector
                      detection={selectedDetection}
                      onClose={() => setSelectedDetection(null)}
                    />
                  </div>
                )}
              </div>

              {/* Dedicated Live Side-Scan Sonar Feed Section */}
              <LiveSonarFeed
                telemetry={telemetry}
                detections={detections}
                selectedDetection={selectedDetection}
                onSelectDetection={(d) => setSelectedDetection(d)}
                isExpanded={isSonarFeedExpanded}
                onToggleExpand={() => setIsSonarFeedExpanded(!isSonarFeedExpanded)}
              />
            </>
          ) : (
            <div className="flex-1 w-full h-full relative overflow-hidden">
              <WaterfallView
                telemetry={telemetry}
                detections={detections}
                selectedDetection={selectedDetection}
                onSelectDetection={(d) => setSelectedDetection(d)}
              />

              {selectedDetection && (
                <div className="absolute right-0 top-0 bottom-0 z-[1500] shadow-2xl animate-in slide-in-from-right duration-200">
                  <TargetInspector
                    detection={selectedDetection}
                    onClose={() => setSelectedDetection(null)}
                  />
                </div>
              )}
            </div>
          )}
        </main>

      </div>

      {/* Export Report Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        detections={detections.filter((d) => d.confidence >= confidenceThreshold)}
      />

      {/* Upload Sonar Log Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onLogUploaded={handleLogUploaded}
      />

      {/* System Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#0A2540] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border border-sky-600">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
