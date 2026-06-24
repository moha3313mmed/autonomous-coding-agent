import { create } from 'zustand';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  confidence: number;
  usageCount: number;
  successRate: number;
  createdAt: number;
  refinementBadge?: string;
}

export type SortField = 'confidence' | 'usageCount' | 'createdAt' | 'successRate';
export type SortDirection = 'asc' | 'desc';

export interface SkillFilters {
  categories: string[];
  languages: string[];
  minConfidence: number;
  refinementBadge?: string;
}

interface SkillsSlice {
  skills: Skill[];
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  filters: SkillFilters;
  selectedSkillId: string | null;
  setSearch: (query: string) => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  setFilters: (filters: Partial<SkillFilters>) => void;
  selectSkill: (id: string | null) => void;
  getFilteredSkills: () => Skill[];
}

export const useSkillsStore = create<SkillsSlice>((set, get) => ({
  skills: [],
  searchQuery: '',
  sortField: 'confidence',
  sortDirection: 'desc',
  filters: {
    categories: [],
    languages: [],
    minConfidence: 0,
  },
  selectedSkillId: null,

  setSearch: (query: string) =>
    set({ searchQuery: query }),

  setSort: (field: SortField, direction: SortDirection) =>
    set({ sortField: field, sortDirection: direction }),

  setFilters: (filters: Partial<SkillFilters>) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  selectSkill: (id: string | null) =>
    set({ selectedSkillId: id }),

  getFilteredSkills: () => {
    const state = get();
    let filtered = [...state.skills];

    // Apply search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (state.filters.categories.length > 0) {
      filtered = filtered.filter((skill) =>
        state.filters.categories.includes(skill.category)
      );
    }

    // Apply language filter
    if (state.filters.languages.length > 0) {
      filtered = filtered.filter((skill) =>
        state.filters.languages.includes(skill.language)
      );
    }

    // Apply minimum confidence filter
    if (state.filters.minConfidence > 0) {
      filtered = filtered.filter(
        (skill) => skill.confidence >= state.filters.minConfidence
      );
    }

    // Apply refinement badge filter
    if (state.filters.refinementBadge) {
      filtered = filtered.filter(
        (skill) => skill.refinementBadge === state.filters.refinementBadge
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[state.sortField];
      const bVal = b[state.sortField];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return state.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  },
}));
