import { create } from 'zustand';

export interface Commit {
  id: string;
  message: string;
  timestamp: number;
  author: string;
  filesChanged: number;
}

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: number;
  commitId: string;
  description?: string;
}

export interface Branch {
  id: string;
  name: string;
  headCommitId: string;
  createdAt: number;
  isActive: boolean;
}

interface TimelineSlice {
  commits: Commit[];
  checkpoints: Checkpoint[];
  branches: Branch[];
  selectedItemId: string | null;
  selectItem: (id: string | null) => void;
  initiateRollback: (commitId: string) => void;
  setCommits: (commits: Commit[]) => void;
  setCheckpoints: (checkpoints: Checkpoint[]) => void;
  setBranches: (branches: Branch[]) => void;
}

export const useTimelineStore = create<TimelineSlice>((set) => ({
  commits: [],
  checkpoints: [],
  branches: [],
  selectedItemId: null,

  selectItem: (id: string | null) =>
    set({ selectedItemId: id }),

  initiateRollback: (commitId: string) =>
    set((state) => {
      // Mark rollback initiated - actual rollback handled by backend
      console.log(`Rollback initiated to commit: ${commitId}`);
      return { selectedItemId: commitId };
    }),

  setCommits: (commits: Commit[]) =>
    set({ commits }),

  setCheckpoints: (checkpoints: Checkpoint[]) =>
    set({ checkpoints }),

  setBranches: (branches: Branch[]) =>
    set({ branches }),
}));
