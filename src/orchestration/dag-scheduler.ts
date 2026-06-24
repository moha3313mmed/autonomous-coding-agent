import {
  DependencyGraph,
  ExecutionPlan,
  ExecutionWave,
  SubTask,
  SubTaskResult,
  ParallelismMetrics,
} from '../shared/types';

// =============================================================================
// Internal Interfaces
// =============================================================================

/**
 * Tracks the execution state of all tasks managed by the DAG Scheduler.
 */
interface ExecutionState {
  taskStatuses: Map<string, 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'suspended'>;
  taskResults: Map<string, SubTaskResult>;
  startTime: number;
  endTime: number | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of tasks that can execute concurrently in a single wave */
const MAX_CONCURRENCY = 8;

/** Maximum percentage of resources any single agent may consume (tracked, not enforced at scheduling time) */
const MAX_AGENT_RESOURCE_PERCENT = 0.4;

// =============================================================================
// DAGScheduler Class
// =============================================================================

/**
 * DAGScheduler produces an ExecutionPlan from a DependencyGraph, organizing tasks
 * into waves of parallel execution while respecting dependency ordering and resource constraints.
 *
 * Key behaviors:
 * - Uses topological sort to assign wave indices
 * - Tasks with no dependencies go in wave 0
 * - Tasks go in wave = max(wave of dependencies) + 1
 * - Resource enforcement: maxConcurrency = 8 (up to 8 tasks per wave)
 * - When a task fails, all downstream dependents are 'suspended'
 */
export class DAGScheduler {
  private state: ExecutionState;
  private graph: DependencyGraph | null = null;
  private taskWaveMap: Map<string, number> = new Map();
  private dependentsMap: Map<string, string[]> = new Map();
  private dependenciesMap: Map<string, string[]> = new Map();
  private agentResourceUsage: Map<string, number> = new Map();

  constructor() {
    this.state = {
      taskStatuses: new Map(),
      taskResults: new Map(),
      startTime: Date.now(),
      endTime: null,
    };
  }

  /**
   * Produces an ExecutionPlan with waves of parallel tasks from a DependencyGraph.
   * Each wave contains tasks whose dependencies are all in previous waves.
   * Uses topological sort to determine wave assignment.
   *
   * @param graph - The dependency graph to schedule
   * @returns An ExecutionPlan with ordered waves of parallel tasks
   */
  schedule(graph: DependencyGraph): ExecutionPlan {
    this.graph = graph;
    this.buildDependencyMaps(graph);

    // Compute wave assignment for each task using topological ordering
    const waveAssignments = this.computeWaveAssignments(graph);

    // Group tasks into waves
    const waveGroups = new Map<number, SubTask[]>();
    for (const [taskId, waveIndex] of waveAssignments.entries()) {
      this.taskWaveMap.set(taskId, waveIndex);
      if (!waveGroups.has(waveIndex)) {
        waveGroups.set(waveIndex, []);
      }
      const task = graph.nodes.get(taskId);
      if (task) {
        waveGroups.get(waveIndex)!.push(task);
      }
    }

    // Split waves that exceed maxConcurrency into sub-waves
    const waves: ExecutionWave[] = [];
    const sortedWaveIndices = Array.from(waveGroups.keys()).sort((a, b) => a - b);

    let actualWaveIndex = 0;
    for (const originalWaveIndex of sortedWaveIndices) {
      const tasks = waveGroups.get(originalWaveIndex)!;
      const chunks = this.chunkArray(tasks, MAX_CONCURRENCY);

      for (const chunk of chunks) {
        const prerequisites = originalWaveIndex > 0
          ? [String(actualWaveIndex - 1)]
          : [];

        waves.push({
          waveIndex: actualWaveIndex,
          tasks: chunk,
          prerequisites,
        });
        actualWaveIndex++;
      }
    }

    // Initialize execution state for all tasks
    for (const [taskId] of graph.nodes) {
      const deps = this.dependenciesMap.get(taskId) || [];
      if (deps.length === 0) {
        this.state.taskStatuses.set(taskId, 'ready');
      } else {
        this.state.taskStatuses.set(taskId, 'pending');
      }
    }

    // Compute total estimated time (sum of critical path durations)
    const totalEstimatedTime = this.computeTotalEstimatedTime(waves);

    return {
      waves,
      totalEstimatedTime,
      maxConcurrency: MAX_CONCURRENCY,
    };
  }

  /**
   * Returns tasks whose dependencies are all in 'completed' state.
   * Only returns tasks that are currently in 'ready' state.
   *
   * @param state - The current execution state (optional, uses internal state if not provided)
   * @returns Array of SubTasks that are ready to execute
   */
  getReadyTasks(state?: ExecutionState): SubTask[] {
    const currentState = state || this.state;
    const readyTasks: SubTask[] = [];

    if (!this.graph) {
      return readyTasks;
    }

    for (const [taskId, status] of currentState.taskStatuses) {
      if (status === 'ready') {
        const task = this.graph.nodes.get(taskId);
        if (task) {
          readyTasks.push(task);
        }
      }
    }

    return readyTasks;
  }

  /**
   * Updates state when a task completes, triggering dependent tasks to become ready.
   * A dependent task becomes 'ready' when ALL of its dependencies are 'completed'.
   *
   * @param taskId - The ID of the completed task
   * @param result - The result of the completed task
   */
  markComplete(taskId: string, result: SubTaskResult): void {
    this.state.taskStatuses.set(taskId, 'completed');
    this.state.taskResults.set(taskId, result);

    // Track agent resource usage for metrics
    if (result.agentId) {
      const current = this.agentResourceUsage.get(result.agentId) || 0;
      this.agentResourceUsage.set(result.agentId, current + result.duration);
    }

    // Check if any dependent tasks can now become ready
    const dependents = this.dependentsMap.get(taskId) || [];
    for (const dependentId of dependents) {
      const dependentStatus = this.state.taskStatuses.get(dependentId);
      if (dependentStatus === 'pending') {
        const deps = this.dependenciesMap.get(dependentId) || [];
        const allDepsCompleted = deps.every(
          (depId) => this.state.taskStatuses.get(depId) === 'completed'
        );
        if (allDepsCompleted) {
          this.state.taskStatuses.set(dependentId, 'ready');
        }
      }
    }

    // Check if all tasks are done
    this.checkCompletion();
  }

  /**
   * Marks a task as failed and suspends all downstream dependent tasks.
   * Suspended tasks cannot execute until the failure is resolved.
   *
   * @param taskId - The ID of the failed task
   * @param error - Description of the error
   */
  markFailed(taskId: string, error: string): void {
    this.state.taskStatuses.set(taskId, 'failed');
    this.state.taskResults.set(taskId, {
      subtaskId: taskId,
      agentId: '',
      output: { error },
      duration: 0,
      retries: 0,
      status: 'failed',
    });

    // Suspend all downstream dependents (cascading failure rule)
    this.suspendDownstream(taskId);

    // Check if all tasks are done (completed, failed, or suspended)
    this.checkCompletion();
  }

  /**
   * Computes parallelism metrics: wall-clock time vs cumulative agent time ratio.
   *
   * @returns ParallelismMetrics with timing and concurrency information
   */
  getParallelismMetrics(): ParallelismMetrics {
    const endTime = this.state.endTime || Date.now();
    const wallClockTime = endTime - this.state.startTime;

    // Cumulative agent time is the sum of all completed task durations
    let cumulativeAgentTime = 0;
    for (const [, result] of this.state.taskResults) {
      if (result.status === 'success') {
        cumulativeAgentTime += result.duration;
      }
    }

    // Parallelism ratio: how much concurrent work was done relative to wall-clock time
    const parallelismRatio = wallClockTime > 0 ? cumulativeAgentTime / wallClockTime : 0;

    // Max concurrent agents: the largest wave size that was actually executed
    let maxConcurrentAgents = 0;
    if (this.graph) {
      const waveTaskCounts = new Map<number, number>();
      for (const [, waveIndex] of this.taskWaveMap) {
        const count = waveTaskCounts.get(waveIndex) || 0;
        waveTaskCounts.set(waveIndex, count + 1);
      }
      for (const [, count] of waveTaskCounts) {
        maxConcurrentAgents = Math.max(maxConcurrentAgents, Math.min(count, MAX_CONCURRENCY));
      }
    }

    return {
      wallClockTime,
      cumulativeAgentTime,
      parallelismRatio,
      maxConcurrentAgents,
    };
  }

  /**
   * Returns the current execution state (for external inspection or testing).
   */
  getState(): ExecutionState {
    return this.state;
  }

  /**
   * Checks whether a given resource allocation would exceed the 40% cap.
   * This is tracked but not enforced at scheduling time per design.
   *
   * @param agentId - The agent to check
   * @param totalResources - Total available resources
   * @returns true if the agent would exceed the 40% cap
   */
  wouldExceedResourceCap(agentId: string, totalResources: number): boolean {
    const agentUsage = this.agentResourceUsage.get(agentId) || 0;
    return agentUsage / totalResources > MAX_AGENT_RESOURCE_PERCENT;
  }

  /**
   * Resets the scheduler state for a new execution run.
   */
  reset(): void {
    this.state = {
      taskStatuses: new Map(),
      taskResults: new Map(),
      startTime: Date.now(),
      endTime: null,
    };
    this.graph = null;
    this.taskWaveMap.clear();
    this.dependentsMap.clear();
    this.dependenciesMap.clear();
    this.agentResourceUsage.clear();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Builds forward (dependents) and backward (dependencies) maps from the graph edges.
   */
  private buildDependencyMaps(graph: DependencyGraph): void {
    this.dependentsMap.clear();
    this.dependenciesMap.clear();

    // Initialize maps for all nodes
    for (const [taskId] of graph.nodes) {
      this.dependentsMap.set(taskId, []);
      this.dependenciesMap.set(taskId, []);
    }

    // Build from edges
    for (const edge of graph.edges) {
      const dependents = this.dependentsMap.get(edge.from);
      if (dependents) {
        dependents.push(edge.to);
      }

      const dependencies = this.dependenciesMap.get(edge.to);
      if (dependencies) {
        dependencies.push(edge.from);
      }
    }
  }

  /**
   * Computes wave assignments using topological ordering.
   * Wave = max(wave of all dependencies) + 1.
   * Tasks with no dependencies are in wave 0.
   */
  private computeWaveAssignments(graph: DependencyGraph): Map<string, number> {
    const waveAssignments = new Map<string, number>();

    // Use the topological order from the graph if available, otherwise compute
    const order = graph.topologicalOrder.length > 0
      ? graph.topologicalOrder
      : this.computeTopologicalOrder(graph);

    for (const taskId of order) {
      const deps = this.dependenciesMap.get(taskId) || [];
      if (deps.length === 0) {
        waveAssignments.set(taskId, 0);
      } else {
        let maxDepWave = 0;
        for (const depId of deps) {
          const depWave = waveAssignments.get(depId) || 0;
          maxDepWave = Math.max(maxDepWave, depWave);
        }
        waveAssignments.set(taskId, maxDepWave + 1);
      }
    }

    return waveAssignments;
  }

  /**
   * Computes a topological ordering of nodes using Kahn's algorithm.
   * Falls back to this if the graph doesn't provide a pre-computed order.
   */
  private computeTopologicalOrder(graph: DependencyGraph): string[] {
    const inDegree = new Map<string, number>();
    for (const [taskId] of graph.nodes) {
      inDegree.set(taskId, 0);
    }

    for (const edge of graph.edges) {
      const current = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, current + 1);
    }

    const queue: string[] = [];
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      order.push(taskId);

      const dependents = this.dependentsMap.get(taskId) || [];
      for (const dep of dependents) {
        const newDegree = (inDegree.get(dep) || 1) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    return order;
  }

  /**
   * Recursively suspends all downstream dependents of a failed task.
   */
  private suspendDownstream(taskId: string): void {
    const dependents = this.dependentsMap.get(taskId) || [];
    for (const dependentId of dependents) {
      const status = this.state.taskStatuses.get(dependentId);
      // Only suspend tasks that haven't already completed or failed
      if (status === 'pending' || status === 'ready') {
        this.state.taskStatuses.set(dependentId, 'suspended');
        // Recursively suspend further downstream
        this.suspendDownstream(dependentId);
      }
    }
  }

  /**
   * Checks if all tasks have reached a terminal state and sets endTime if so.
   */
  private checkCompletion(): void {
    const terminalStates = new Set(['completed', 'failed', 'suspended']);
    let allTerminal = true;

    for (const [, status] of this.state.taskStatuses) {
      if (!terminalStates.has(status)) {
        allTerminal = false;
        break;
      }
    }

    if (allTerminal && this.state.taskStatuses.size > 0) {
      this.state.endTime = Date.now();
    }
  }

  /**
   * Splits an array into chunks of specified size.
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Computes total estimated time from the execution plan waves.
   * Uses the max estimated duration within each wave (parallel execution),
   * then sums across waves (sequential wave execution).
   */
  private computeTotalEstimatedTime(waves: ExecutionWave[]): number {
    let total = 0;
    for (const wave of waves) {
      let waveMax = 0;
      for (const task of wave.tasks) {
        waveMax = Math.max(waveMax, task.estimatedDuration);
      }
      total += waveMax;
    }
    return total;
  }
}
