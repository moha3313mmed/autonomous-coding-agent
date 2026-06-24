import { create } from 'zustand';

export type ViewName =
  | 'dashboard'
  | 'tasks'
  | 'dag'
  | 'agents'
  | 'performance'
  | 'skills'
  | 'memory'
  | 'timeline'
  | 'quality'
  | 'recovery'
  | 'feedback'
  | 'settings';

export interface Notification {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: number;
  viewLink?: ViewName;
  dismissed: boolean;
}

interface NavigationSlice {
  activeView: ViewName;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  notifications: Notification[];
  setActiveView: (view: ViewName) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

let notificationCounter = 0;

export const useNavigationStore = create<NavigationSlice>((set) => ({
  activeView: 'dashboard',
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  notifications: [],

  setActiveView: (view: ViewName) =>
    set({ activeView: view, mobileSidebarOpen: false }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setMobileSidebarOpen: (open: boolean) =>
    set({ mobileSidebarOpen: open }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: `notif-${++notificationCounter}-${Date.now()}`,
          timestamp: Date.now(),
          dismissed: false,
        },
      ],
    })),

  dismissNotification: (id: string) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
    })),

  clearNotifications: () =>
    set({ notifications: [] }),
}));
