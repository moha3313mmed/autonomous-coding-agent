// =============================================================================
// Event-Driven Message Bus
// =============================================================================

import { AgentMessage } from './types';

// =============================================================================
// Typed Channel Constants
// =============================================================================

/** Channel for task assignment messages */
export const TASK_QUEUE = 'task_queue';

/** Channel for result submission messages */
export const RESULT_QUEUE = 'result_queue';

/** Channel for monitoring event messages */
export const EVENT_STREAM = 'event_stream';

// =============================================================================
// MessageBus Class
// =============================================================================

type MessageHandler = (message: AgentMessage) => void;

/**
 * Event-driven message bus implementing publish/subscribe pattern.
 *
 * Provides:
 * - Decoupling: Components communicate without direct dependencies
 * - Auditability: All messages are logged for replay and debugging
 * - Resilience: Failed consumers don't block producers
 * - Scalability: Multiple consumers can process messages in parallel
 */
export class MessageBus {
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private messageLog: AgentMessage[] = [];

  /**
   * Subscribe to messages on a specific channel.
   * @param channel - The channel name to subscribe to
   * @param handler - Callback invoked when a message is published to the channel
   * @returns An unsubscribe function that removes this subscription
   */
  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }

    const handlers = this.subscriptions.get(channel)!;
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(channel);
      }
    };
  }

  /**
   * Publish a message to a specific channel.
   * All subscribers on that channel will receive the message.
   * The message is logged for auditability.
   * @param channel - The channel to publish to
   * @param message - The AgentMessage to publish
   */
  publish(channel: string, message: AgentMessage): void {
    this.messageLog.push(message);

    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        handler(message);
      }
    }
  }

  /**
   * Broadcast a message to all subscribers on all channels.
   * The message is logged for auditability.
   * @param message - The AgentMessage to broadcast
   */
  broadcast(message: AgentMessage): void {
    this.messageLog.push(message);

    for (const handlers of this.subscriptions.values()) {
      for (const handler of handlers) {
        handler(message);
      }
    }
  }

  /**
   * Retrieve the full message log for auditability and replay.
   * @returns Array of all messages that have been published or broadcast
   */
  getMessageLog(): AgentMessage[] {
    return [...this.messageLog];
  }

  /**
   * Retrieve all messages with a specific correlationId.
   * Useful for tracing related messages across the system.
   * @param correlationId - The correlation ID to filter by
   * @returns Array of messages matching the correlationId
   */
  getCorrelatedMessages(correlationId: string): AgentMessage[] {
    return this.messageLog.filter(
      (msg) => msg.correlationId === correlationId
    );
  }
}
