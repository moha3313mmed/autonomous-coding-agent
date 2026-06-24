import { create } from 'zustand';

export interface PendingOutput {
  id: string;
  taskId: string;
  type: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected' | 'corrected';
  correction?: string;
}

export interface AcceptanceRate {
  category: string;
  accepted: number;
  rejected: number;
  corrected: number;
  total: number;
  rate: number;
}

interface FeedbackSlice {
  pendingOutputs: PendingOutput[];
  acceptanceRates: AcceptanceRate[];
  selectedOutputId: string | null;
  submitCorrection: (outputId: string, correction: string) => void;
  acceptOutput: (outputId: string) => void;
  rejectOutput: (outputId: string) => void;
  setPendingOutputs: (outputs: PendingOutput[]) => void;
  setAcceptanceRates: (rates: AcceptanceRate[]) => void;
  selectOutput: (id: string | null) => void;
}

export const useFeedbackStore = create<FeedbackSlice>((set) => ({
  pendingOutputs: [],
  acceptanceRates: [],
  selectedOutputId: null,

  submitCorrection: (outputId: string, correction: string) =>
    set((state) => ({
      pendingOutputs: state.pendingOutputs.map((output) =>
        output.id === outputId
          ? { ...output, status: 'corrected' as const, correction }
          : output
      ),
    })),

  acceptOutput: (outputId: string) =>
    set((state) => ({
      pendingOutputs: state.pendingOutputs.map((output) =>
        output.id === outputId
          ? { ...output, status: 'accepted' as const }
          : output
      ),
    })),

  rejectOutput: (outputId: string) =>
    set((state) => ({
      pendingOutputs: state.pendingOutputs.map((output) =>
        output.id === outputId
          ? { ...output, status: 'rejected' as const }
          : output
      ),
    })),

  setPendingOutputs: (outputs: PendingOutput[]) =>
    set({ pendingOutputs: outputs }),

  setAcceptanceRates: (rates: AcceptanceRate[]) =>
    set({ acceptanceRates: rates }),

  selectOutput: (id: string | null) =>
    set({ selectedOutputId: id }),
}));
