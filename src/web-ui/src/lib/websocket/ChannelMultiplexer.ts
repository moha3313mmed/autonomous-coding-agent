import type { WSChannel, WSMessage, MessageHandler } from './WebSocketManager';

/**
 * ChannelMultiplexer routes incoming WebSocket messages to the appropriate
 * channel handler based on the message's channel field.
 */
export class ChannelMultiplexer {
  private handlers: Map<WSChannel, MessageHandler> = new Map();

  /**
   * Register a handler for a specific channel.
   * Only one handler per channel is supported; registering again overwrites.
   */
  registerChannel(channel: WSChannel, handler: MessageHandler): void {
    this.handlers.set(channel, handler);
  }

  /**
   * Unregister the handler for a specific channel.
   */
  unregisterChannel(channel: WSChannel): void {
    this.handlers.delete(channel);
  }

  /**
   * Parse a raw JSON string into a WSMessage and route it to the correct
   * channel handler exclusively. If parsing fails or no handler is registered,
   * the message is silently dropped.
   */
  routeMessage(rawJson: string): void {
    let message: WSMessage;

    try {
      message = JSON.parse(rawJson) as WSMessage;
    } catch {
      // Invalid JSON — drop silently
      return;
    }

    if (!message || !message.channel) {
      return;
    }

    const handler = this.handlers.get(message.channel);
    if (handler) {
      handler(message);
    }
  }

  /**
   * Get a list of all currently active (registered) channels.
   */
  getActiveChannels(): WSChannel[] {
    return Array.from(this.handlers.keys());
  }
}
