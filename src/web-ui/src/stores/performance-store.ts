import { create } from 'zustand';

export type TimeRange = '1h' | '24h' | '7d' | '30d';

export interface DataPoint {
  timestamp: number;
  value: number;
  category: string;
}

export interface CategoryBreakdown {
  category: string;
  totalTasks: number;
  successRate: number;
  avgDuration: number;
}

export interface OptimizationFlags {
  autoScale: boolean;
  cacheEnabled: boolean;
  parallelExecution: boolean;
}

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

interface PerformanceSlice {
  timeSeries: DataPoint[];
  categoryBreakdown: CategoryBreakdown[];
  selectedTimeRange: TimeRange;
  optimizationFlags: OptimizationFlags;
  addDataPoint: (point: DataPoint) => void;
  setTimeRange: (range: TimeRange) => void;
  setOptimizationFlags: (flags: Partial<OptimizationFlags>) => void;
  getFilteredTimeSeries: () => DataPoint[];
}

export const usePerformanceStore = create<PerformanceSlice>((set, get) => ({
  timeSeries: [],
  categoryBreakdown: [],
  selectedTimeRange: '24h',
  optimizationFlags: {
    autoScale: false,
    cacheEnabled: true,
    parallelExecution: true,
  },

  addDataPoint: (point: DataPoint) =>
    set((state) => ({
      timeSeries: [...state.timeSeries, point],
    })),

  setTimeRange: (range: TimeRange) =>
    set({ selectedTimeRange: range }),

  setOptimizationFlags: (flags: Partial<OptimizationFlags>) =>
    set((state) => ({
      optimizationFlags: { ...state.optimizationFlags, ...flags },
    })),

  getFilteredTimeSeries: () => {
    const state = get();
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[state.selectedTimeRange];
    const cutoff = now - rangeMs;
    return state.timeSeries.filter((point) => point.timestamp >= cutoff);
  },
}));
