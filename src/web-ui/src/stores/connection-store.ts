import { create } from 'zustand';
import type { ConnectionStatus, WSMessage } from '../lib/websocket/WebSocketManager';

export interface ConnectionSlice {
  status: ConnectionStatus;
  lastConnected: number | null;
  reconnectAttempt: number;
  missedEvents: WSMessage[];
  setStatus: (status: ConnectionStatus) => void;
  setReconnectAttempt: (attempt: number) => void;
  queueMissedEvent: (event: WSMessage) => void;
  replayMissedEvents: () => WSMessage[];
}

export const useConnectionStore = create<ConnectionSlice>((set, get) => ({
  status: 'disconnected',
  lastConnected: null,
  reconnectAttempt: 0,
  missedEvents: [],

  setStatus: (status: ConnectionStatus) =>
    set((state) => ({
      status,
      lastConnected: status === 'connected' ? Date.now() : state.lastConnected,
      reconnectAttempt: status === 'connected' ? 0 : state.reconnectAttempt,
    })),

  setReconnectAttempt: (attempt: number) =>
    set({ reconnectAttempt: attempt }),

  queueMissedEvent: (event: WSMessage) =>
    set((state) => ({
      missedEvents: [...state.missedEvents, event],
    })),

  replayMissedEvents: () => {
    const events = get().missedEvents;
    set({ missedEvents: [] });
    return events;
  },
}));
