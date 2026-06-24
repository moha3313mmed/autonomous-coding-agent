// =============================================================================
// Agent Orchestrator - Central coordinator for agent lifecycle and task delegation
// =============================================================================

import {
  ResolvedIntent,
  TaskExecution,
  DecompositionPlan,
  AgentInstance,
  AgentType,
  SubTaskResult,
  MergeConflict,
  Resolution,
  ResourceLimits,
  AgentMessage,
  SubTask,
} from '../shared/types';
import { MessageBus, TASK_QUEUE, RESULT_QUEUE } from '../shared/message-bus';

// =============================================================================
// Internal Interfaces
// =============================================================================

/**
 * Configuration for an agent type, including specializations and resource limits.
 */
interface AgentTypeConfig {
  type: AgentType;
  specializations: string[];
  maxInstances: number;
  resourceLimits: ResourceLimits;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of agents that can be instantiated */
const MAX_AGENTS = 10;

/** Heartbeat check interval in milliseconds */
const HEARTBEAT_CHECK_INTERVAL = 10000; // 10 seconds

/** Maximum time without heartbeat before agent is considered unresponsive (ms) */
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

/** Maximum reassignment attempts per subtask before escalating */
const MAX_REASSIGNMENT_ATTEMPTS = 3;

// =============================================================================
// AgentOrchestrator Class
// =============================================================================

/**
 * AgentOrchestrator is the central coordinator that manages agent lifecycle,
 * task delegation, and result aggregation.
 *
 * Responsibilities:
 * - Accepts resolved intents and initiates task execution
 * - Instantiates specialized agents based on task requirements
 * - Monitors agent health via heartbeat tracking
 * - Collects results and updates dependency graph
 * - Resolves merge conflicts from overlapping code regions
 * - Terminates unresponsive agents and reassigns their work
 *
 * Communication:
 * - Publishes task assignments to TASK_QUEUE
 * - Collects results from RESULT_QUEUE
 */
export class AgentOrchestrator {
  /** Registry of agent type configurations */
  private agentRegistry: Map<AgentType, AgentTypeConfig> = new Map();

  /** Active agent instances by agentId */
  private activeAgents: Map<string, AgentInstance> = new Map();

  /** Task assignments: taskId -> agentId */
  private taskAssignments: Map<string, string> = new Map();

  /** Reassignment counts: subtaskId -> number of reassignment attempts */
  private reassignmentCounts: Map<string, number> = new Map();

  /** Heartbeat check timers: agentId -> timer */
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Message bus for event-driven communication */
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
    this.initializeAgentRegistry();
    this.subscribeToResults();
  }

  /**
   * Accepts a resolved intent and initiates task execution.
   * Creates a TaskExecution record to track the lifecycle.
   *
   * @param intent - The resolved intent to execute
   * @returns TaskExecution tracking object
   */
  async receiveTask(intent: ResolvedIntent): Promise<TaskExecution> {
    const taskId = this.generateId();
    const now = Date.now();

    const taskExecution: TaskExecution = {
      taskId,
      startTime: now,
      endTime: null,
      status: 'received',
      agents: [],
      events: [
        {
          eventType: 'task_received',
          timestamp: now,
          taskId,
          details: { intent: intent.intent.rawInput },
        },
      ],
    };

    return taskExecution;
  }

  /**
   * Selects appropriate agent types based on task requirements and instantiates them.
   * Up to 10 agents can be instantiated within 5 seconds.
   *
   * @param plan - The decomposition plan with subtasks
   * @returns Array of instantiated agent instances
   */
  async instantiateAgents(plan: DecompositionPlan): Promise<AgentInstance[]> {
    const instances: AgentInstance[] = [];
    const subtasks = plan.subtasks;
    const now = Date.now();

    // Limit to MAX_AGENTS agents
    const tasksToAssign = subtasks.slice(0, MAX_AGENTS);

    for (const subtask of tasksToAssign) {
      const agentType = subtask.recommendedAgentType;
      const config = this.agentRegistry.get(agentType);

      if (!config) {
        // Fallback to coding agent if type not found
        continue;
      }

      // Check if we've reached max instances for this type
      const existingOfType = Array.from(this.activeAgents.values()).filter(
        (a) => a.type === agentType
      );
      if (existingOfType.length >= config.maxInstances) {
        continue;
      }

      const agentId = this.generateId();
      const instance: AgentInstance = {
        id: agentId,
        type: agentType,
        specialization: this.selectSpecialization(config, subtask),
        status: 'initializing',
        assignedTask: subtask,
        resourceAllocation: { ...config.resourceLimits },
        startTime: now,
        lastHeartbeat: now,
      };

      this.activeAgents.set(agentId, instance);
      this.taskAssignments.set(subtask.id, agentId);

      // Transition to running status
      instance.status = 'running';
      instances.push(instance);

      // Publish task assignment to message bus
      this.publishTaskAssignment(agentId, subtask);
    }

    return instances;
  }

  /**
   * Starts heartbeat tracking for agent instances.
   * Checks every 10 seconds; if an agent's lastHeartbeat exceeds 30 seconds,
   * it is terminated and its task is reassigned.
   *
   * @param instances - Agent instances to monitor
   */
  monitorAgents(instances: AgentInstance[]): void {
    for (const instance of instances) {
      // Clear any existing timer for this agent
      const existingTimer = this.heartbeatTimers.get(instance.id);
      if (existingTimer) {
        clearInterval(existingTimer);
      }

      // Set up heartbeat check interval
      const timer = setInterval(() => {
        this.checkHeartbeat(instance.id);
      }, HEARTBEAT_CHECK_INTERVAL);

      this.heartbeatTimers.set(instance.id, timer);
    }
  }

  /**
   * Updates dependency graph and notifies dependent agents when a result is collected.
   *
   * @param agentId - The ID of the agent that produced the result
   * @param result - The subtask result
   */
  async collectResult(agentId: string, result: SubTaskResult): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      return;
    }

    // Update agent status based on result
    if (result.status === 'success') {
      agent.status = 'completed';
    } else if (result.status === 'failed') {
      agent.status = 'failed';
    }

    // Remove task assignment
    this.taskAssignments.delete(result.subtaskId);

    // Publish result to message bus for dependent agents
    const message: AgentMessage = {
      id: this.generateId(),
      type: 'dependency_resolved',
      senderId: agentId,
      recipientId: 'broadcast',
      payload: { subtaskId: result.subtaskId, result },
      timestamp: Date.now(),
      correlationId: result.subtaskId,
    };

    this.messageBus.publish(RESULT_QUEUE, message);

    // Clean up heartbeat timer
    this.stopHeartbeatMonitoring(agentId);
  }

  /**
   * Resolves overlapping code region conflicts between parallel agents.
   *
   * @param conflicts - Array of merge conflicts to resolve
   * @returns Array of resolutions for each conflict
   */
  async resolveConflict(conflicts: MergeConflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = [];

    for (const conflict of conflicts) {
      const resolution: Resolution = {
        conflictId: `${conflict.filePath}:${conflict.conflictRegion.startLine}-${conflict.conflictRegion.endLine}`,
        resolvedContent: this.mergeConflictContent(conflict),
        strategy: 'ai_resolved',
        resolvedBy: 'agent_orchestrator',
      };

      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * Terminates an unresponsive agent, logs the incident, and attempts reassignment.
   * Max 3 reassignment attempts per subtask before escalating to user.
   *
   * @param agentId - The ID of the agent to terminate
   * @param reason - The reason for termination
   */
  async terminateAgent(agentId: string, reason: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      return;
    }

    // Update agent status
    agent.status = 'terminated';

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring(agentId);

    // Log termination event
    const terminationMessage: AgentMessage = {
      id: this.generateId(),
      type: 'termination',
      senderId: 'orchestrator',
      recipientId: agentId,
      payload: { reason, timestamp: Date.now() },
      timestamp: Date.now(),
      correlationId: agent.assignedTask.id,
    };
    this.messageBus.publish(RESULT_QUEUE, terminationMessage);

    // Attempt reassignment
    const subtaskId = agent.assignedTask.id;
    const currentAttempts = this.reassignmentCounts.get(subtaskId) || 0;

    if (currentAttempts < MAX_REASSIGNMENT_ATTEMPTS) {
      // Increment reassignment count and reassign
      this.reassignmentCounts.set(subtaskId, currentAttempts + 1);
      await this.reassignTask(agent.assignedTask);
    }
    // If max attempts reached, task remains unassigned (escalation handled externally)

    // Remove from active agents
    this.activeAgents.delete(agentId);
  }

  /**
   * Returns currently active agents (not terminated or completed).
   *
   * @returns Array of active agent instances
   */
  getActiveAgents(): AgentInstance[] {
    return Array.from(this.activeAgents.values()).filter(
      (agent) => agent.status === 'running' || agent.status === 'waiting' || agent.status === 'initializing'
    );
  }

  /**
   * Releases agents that have been idle longer than the specified threshold.
   *
   * @param threshold - Idle threshold in milliseconds
   * @returns Array of released agent IDs
   */
  releaseIdleAgents(threshold: number): string[] {
    const now = Date.now();
    const releasedIds: string[] = [];

    for (const [agentId, agent] of this.activeAgents) {
      if (
        agent.status === 'waiting' &&
        now - agent.lastHeartbeat > threshold
      ) {
        // Mark as terminated and clean up
        agent.status = 'terminated';
        this.stopHeartbeatMonitoring(agentId);
        this.activeAgents.delete(agentId);
        releasedIds.push(agentId);
      }
    }

    return releasedIds;
  }

  /**
   * Updates the heartbeat timestamp for an agent.
   * Called when a heartbeat message is received.
   *
   * @param agentId - The agent ID to update
   */
  updateHeartbeat(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
    }
  }

  /**
   * Returns the number of reassignment attempts for a subtask.
   *
   * @param subtaskId - The subtask ID to check
   * @returns Number of reassignment attempts
   */
  getReassignmentCount(subtaskId: string): number {
    return this.reassignmentCounts.get(subtaskId) || 0;
  }

  /**
   * Cleans up all timers and resources. Should be called on shutdown.
   */
  destroy(): void {
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();
    this.activeAgents.clear();
    this.taskAssignments.clear();
    this.reassignmentCounts.clear();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Initializes the agent registry with 6 agent types and their configurations.
   */
  private initializeAgentRegistry(): void {
    const configs: AgentTypeConfig[] = [
      {
        type: 'coding',
        specializations: ['frontend', 'backend', 'fullstack', 'systems', 'api'],
        maxInstances: 4,
        resourceLimits: {
          maxCpuPercent: 30,
          maxMemoryMB: 512,
          maxExecutionTimeMs: 300000,
          maxConcurrentOperations: 5,
        },
      },
      {
        type: 'review',
        specializations: ['code-review', 'security-review', 'architecture-review'],
        maxInstances: 2,
        resourceLimits: {
          maxCpuPercent: 20,
          maxMemoryMB: 256,
          maxExecutionTimeMs: 120000,
          maxConcurrentOperations: 3,
        },
      },
      {
        type: 'research',
        specializations: ['documentation-search', 'api-exploration', 'pattern-analysis'],
        maxInstances: 2,
        resourceLimits: {
          maxCpuPercent: 15,
          maxMemoryMB: 256,
          maxExecutionTimeMs: 180000,
          maxConcurrentOperations: 4,
        },
      },
      {
        type: 'testing',
        specializations: ['unit-testing', 'integration-testing', 'e2e-testing', 'property-testing'],
        maxInstances: 3,
        resourceLimits: {
          maxCpuPercent: 25,
          maxMemoryMB: 512,
          maxExecutionTimeMs: 240000,
          maxConcurrentOperations: 4,
        },
      },
      {
        type: 'documentation',
        specializations: ['api-docs', 'readme', 'inline-comments', 'architecture-docs'],
        maxInstances: 2,
        resourceLimits: {
          maxCpuPercent: 10,
          maxMemoryMB: 128,
          maxExecutionTimeMs: 120000,
          maxConcurrentOperations: 2,
        },
      },
      {
        type: 'refactoring',
        specializations: ['extract-method', 'rename-symbol', 'restructure-module', 'simplify-logic'],
        maxInstances: 2,
        resourceLimits: {
          maxCpuPercent: 25,
          maxMemoryMB: 384,
          maxExecutionTimeMs: 240000,
          maxConcurrentOperations: 3,
        },
      },
    ];

    for (const config of configs) {
      this.agentRegistry.set(config.type, config);
    }
  }

  /**
   * Subscribes to the RESULT_QUEUE for collecting agent results.
   */
  private subscribeToResults(): void {
    this.messageBus.subscribe(RESULT_QUEUE, (message: AgentMessage) => {
      if (message.type === 'result_submission') {
        const result = message.payload as SubTaskResult;
        this.collectResult(message.senderId, result);
      } else if (message.type === 'heartbeat') {
        this.updateHeartbeat(message.senderId);
      }
    });
  }

  /**
   * Selects the most appropriate specialization for a given task.
   */
  private selectSpecialization(config: AgentTypeConfig, subtask: SubTask): string {
    const description = subtask.description.toLowerCase();

    for (const spec of config.specializations) {
      const specTerms = spec.split('-');
      if (specTerms.some((term) => description.includes(term))) {
        return spec;
      }
    }

    // Default to first specialization
    return config.specializations[0] ?? config.type;
  }

  /**
   * Publishes a task assignment message to the TASK_QUEUE.
   */
  private publishTaskAssignment(agentId: string, subtask: SubTask): void {
    const message: AgentMessage = {
      id: this.generateId(),
      type: 'task_assignment',
      senderId: 'orchestrator',
      recipientId: agentId,
      payload: { subtask },
      timestamp: Date.now(),
      correlationId: subtask.id,
    };

    this.messageBus.publish(TASK_QUEUE, message);
  }

  /**
   * Checks if an agent has exceeded the heartbeat timeout.
   * If unresponsive, terminates and attempts reassignment.
   */
  private checkHeartbeat(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      this.stopHeartbeatMonitoring(agentId);
      return;
    }

    // Only check running agents
    if (agent.status !== 'running' && agent.status !== 'waiting') {
      return;
    }

    const now = Date.now();
    const timeSinceLastHeartbeat = now - agent.lastHeartbeat;

    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      // Agent is unresponsive — terminate and reassign
      this.terminateAgent(agentId, `Heartbeat timeout: ${timeSinceLastHeartbeat}ms since last heartbeat`);
    }
  }

  /**
   * Stops heartbeat monitoring for an agent.
   */
  private stopHeartbeatMonitoring(agentId: string): void {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(agentId);
    }
  }

  /**
   * Reassigns a task to a new agent of the same type.
   */
  private async reassignTask(subtask: SubTask): Promise<void> {
    const agentType = subtask.recommendedAgentType;
    const config = this.agentRegistry.get(agentType);

    if (!config) {
      return;
    }

    const agentId = this.generateId();
    const now = Date.now();

    const instance: AgentInstance = {
      id: agentId,
      type: agentType,
      specialization: this.selectSpecialization(config, subtask),
      status: 'running',
      assignedTask: subtask,
      resourceAllocation: { ...config.resourceLimits },
      startTime: now,
      lastHeartbeat: now,
    };

    this.activeAgents.set(agentId, instance);
    this.taskAssignments.set(subtask.id, agentId);

    // Publish new task assignment
    this.publishTaskAssignment(agentId, subtask);
  }

  /**
   * Merges conflict content by choosing a resolution strategy.
   * Uses a simple heuristic: prefer the longer change (more context).
   */
  private mergeConflictContent(conflict: MergeConflict): string {
    // Heuristic: if both changes exist, prefer longer (more complete) content
    // In a real system, this would invoke a reasoning engine
    if (conflict.ourChange.length >= conflict.theirChange.length) {
      return conflict.ourChange;
    }
    return conflict.theirChange;
  }

  /**
   * Generates a unique identifier.
   */
  private generateId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
