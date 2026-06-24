import { describe, it, expect } from 'vitest';
import { MessageBus, TASK_QUEUE, RESULT_QUEUE, EVENT_STREAM } from './message-bus';
import { AgentMessage } from './types';

// Helper function to generate test AgentMessage objects
function createTestMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: overrides.id ?? 'msg-1',
    type: overrides.type ?? 'task_assignment',
    senderId: overrides.senderId ?? 'agent-1',
    recipientId: overrides.recipientId ?? 'agent-2',
    payload: overrides.payload ?? { data: 'test' },
    timestamp: overrides.timestamp ?? Date.now(),
    correlationId: overrides.correlationId ?? 'corr-1',
  };
}

describe('MessageBus', () => {
  describe('Publish/subscribe routing', () => {
    it('should deliver published messages to subscribers on the same channel', () => {
      const bus = new MessageBus();
      const received: AgentMessage[] = [];
      const message = createTestMessage();

      bus.subscribe(TASK_QUEUE, (msg) => received.push(msg));
      bus.publish(TASK_QUEUE, message);

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(message);
    });

    it('should not deliver messages to subscribers on different channels', () => {
      const bus = new MessageBus();
      const received: AgentMessage[] = [];
      const message = createTestMessage();

      bus.subscribe(RESULT_QUEUE, (msg) => received.push(msg));
      bus.publish(TASK_QUEUE, message);

      expect(received).toHaveLength(0);
    });
  });

  describe('Broadcast delivery', () => {
    it('should deliver broadcast messages to all subscribers on all channels', () => {
      const bus = new MessageBus();
      const taskReceived: AgentMessage[] = [];
      const resultReceived: AgentMessage[] = [];
      const eventReceived: AgentMessage[] = [];
      const message = createTestMessage();

      bus.subscribe(TASK_QUEUE, (msg) => taskReceived.push(msg));
      bus.subscribe(RESULT_QUEUE, (msg) => resultReceived.push(msg));
      bus.subscribe(EVENT_STREAM, (msg) => eventReceived.push(msg));

      bus.broadcast(message);

      expect(taskReceived).toHaveLength(1);
      expect(taskReceived[0]).toBe(message);
      expect(resultReceived).toHaveLength(1);
      expect(resultReceived[0]).toBe(message);
      expect(eventReceived).toHaveLength(1);
      expect(eventReceived[0]).toBe(message);
    });
  });

  describe('Message correlation tracking', () => {
    it('should filter messages correctly by correlationId', () => {
      const bus = new MessageBus();
      const msg1 = createTestMessage({ id: 'msg-1', correlationId: 'corr-A' });
      const msg2 = createTestMessage({ id: 'msg-2', correlationId: 'corr-B' });
      const msg3 = createTestMessage({ id: 'msg-3', correlationId: 'corr-A' });

      bus.publish(TASK_QUEUE, msg1);
      bus.publish(TASK_QUEUE, msg2);
      bus.publish(RESULT_QUEUE, msg3);

      const correlated = bus.getCorrelatedMessages('corr-A');

      expect(correlated).toHaveLength(2);
      expect(correlated[0].id).toBe('msg-1');
      expect(correlated[1].id).toBe('msg-3');
    });

    it('should return an empty array when no messages match the correlationId', () => {
      const bus = new MessageBus();
      const msg = createTestMessage({ correlationId: 'corr-X' });

      bus.publish(TASK_QUEUE, msg);

      const correlated = bus.getCorrelatedMessages('non-existent');
      expect(correlated).toHaveLength(0);
    });
  });

  describe('Message ordering', () => {
    it('should log messages in the order they are published', () => {
      const bus = new MessageBus();
      const msg1 = createTestMessage({ id: 'msg-1', timestamp: 100 });
      const msg2 = createTestMessage({ id: 'msg-2', timestamp: 200 });
      const msg3 = createTestMessage({ id: 'msg-3', timestamp: 300 });

      bus.publish(TASK_QUEUE, msg1);
      bus.publish(RESULT_QUEUE, msg2);
      bus.broadcast(msg3);

      const log = bus.getMessageLog();

      expect(log).toHaveLength(3);
      expect(log[0].id).toBe('msg-1');
      expect(log[1].id).toBe('msg-2');
      expect(log[2].id).toBe('msg-3');
    });
  });

  describe('Unsubscribe', () => {
    it('should remove the handler so it no longer receives messages', () => {
      const bus = new MessageBus();
      const received: AgentMessage[] = [];

      const unsubscribe = bus.subscribe(TASK_QUEUE, (msg) => received.push(msg));

      bus.publish(TASK_QUEUE, createTestMessage({ id: 'msg-1' }));
      expect(received).toHaveLength(1);

      unsubscribe();

      bus.publish(TASK_QUEUE, createTestMessage({ id: 'msg-2' }));
      expect(received).toHaveLength(1);
    });
  });

  describe('Multiple subscribers', () => {
    it('should deliver messages to all subscribers on the same channel', () => {
      const bus = new MessageBus();
      const received1: AgentMessage[] = [];
      const received2: AgentMessage[] = [];
      const received3: AgentMessage[] = [];
      const message = createTestMessage();

      bus.subscribe(TASK_QUEUE, (msg) => received1.push(msg));
      bus.subscribe(TASK_QUEUE, (msg) => received2.push(msg));
      bus.subscribe(TASK_QUEUE, (msg) => received3.push(msg));

      bus.publish(TASK_QUEUE, message);

      expect(received1).toHaveLength(1);
      expect(received1[0]).toBe(message);
      expect(received2).toHaveLength(1);
      expect(received2[0]).toBe(message);
      expect(received3).toHaveLength(1);
      expect(received3[0]).toBe(message);
    });
  });

  describe('No subscribers', () => {
    it('should not throw when publishing to a channel with no subscribers', () => {
      const bus = new MessageBus();
      const message = createTestMessage();

      expect(() => bus.publish(TASK_QUEUE, message)).not.toThrow();
    });

    it('should still log the message even when there are no subscribers', () => {
      const bus = new MessageBus();
      const message = createTestMessage();

      bus.publish(TASK_QUEUE, message);

      const log = bus.getMessageLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toBe(message);
    });
  });
});
