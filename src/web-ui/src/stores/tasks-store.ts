import { create } from 'zustand';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  answer?: string;
}

export interface TaskResult {
  summary: string;
  duration: number;
}

export interface TaskState {
  id: string;
  description: string;
  language: string;
  status: string;
  submittedAt: number;
  clarifyingQuestions?: ClarifyingQuestion[];
  result?: TaskResult;
}

export interface TaskHistoryEntry {
  taskId: string;
  description: string;
  status: string;
  submittedAt: number;
  completedAt?: number;
}

interface TasksSlice {
  tasks: Map<string, TaskState>;
  taskHistory: TaskHistoryEntry[];
  activeTaskId: string | null;
  submitTask: (description: string, language: string) => void;
  updateTask: (id: string, update: Partial<TaskState>) => void;
  setActiveTask: (id: string | null) => void;
}

let taskCounter = 0;

export const useTasksStore = create<TasksSlice>((set) => ({
  tasks: new Map(),
  taskHistory: [],
  activeTaskId: null,

  submitTask: (description: string, language: string) =>
    set((state) => {
      const id = `task-${++taskCounter}-${Date.now()}`;
      const newTask: TaskState = {
        id,
        description,
        language,
        status: 'submitted',
        submittedAt: Date.now(),
      };
      const newTasks = new Map(state.tasks);
      newTasks.set(id, newTask);

      const historyEntry: TaskHistoryEntry = {
        taskId: id,
        description,
        status: 'submitted',
        submittedAt: newTask.submittedAt,
      };

      return {
        tasks: newTasks,
        taskHistory: [historyEntry, ...state.taskHistory],
        activeTaskId: id,
      };
    }),

  updateTask: (id: string, update: Partial<TaskState>) =>
    set((state) => {
      const newTasks = new Map(state.tasks);
      const existing = newTasks.get(id);
      if (!existing) return state;

      const updated = { ...existing, ...update };
      newTasks.set(id, updated);

      // Update history entry if status changed
      let newHistory = state.taskHistory;
      if (update.status) {
        newHistory = state.taskHistory.map((entry) =>
          entry.taskId === id
            ? {
                ...entry,
                status: update.status!,
                completedAt: ['completed', 'failed'].includes(update.status!)
                  ? Date.now()
                  : entry.completedAt,
              }
            : entry
        );
      }

      return { tasks: newTasks, taskHistory: newHistory };
    }),

  setActiveTask: (id: string | null) =>
    set({ activeTaskId: id }),
}));
