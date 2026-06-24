import { create } from 'zustand';

export type SystemStatus = 'healthy' | 'degraded' | 'critical';

export interface ResourceGauge {
  name: string;
  value: number;
  max: number;
  unit: string;
}

export interface HealthTimelineEntry {
  timestamp: number;
  status: SystemStatus;
  message: string;
}

export interface DegradationAlert {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

interface HealthSlice {
  systemStatus: SystemStatus;
  resourceGauges: {
    cpu: ResourceGauge;
    memory: ResourceGauge;
    network: ResourceGauge;
  };
  healthTimeline: HealthTimelineEntry[];
  degradationAlerts: DegradationAlert[];
  updateHealth: (status: SystemStatus, gauges?: Partial<HealthSlice['resourceGauges']>) => void;
  addDegradationAlert: (alert: Omit<DegradationAlert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledgeDegradationAlert: (id: string) => void;
  setHealthTimeline: (timeline: HealthTimelineEntry[]) => void;
}

let alertCounter = 0;

export const useHealthStore = create<HealthSlice>((set) => ({
  systemStatus: 'healthy',
  resourceGauges: {
    cpu: { name: 'CPU', value: 0, max: 100, unit: '%' },
    memory: { name: 'Memory', value: 0, max: 100, unit: '%' },
    network: { name: 'Network', value: 0, max: 100, unit: '%' },
  },
  healthTimeline: [],
  degradationAlerts: [],

  updateHealth: (status: SystemStatus, gauges?: Partial<HealthSlice['resourceGauges']>) =>
    set((state) => ({
      systemStatus: status,
      resourceGauges: gauges
        ? { ...state.resourceGauges, ...gauges }
        : state.resourceGauges,
      healthTimeline: [
        ...state.healthTimeline,
        { timestamp: Date.now(), status, message: `System status changed to ${status}` },
      ],
    })),

  addDegradationAlert: (alert) =>
    set((state) => ({
      degradationAlerts: [
        ...state.degradationAlerts,
        {
          ...alert,
          id: `alert-${++alertCounter}-${Date.now()}`,
          timestamp: Date.now(),
          acknowledged: false,
        },
      ],
    })),

  acknowledgeDegradationAlert: (id: string) =>
    set((state) => ({
      degradationAlerts: state.degradationAlerts.map((alert) =>
        alert.id === id ? { ...alert, acknowledged: true } : alert
      ),
    })),

  setHealthTimeline: (timeline: HealthTimelineEntry[]) =>
    set({ healthTimeline: timeline }),
}));
