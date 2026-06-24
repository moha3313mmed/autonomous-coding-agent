import { create } from 'zustand';

export interface NamespaceInfo {
  name: string;
  entryCount: number;
  lastUpdated: number;
}

export interface MemoryEntry {
  id: string;
  namespace: string;
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalEntries: number;
}

interface MemorySlice {
  namespaces: NamespaceInfo[];
  currentNamespace: string | null;
  entries: MemoryEntry[];
  searchQuery: string;
  pagination: PaginationState;
  selectNamespace: (namespace: string | null) => void;
  searchMemory: (query: string) => void;
  setPage: (page: number) => void;
  setEntries: (entries: MemoryEntry[], totalEntries: number) => void;
  setNamespaces: (namespaces: NamespaceInfo[]) => void;
  getPagedEntries: () => MemoryEntry[];
}

export const useMemoryStore = create<MemorySlice>((set, get) => ({
  namespaces: [],
  currentNamespace: null,
  entries: [],
  searchQuery: '',
  pagination: {
    currentPage: 1,
    pageSize: 20,
    totalEntries: 0,
  },

  selectNamespace: (namespace: string | null) =>
    set({
      currentNamespace: namespace,
      pagination: { currentPage: 1, pageSize: 20, totalEntries: 0 },
      entries: [],
      searchQuery: '',
    }),

  searchMemory: (query: string) =>
    set((state) => ({
      searchQuery: query,
      pagination: { ...state.pagination, currentPage: 1 },
    })),

  setPage: (page: number) =>
    set((state) => ({
      pagination: { ...state.pagination, currentPage: page },
    })),

  setEntries: (entries: MemoryEntry[], totalEntries: number) =>
    set((state) => ({
      entries,
      pagination: { ...state.pagination, totalEntries },
    })),

  setNamespaces: (namespaces: NamespaceInfo[]) =>
    set({ namespaces }),

  getPagedEntries: () => {
    const state = get();
    const { currentPage, pageSize } = state.pagination;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return state.entries.slice(start, end);
  },
}));
