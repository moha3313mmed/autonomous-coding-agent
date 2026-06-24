import { create } from 'zustand';

export interface RecoveryError {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  strategy?: string;
  retryCount: number;
}

export interface Escalation {
  id: string;
  errorId: string;
  reason: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface RecoveryStats {
  totalErrors: number;
  resolvedCount: number;
  escalatedCount: number;
  meanTimeToRecover: number;
}

export interface DegradationState {
  isActive: boolean;
  level: 'minor' | 'major' | 'critical';
  affectedServices: string[];
  startedAt: number;
}

interface RecoverySlice {
  errors: RecoveryError[];
  escalations: Escalation[];
  recoveryStats: RecoveryStats;
  activeDegradation: DegradationState | null;
  selectedErrorId: string | null;
  selectError: (id: string | null) => void;
  setErrors: (errors: RecoveryError[]) => void;
  setEscalations: (escalations: Escalation[]) => void;
  setRecoveryStats: (stats: RecoveryStats) => void;
  setActiveDegradation: (degradation: DegradationState | null) => void;
}

export const useRecoveryStore = create<RecoverySlice>((set) => ({
  errors: [],
  escalations: [],
  recoveryStats: {
    totalErrors: 0,
    resolvedCount: 0,
    escalatedCount: 0,
    meanTimeToRecover: 0,
  },
  activeDegradation: null,
  selectedErrorId: null,

  selectError: (id: string | null) =>
    set({ selectedErrorId: id }),

  setErrors: (errors: RecoveryError[]) =>
    set({ errors }),

  setEscalations: (escalations: Escalation[]) =>
    set({ escalations }),

  setRecoveryStats: (stats: RecoveryStats) =>
    set({ recoveryStats: stats }),

  setActiveDegradation: (degradation: DegradationState | null) =>
    set({ activeDegradation: degradation }),
}));
