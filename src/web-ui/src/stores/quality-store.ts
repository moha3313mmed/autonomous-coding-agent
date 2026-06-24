import { create } from 'zustand';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface QualityIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  filePath?: string;
  lineNumber?: number;
  timestamp: number;
}

export interface QualityReview {
  id: string;
  timestamp: number;
  totalIssues: number;
  score: number;
  passRate: number;
}

interface QualitySlice {
  latestReview: QualityReview | null;
  issuesByCategory: Map<string, QualityIssue[]>;
  filterSeverity: Severity | null;
  filterCategory: string | null;
  selectedIssueId: string | null;
  selectIssue: (id: string | null) => void;
  setFilters: (filters: { severity?: Severity | null; category?: string | null }) => void;
  setLatestReview: (review: QualityReview) => void;
  setIssues: (issues: QualityIssue[]) => void;
  getFilteredIssues: () => QualityIssue[];
}

export const useQualityStore = create<QualitySlice>((set, get) => ({
  latestReview: null,
  issuesByCategory: new Map(),
  filterSeverity: null,
  filterCategory: null,
  selectedIssueId: null,

  selectIssue: (id: string | null) =>
    set({ selectedIssueId: id }),

  setFilters: (filters) =>
    set((state) => ({
      filterSeverity: filters.severity !== undefined ? filters.severity : state.filterSeverity,
      filterCategory: filters.category !== undefined ? filters.category : state.filterCategory,
    })),

  setLatestReview: (review: QualityReview) =>
    set({ latestReview: review }),

  setIssues: (issues: QualityIssue[]) =>
    set(() => {
      const byCategory = new Map<string, QualityIssue[]>();
      for (const issue of issues) {
        const existing = byCategory.get(issue.category) || [];
        byCategory.set(issue.category, [...existing, issue]);
      }
      return { issuesByCategory: byCategory };
    }),

  getFilteredIssues: () => {
    const state = get();
    let allIssues: QualityIssue[] = [];
    state.issuesByCategory.forEach((issues) => {
      allIssues = allIssues.concat(issues);
    });

    if (state.filterSeverity) {
      allIssues = allIssues.filter((issue) => issue.severity === state.filterSeverity);
    }
    if (state.filterCategory) {
      allIssues = allIssues.filter((issue) => issue.category === state.filterCategory);
    }

    return allIssues;
  },
}));
