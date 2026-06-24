// =============================================================================
// Autonomous Coding Agent - Main Entry Point
// =============================================================================
// Wires all components through the event-driven message bus and exposes
// the AutonomousCodingAgent facade for end-to-end task execution.
// =============================================================================

import { MessageBus, EVENT_STREAM } from './shared/message-bus';
import { MemoryStore } from './infrastructure/memory-store';
import { VersionController } from './infrastructure/version-controller';
import { PerformanceMonitor } from './infrastructure/performance-monitor';
import { RecoveryManager } from './infrastructure/recovery-manager';
import { SkillEngine } from './execution/skill-engine';
import { ToolRegistry } from './execution/tool-registry';
import { QualityAssurer } from './execution/quality-assurer';
import { FeedbackLoop } from './execution/feedback-loop';
import { TaskDecomposer } from './orchestration/task-decomposer';
import { DAGScheduler } from './orchestration/dag-scheduler';
import { AgentOrchestrator } from './orchestration/agent-orchestrator';
import { NLUProcessor } from './interface/nlu-processor';
import { ReasoningEngine } from './interface/reasoning-engine';
import {
  TaskResult,
  AgentMessage,
  SubTaskResult,
  ExecutionMetrics,
  RuntimeError,
  ExecutionContext,
  DegradationAlert,
  UserCorrection,
  ReviewResult,
} from './shared/types';

// =============================================================================
// System Status Interface
// =============================================================================

/** Overall system health and status information */
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeAgents: number;
  idleAgents: number;
  tasksCompleted: number;
  tasksFailed: number;
  memoryUsage: number;
  uptime: number;
  degradationAlerts: DegradationAlert[];
}

// =============================================================================
// Task Pipeline State Machine
// =============================================================================

type PipelineState = 'idle' | 'received' | 'parsing' | 'decomposing' | 'scheduling' | 'executing' | 'reviewing' | 'completed' | 'failed';

// =============================================================================
// AutonomousCodingAgent Facade
// =============================================================================

/**
 * AutonomousCodingAgent is the top-level facade that orchestrates the full
 * task execution pipeline:
 *
 * 1. NLU_Processor parses natural language input into structured intent
 * 2. Agent_Orchestrator receives the resolved intent
 * 3. Task_Decomposer breaks it into subtasks with dependency DAG
 * 4. DAG_Scheduler produces execution waves for parallel processing
 * 5. Agent pool executes subtasks (simulated via orchestrator)
 * 6. Quality_Assurer gates completion with code review
 * 7. Version_Controller creates checkpoints and commits
 *
 * Cross-cutting concerns:
 * - Recovery_Manager monitors agent pool for failures
 * - Performance_Monitor tracks all task executions
 * - Feedback_Loop captures corrections and drives Skill_Engine updates
 */
export class AutonomousCodingAgent {
  // Infrastructure Layer
  readonly messageBus: MessageBus;
  readonly memoryStore: MemoryStore;
  readonly versionController: VersionController;
  readonly performanceMonitor: PerformanceMonitor;
  readonly recoveryManager: RecoveryManager;

  // Execution Layer
  readonly skillEngine: SkillEngine;
  readonly toolRegistry: ToolRegistry;
  readonly qualityAssurer: QualityAssurer;
  readonly feedbackLoop: FeedbackLoop;

  // Orchestration Layer
  readonly taskDecomposer: TaskDecomposer;
  readonly dagScheduler: DAGScheduler;
  readonly agentOrchestrator: AgentOrchestrator;

  // Interface Layer
  readonly nluProcessor: NLUProcessor;
  readonly reasoningEngine: ReasoningEngine;

  // Internal state
  private pipelineState: PipelineState = 'idle';
  private startTime: number;
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private degradationAlerts: DegradationAlert[] = [];
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private degradationCheckInterval: ReturnType<typeof setInterval> | null = null;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    this.startTime = Date.now();

    // Instantiate Infrastructure Layer
    this.messageBus = new MessageBus();
    this.memoryStore = new MemoryStore();
    this.versionController = new VersionController();
    this.performanceMonitor = new PerformanceMonitor();
    this.recoveryManager = new RecoveryManager();

    // Instantiate Execution Layer
    this.skillEngine = new SkillEngine();
    this.toolRegistry = new ToolRegistry();
    this.qualityAssurer = new QualityAssurer();
    this.feedbackLoop = new FeedbackLoop();

    // Instantiate Orchestration Layer (AgentOrchestrator takes MessageBus)
    this.taskDecomposer = new TaskDecomposer();
    this.dagScheduler = new DAGScheduler();
    this.agentOrchestrator = new AgentOrchestrator(this.messageBus);

    // Instantiate Interface Layer
    this.nluProcessor = new NLUProcessor();
    this.reasoningEngine = new ReasoningEngine();

    // Wire components through the message bus (Task 9.1)
    this.wireMessageBus();

    // Wire cross-cutting concerns (Task 9.3)
    this.wireCrossCuttingConcerns();
  }

  /**
   * Full pipeline: NLU → decompose → schedule → execute → review
   * Implements the task execution state machine:
   * received → parsing → decomposing → scheduling → executing → reviewing → completed
   *
   * @param input - Natural language task description
   * @returns TaskResult with aggregated subtask results, code changes, and quality report
   */
  async processTask(input: string): Promise<TaskResult> {
    const taskStartTime = Date.now();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      // === State: received ===
      this.pipelineState = 'received';
      this.emitEvent('task_received', taskId, { input });

      // === State: parsing (NLU) ===
      this.pipelineState = 'parsing';
      this.emitEvent('task_parsing', taskId, {});

      const structuredIntent = await this.nluProcessor.parseInstruction(input);
      const resolvedIntent = await this.nluProcessor.resolveReferences(
        structuredIntent,
        this.memoryStore
      );

      // === Version_Controller: create checkpoint at task start ===
      const affectedFiles = structuredIntent.targetScope.files;
      await this.versionController.createCheckpoint(taskId, affectedFiles);

      // === State: decomposing ===
      this.pipelineState = 'decomposing';
      this.emitEvent('task_decomposing', taskId, {});

      const projectContext = await this.memoryStore.getProjectContext('default');
      const mockProjectContext = projectContext || {
        projectId: 'default',
        structure: { path: '/', name: 'root', type: 'directory' as const, children: [] },
        dependencies: { nodes: new Map(), edges: [], topologicalOrder: [], criticalPath: [], parallelGroups: [] },
        codingStandards: { namingConventions: {}, documentationRequirements: [], architecturalPatterns: [], lintRules: {}, maxComplexity: 10 },
        recentChanges: [],
        activeAgents: [],
        userPreferences: { preferredLanguages: [], codingStyle: '', verbosityLevel: 'standard' as const, autoApprove: false, customRules: [] },
      };

      const decompositionPlan = await this.taskDecomposer.decompose(
        resolvedIntent,
        mockProjectContext
      );

      // === State: scheduling ===
      this.pipelineState = 'scheduling';
      this.emitEvent('task_scheduling', taskId, {});

      const executionPlan = this.dagScheduler.schedule(decompositionPlan.dependencyGraph);

      // === State: executing (Agent Pool) ===
      this.pipelineState = 'executing';
      this.emitEvent('task_executing', taskId, {});

      // Instantiate agents for the plan
      await this.agentOrchestrator.instantiateAgents(decompositionPlan);

      // Simulate agent execution: process each wave of tasks
      const subtaskResults: SubTaskResult[] = [];
      for (const wave of executionPlan.waves) {
        const waveResults = await this.executeWave(wave.tasks, taskId);
        subtaskResults.push(...waveResults);
      }

      // Aggregate results back through orchestrator
      for (const result of subtaskResults) {
        const agentId = result.agentId || 'system';
        await this.agentOrchestrator.collectResult(agentId, result);
      }

      // === State: reviewing (QA Gate) ===
      this.pipelineState = 'reviewing';
      this.emitEvent('task_reviewing', taskId, {});

      const qualityReport = await this.runQualityGate(taskId, subtaskResults);

      // If QA fails, we record but still return (rework would be triggered externally)
      if (!qualityReport.passed) {
        this.emitEvent('qa_failed', taskId, { issues: qualityReport.issues.length });
      }

      // === Version_Controller: commit at completion ===
      const codeChanges = subtaskResults
        .filter(r => r.status === 'success')
        .map(r => ({
          filePath: `src/${r.subtaskId}.ts`,
          changeType: 'modify' as const,
          diff: '',
          agentId: r.agentId,
          taskId,
        }));

      if (codeChanges.length > 0) {
        await this.versionController.commitChanges(
          taskId,
          codeChanges,
          `Completed task: ${input.substring(0, 80)}`
        );
      }

      // === State: completed ===
      this.pipelineState = 'completed';
      this.tasksCompleted++;

      // Record execution metrics for performance monitoring
      const executionTime = Date.now() - taskStartTime;
      await this.recordTaskMetrics(taskId, executionTime, true);

      // Store in memory for future reference
      await this.memoryStore.store({
        id: `mem_${taskId}`,
        namespace: 'lessons',
        content: `Task "${input}" completed in ${executionTime}ms with ${subtaskResults.length} subtasks`,
        embedding: [],
        metadata: { taskId, tags: ['completed'], outcome: 'success' },
        relevanceScore: 0.8,
        accessCount: 0,
        lastAccessed: Date.now(),
        createdAt: Date.now(),
      });

      const taskResult: TaskResult = {
        taskId,
        subtaskResults,
        codeChanges,
        qualityReport,
        metrics: this.dagScheduler.getParallelismMetrics(),
        totalDuration: executionTime,
      };

      this.emitEvent('task_completed', taskId, { duration: executionTime });
      this.pipelineState = 'idle';

      return taskResult;
    } catch (error) {
      // === Error Recovery ===
      this.pipelineState = 'failed';
      this.tasksFailed++;

      const executionTime = Date.now() - taskStartTime;
      await this.recordTaskMetrics(taskId, executionTime, false);

      // Attempt recovery via Recovery_Manager
      const runtimeError: RuntimeError = {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? (error.stack || '') : '',
        timestamp: Date.now(),
        agentId: 'facade',
        taskId,
        context: { input, pipelineState: this.pipelineState },
      };

      const executionContext: ExecutionContext = {
        taskId,
        agentId: 'facade',
        currentStep: { stepIndex: 0, action: 'processTask', input, output: null, timestamp: Date.now(), duration: executionTime, status: 'failed' },
        previousSteps: [],
        availableResources: { maxCpuPercent: 100, maxMemoryMB: 1024, maxExecutionTimeMs: 300000, maxConcurrentOperations: 10 },
      };

      const capture = await this.recoveryManager.captureError(runtimeError, executionContext);
      const classification = this.recoveryManager.classifyError(capture);
      const strategy = this.recoveryManager.selectStrategy(classification);

      if (strategy) {
        const recoveryResult = await this.recoveryManager.executeRecovery(strategy, executionContext);
        this.emitEvent('recovery_attempted', taskId, { success: recoveryResult.success, strategy: strategy.name });
      }

      this.emitEvent('task_failed', taskId, { error: runtimeError.message });
      this.pipelineState = 'idle';

      // Return a failure TaskResult
      return {
        taskId,
        subtaskResults: [],
        codeChanges: [],
        qualityReport: { passed: false, issues: [], suggestions: [], metrics: { lintScore: 0, typeCheckPassed: false, testCoverage: 0, cyclomaticComplexity: 0, documentationCoverage: 0 } },
        metrics: { wallClockTime: executionTime, cumulativeAgentTime: 0, parallelismRatio: 0, maxConcurrentAgents: 0 },
        totalDuration: executionTime,
      };
    }
  }

  /**
   * Returns overall system health and status.
   */
  getStatus(): SystemStatus {
    const activeAgents = this.agentOrchestrator.getActiveAgents();
    const idleAgentIds = this.performanceMonitor.identifyIdleAgents(60000);

    return {
      status: this.determineHealthStatus(),
      activeAgents: activeAgents.length,
      idleAgents: idleAgentIds.length,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      memoryUsage: this.memoryStore.getCapacityUsage(),
      uptime: Date.now() - this.startTime,
      degradationAlerts: [...this.degradationAlerts],
    };
  }

  /**
   * Cleanup all resources: stops monitoring intervals, destroys orchestrator.
   */
  shutdown(): void {
    // Stop idle agent check
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    // Stop degradation check
    if (this.degradationCheckInterval) {
      clearInterval(this.degradationCheckInterval);
      this.degradationCheckInterval = null;
    }

    // Unsubscribe from message bus
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // Destroy orchestrator (cleans up heartbeat timers)
    this.agentOrchestrator.destroy();

    this.pipelineState = 'idle';
  }

  /**
   * Records user feedback (explicit correction) and routes to Feedback_Loop
   * and Skill_Engine for learning.
   */
  async recordFeedback(taskId: string, correction: UserCorrection): Promise<void> {
    await this.feedbackLoop.recordExplicitFeedback(taskId, correction);

    // If a skill was involved, update the skill engine
    if (correction.affectedSkillId) {
      const skill = await this.skillEngine.findSkill({ taskCategory: correction.affectedSkillId });
      if (skill) {
        await this.skillEngine.recordUsage(skill.id, {
          success: false,
          context: correction.explanation || 'User correction',
          executionTime: 0,
          userFeedback: correction.explanation,
        });
      }
    }
  }

  // ===========================================================================
  // Private: Message Bus Wiring (Task 9.1)
  // ===========================================================================

  /**
   * Wires all components through the message bus:
   * - Agent_Orchestrator publishes to TASK_QUEUE and consumes from RESULT_QUEUE
   * - Agent pool consumes from TASK_QUEUE and publishes to RESULT_QUEUE
   * - Performance_Monitor, Recovery_Manager, and Feedback_Loop subscribe to EVENT_STREAM
   */
  private wireMessageBus(): void {
    // Performance_Monitor subscribes to EVENT_STREAM for tracking
    const unsubPerf = this.messageBus.subscribe(EVENT_STREAM, (message: AgentMessage) => {
      if (message.type === 'result_submission') {
        const payload = message.payload as { executionTime?: number; category?: string };
        if (payload.executionTime !== undefined) {
          this.performanceMonitor.recordExecution(message.correlationId, {
            taskId: message.correlationId,
            agentId: message.senderId,
            category: payload.category || 'general',
            executionTime: payload.executionTime,
            resourceConsumption: { cpuPercent: 10, memoryMB: 128, networkIO: 0, diskIO: 0 },
            successRate: 1,
            qualityScore: 0.8,
            timestamp: message.timestamp,
          });
        }
      }
    });
    this.unsubscribers.push(unsubPerf);

    // Recovery_Manager subscribes to EVENT_STREAM for failure monitoring
    const unsubRecovery = this.messageBus.subscribe(EVENT_STREAM, (message: AgentMessage) => {
      if (message.type === 'termination') {
        // Agent terminated - potential failure to monitor
        const payload = message.payload as { reason?: string };
        this.emitEvent('agent_failure_detected', message.correlationId, {
          agentId: message.recipientId,
          reason: payload.reason || 'unknown',
        });
      }
    });
    this.unsubscribers.push(unsubRecovery);

    // Feedback_Loop subscribes to EVENT_STREAM for learning signals
    const unsubFeedback = this.messageBus.subscribe(EVENT_STREAM, (message: AgentMessage) => {
      if (message.type === 'result_submission') {
        const payload = message.payload as { accepted?: boolean };
        if (payload.accepted !== undefined) {
          this.feedbackLoop.recordImplicitFeedback(message.correlationId, payload.accepted);
        }
      }
    });
    this.unsubscribers.push(unsubFeedback);
  }

  // ===========================================================================
  // Private: Cross-Cutting Concern Integration (Task 9.3)
  // ===========================================================================

  /**
   * Wires cross-cutting concerns:
   * - Recovery_Manager monitors agent pool for failures
   * - Performance_Monitor tracks all executions and detects idle agents
   * - Feedback_Loop captures corrections and drives Skill_Engine updates
   * - Resource release for idle agents (>60s) via Agent_Orchestrator
   * - Proactive degradation detection triggering corrective actions
   */
  private wireCrossCuttingConcerns(): void {
    // Periodic idle agent check (every 30 seconds)
    this.idleCheckInterval = setInterval(() => {
      this.releaseIdleAgents();
    }, 30000);

    // Periodic degradation check (every 15 seconds)
    this.degradationCheckInterval = setInterval(() => {
      this.checkForDegradation();
    }, 15000);
  }

  /**
   * Releases idle agents (>60s no tasks) via Agent_Orchestrator.
   */
  private releaseIdleAgents(): void {
    const releasedIds = this.agentOrchestrator.releaseIdleAgents(60000);
    if (releasedIds.length > 0) {
      this.emitEvent('idle_agents_released', 'system', { count: releasedIds.length, agentIds: releasedIds });
    }
  }

  /**
   * Proactive degradation detection: checks performance baselines and
   * triggers corrective actions when metrics exceed thresholds.
   */
  private checkForDegradation(): void {
    const baseline = this.performanceMonitor.getBaseline('general');
    if (!baseline) return;

    // Create a synthetic "current" metric from recent performance
    const idleAgents = this.performanceMonitor.identifyIdleAgents(60000);
    if (idleAgents.length > 3) {
      const alert: DegradationAlert = {
        metricName: 'idle_agents',
        currentValue: idleAgents.length,
        baselineValue: 0,
        threshold: 3,
        severity: 'warning',
        timestamp: Date.now(),
        suggestedAction: 'Release idle agents and reallocate resources',
      };
      this.degradationAlerts.push(alert);
      this.emitEvent('degradation_detected', 'system', { alert });
    }
  }

  // ===========================================================================
  // Private: Task Execution Helpers (Task 9.2)
  // ===========================================================================

  /**
   * Executes a wave of subtasks in parallel (simulated).
   * Each subtask is processed by the agent pool and results are collected.
   */
  private async executeWave(tasks: import('./shared/types').SubTask[], taskId: string): Promise<SubTaskResult[]> {
    const results: SubTaskResult[] = [];

    for (const subtask of tasks) {
      const subtaskStart = Date.now();
      try {
        // Simulate agent execution
        const result: SubTaskResult = {
          subtaskId: subtask.id,
          agentId: `agent_${subtask.recommendedAgentType}_${Date.now()}`,
          output: { description: subtask.description, status: 'completed' },
          duration: Date.now() - subtaskStart,
          retries: 0,
          status: 'success',
        };

        // Mark in scheduler
        this.dagScheduler.markComplete(subtask.id, result);
        results.push(result);

        // Emit event for monitoring
        this.emitEvent('subtask_completed', taskId, {
          subtaskId: subtask.id,
          agentId: result.agentId,
          duration: result.duration,
        });
      } catch (error) {
        // Handle subtask failure
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.dagScheduler.markFailed(subtask.id, errorMsg);

        results.push({
          subtaskId: subtask.id,
          agentId: '',
          output: { error: errorMsg },
          duration: Date.now() - subtaskStart,
          retries: 0,
          status: 'failed',
        });

        this.emitEvent('subtask_failed', taskId, { subtaskId: subtask.id, error: errorMsg });
      }
    }

    return results;
  }

  /**
   * Runs the Quality_Assurer gate on completed subtask outputs.
   * Returns a composite ReviewResult.
   */
  private async runQualityGate(taskId: string, results: SubTaskResult[]): Promise<ReviewResult> {
    const successResults = results.filter(r => r.status === 'success');
    if (successResults.length === 0) {
      return {
        passed: false,
        issues: [],
        suggestions: [],
        metrics: { lintScore: 0, typeCheckPassed: false, testCoverage: 0, cyclomaticComplexity: 0, documentationCoverage: 0 },
      };
    }

    // Run static analysis on a representative code output
    const codeOutput = {
      filePath: `src/${taskId}.ts`,
      content: successResults.map(r => `// Result: ${r.subtaskId}`).join('\n'),
      language: 'typescript',
      agentId: successResults[0]?.agentId ?? 'unknown',
      taskId,
    };

    const standards = {
      namingConventions: { classes: 'PascalCase', variables: 'camelCase' },
      documentationRequirements: ['JSDoc for public functions'],
      architecturalPatterns: [],
      lintRules: {},
      maxComplexity: 10,
    };

    return this.qualityAssurer.reviewCode(codeOutput, standards);
  }

  /**
   * Records execution metrics for a completed/failed task.
   */
  private async recordTaskMetrics(taskId: string, executionTime: number, success: boolean): Promise<void> {
    const metrics: ExecutionMetrics = {
      taskId,
      agentId: 'facade',
      category: 'general',
      executionTime,
      resourceConsumption: { cpuPercent: 15, memoryMB: 256, networkIO: 0, diskIO: 0 },
      successRate: success ? 1 : 0,
      qualityScore: success ? 0.8 : 0,
      timestamp: Date.now(),
    };

    await this.performanceMonitor.recordExecution(taskId, metrics);

    // Check for degradation using Recovery_Manager
    const baseline = this.performanceMonitor.getBaseline('general');
    if (baseline) {
      const alerts = this.recoveryManager.detectDegradation(metrics, baseline);
      if (alerts.length > 0) {
        this.degradationAlerts.push(...alerts);
        this.emitEvent('degradation_detected', taskId, { alerts });
      }
    }
  }

  /**
   * Emits an event to the EVENT_STREAM for monitoring by cross-cutting concerns.
   */
  private emitEvent(eventType: string, taskId: string, details: unknown): void {
    const message: AgentMessage = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'intermediate_result',
      senderId: 'facade',
      recipientId: 'broadcast',
      payload: { eventType, details },
      timestamp: Date.now(),
      correlationId: taskId,
    };

    this.messageBus.publish(EVENT_STREAM, message);
  }

  /**
   * Determines overall system health based on current status and alerts.
   */
  private determineHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const recentAlerts = this.degradationAlerts.filter(
      a => Date.now() - a.timestamp < 60000
    );

    if (recentAlerts.some(a => a.severity === 'critical')) {
      return 'unhealthy';
    }

    if (recentAlerts.length > 0 || this.tasksFailed > this.tasksCompleted) {
      return 'degraded';
    }

    return 'healthy';
  }
}

// =============================================================================
// Exports
// =============================================================================

export { AutonomousCodingAgent };

// Re-export all individual components
export { MessageBus, TASK_QUEUE, RESULT_QUEUE, EVENT_STREAM } from './shared/message-bus';
export { MemoryStore, NamespacedStore } from './infrastructure/memory-store';
export { VersionController } from './infrastructure/version-controller';
export { PerformanceMonitor } from './infrastructure/performance-monitor';
export { RecoveryManager } from './infrastructure/recovery-manager';
export { SkillEngine } from './execution/skill-engine';
export { ToolRegistry } from './execution/tool-registry';
export { QualityAssurer } from './execution/quality-assurer';
export { FeedbackLoop } from './execution/feedback-loop';
export { TaskDecomposer } from './orchestration/task-decomposer';
export { DAGScheduler } from './orchestration/dag-scheduler';
export { AgentOrchestrator } from './orchestration/agent-orchestrator';
export { NLUProcessor } from './interface/nlu-processor';
export { ReasoningEngine } from './interface/reasoning-engine';

// Re-export shared types
export * from './shared/types';
