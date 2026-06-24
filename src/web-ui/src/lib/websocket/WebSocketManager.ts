import { ReconnectionEngine } from './ReconnectionEngine';
import { ChannelMultiplexer } from './ChannelMultiplexer';

export type WSChannel = 'agents' | 'tasks' | 'metrics' | 'alerts' | 'dag' | 'control';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export type MessageHandler = (message: WSMessage) => void;
export type Unsubscribe = () => void;

export interface WSMessage {
  id: string;
  channel: WSChannel;
  type: string;
  payload: unknown;
  timestamp: number;
  correlationId?: string;
}

const CONNECTION_TIMEOUT_MS = 3000;
const SNAPSHOT_TIMEOUT_MS = 5000;
const SNAPSHOT_MAX_RETRIES = 3;

/**
 * WebSocketManager manages the full lifecycle of a WebSocket connection including:
 * - Connection with timeout
 * - Automatic reconnection with exponential backoff
 * - Channel-based message subscription and routing
 * - State synchronization on reconnect (snapshot request/response)
 * - Missed event queuing and replay
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string = '';
  private status: ConnectionStatus = 'disconnected';
  private channelHandlers: Map<WSChannel, Set<MessageHandler>> = new Map();
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectionEngine: ReconnectionEngine;
  private multiplexer: ChannelMultiplexer;
  private missedEvents: WSMessage[] = [];
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private snapshotTimeout: ReturnType<typeof setTimeout> | null = null;
  private snapshotRetryCount: number = 0;
  private awaitingSnapshot: boolean = false;
  private isReconnect: boolean = false;

  constructor() {
    this.reconnectionEngine = new ReconnectionEngine(() => this.attemptReconnect());
    this.multiplexer = new ChannelMultiplexer();

    // Register the internal control channel handler for snapshot responses
    this.multiplexer.registerChannel('control', (message: WSMessage) => {
      this.handleControlMessage(message);
    });
  }

  /**
   * Connect to the WebSocket server at the given URL.
   * Times out after 3 seconds if connection cannot be established.
   */
  connect(url: string): void {
    if (this.status === 'connecting' || this.status === 'connected') {
      return;
    }

    this.url = url;
    this.isReconnect = false;
    this.setStatus('connecting');
    this.createWebSocket();
  }

  /**
   * Gracefully disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.reconnectionEngine.stop();
    this.clearConnectionTimeout();
    this.clearSnapshotTimeout();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Subscribe to messages on a specific channel.
   * Returns an unsubscribe function.
   */
  subscribe(channel: WSChannel, handler: MessageHandler): Unsubscribe {
    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
    }

    const handlers = this.channelHandlers.get(channel)!;
    handlers.add(handler);

    // Register with multiplexer if this is the first handler for this channel
    // (control channel is handled internally)
    if (channel !== 'control') {
      this.multiplexer.registerChannel(channel, (message: WSMessage) => {
        this.dispatchToSubscribers(channel, message);
      });
    }

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.channelHandlers.delete(channel);
        if (channel !== 'control') {
          this.multiplexer.unregisterChannel(channel);
        }
      }
    };
  }

  /**
   * Send a message on a specific channel.
   */
  send(channel: WSChannel, type: string, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WSMessage = {
      id: this.generateId(),
      channel,
      type,
      payload,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Get the current connection status.
   */
  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Register a handler to be notified of connection status changes.
   * Returns an unsubscribe function.
   */
  onStatusChange(handler: (status: ConnectionStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /**
   * Get the list of missed events queued during disconnection.
   */
  getMissedEvents(): WSMessage[] {
    return [...this.missedEvents];
  }

  /**
   * Clear the missed events queue.
   */
  clearMissedEvents(): void {
    this.missedEvents = [];
  }

  // --- Private Methods ---

  private createWebSocket(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setStatus('disconnected');
      this.startReconnection();
      return;
    }

    // Set connection timeout
    this.connectionTimeout = setTimeout(() => {
      if (this.status === 'connecting') {
        this.ws?.close();
        this.setStatus('disconnected');
        this.startReconnection();
      }
    }, CONNECTION_TIMEOUT_MS);

    this.ws.onopen = () => {
      this.clearConnectionTimeout();
      this.reconnectionEngine.reset();
      this.setStatus('connected');

      if (this.isReconnect) {
        this.requestSnapshot();
      }
    };

    this.ws.onclose = () => {
      this.clearConnectionTimeout();
      if (this.status !== 'disconnected') {
        this.setStatus('disconnected');
        this.startReconnection();
      }
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose, so we handle cleanup there
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const rawData = typeof event.data === 'string' ? event.data : '';
      if (!rawData) return;

      // If we're awaiting a snapshot, queue non-control messages
      if (this.awaitingSnapshot) {
        try {
          const parsed = JSON.parse(rawData) as WSMessage;
          if (parsed.channel !== 'control') {
            this.missedEvents.push(parsed);
            return;
          }
        } catch {
          return;
        }
      }

      this.multiplexer.routeMessage(rawData);
    };
  }

  private attemptReconnect(): void {
    if (this.status === 'connected') {
      this.reconnectionEngine.stop();
      return;
    }

    this.isReconnect = true;
    this.setStatus('reconnecting');
    this.createWebSocket();
  }

  private startReconnection(): void {
    this.isReconnect = true;
    this.setStatus('reconnecting');
    this.reconnectionEngine.start();
  }

  private requestSnapshot(): void {
    this.awaitingSnapshot = true;
    this.snapshotRetryCount = 0;
    this.sendSnapshotRequest();
  }

  private sendSnapshotRequest(): void {
    this.send('control', 'snapshot_request', {});

    this.clearSnapshotTimeout();
    this.snapshotTimeout = setTimeout(() => {
      this.snapshotRetryCount++;
      if (this.snapshotRetryCount < SNAPSHOT_MAX_RETRIES) {
        this.sendSnapshotRequest();
      } else {
        // Give up waiting for snapshot, resume normal operation
        this.awaitingSnapshot = false;
        this.replayMissedEvents();
      }
    }, SNAPSHOT_TIMEOUT_MS);
  }

  private handleControlMessage(message: WSMessage): void {
    if (message.type === 'snapshot_response') {
      this.clearSnapshotTimeout();
      this.awaitingSnapshot = false;

      // Dispatch the snapshot to control channel subscribers
      this.dispatchToSubscribers('control', message);

      // Replay missed events after hydration
      this.replayMissedEvents();
    } else {
      // Dispatch other control messages to subscribers
      this.dispatchToSubscribers('control', message);
    }
  }

  private replayMissedEvents(): void {
    const events = [...this.missedEvents];
    this.missedEvents = [];

    for (const event of events) {
      this.dispatchToSubscribers(event.channel, event);
    }
  }

  private dispatchToSubscribers(channel: WSChannel, message: WSMessage): void {
    const handlers = this.channelHandlers.get(channel);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusHandlers.forEach((handler) => handler(newStatus));
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private clearSnapshotTimeout(): void {
    if (this.snapshotTimeout !== null) {
      clearTimeout(this.snapshotTimeout);
      this.snapshotTimeout = null;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
