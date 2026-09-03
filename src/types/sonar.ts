export type AnomalyCategory = 'ghost_net' | 'shipwreck' | 'pipeline' | 'natural_ridge';

export interface AnomalyClassConfig {
  id: AnomalyCategory;
  name: string;
  count: number;
  color: string;
  borderColor: string;
  bgLight: string;
  textColor: string;
  hazardLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'BASELINE';
  description: string;
  visible: boolean;
}

export interface SonarDetection {
  id: string;
  categoryId: AnomalyCategory;
  categoryName: string;
  confidence: number;
  latitude: number;
  longitude: number;
  depthMeters: number;
  dimensions: {
    lengthM: number;
    widthM: number;
    heightM: number;
  };
  acousticShadowM: number;
  channel: 'Port' | 'Starboard';
  rangeMeters: number;
  pingIndex: number;
  timestamp: string;
  status: 'DETECTED' | 'VERIFIED' | 'REVIEW';
  signalToNoiseRatioDb: number;
  speckleFilteringScore: number;
  notes: string;
  echogramImage?: string;
}

export interface AUVTelemetry {
  vehicleId: string;
  modelName: string;
  missionStatus: 'ACTIVE TRANSECT' | 'STATION KEEPING' | 'ABORT' | 'CALIBRATION';
  latitude: number;
  longitude: number;
  headingDeg: number;
  speedKnots: number;
  depthMeters: number;
  altitudeMeters: number;
  pingRateHz: number;
  swathWidthMeters: number;
  frequencyKhz: number;
  activeLogFile: string;
  logFileSizeMb: number;
  totalPingsProcessed: number;
  batteryPercent: number;
  edgeInferenceMs: number;
  falsePositiveSuppressionRate: number;
}
