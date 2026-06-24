// =============================================================================
// Task Decomposer - DAG-based task decomposition with topological scheduling
// =============================================================================

import {
  ResolvedIntent,
  ProjectContext,
  DecompositionPlan,
  SubTask,
  DependencyGraph,
  DirectedEdge,
  ComplexityScore,
  ContextChange,
  Priority,
  AgentType,
} from '../shared/types';

/**
 * TaskDecomposer analyzes complex tasks and produces a DAG of subtasks
 * with dependency relationships, complexity estimates, and topological ordering.
 */
export class TaskDecomposer {
  private readonly maxRecursiveDepth = 5;
  private readonly complexityThreshold = 7;

  /**
   * Analyzes a task and produces a decomposition plan with subtasks,
   * dependency graph, and topological order.
   */
  async decompose(
    intent: ResolvedIntent,
    context: ProjectContext
  ): Promise<DecompositionPlan> {
    const planId = this.generateId();
    const subtasks = this.generateSubtasks(intent, context);

    // Recursively decompose complex subtasks
    const decomposedSubtasks = this.recursiveDecomposeAll(subtasks);

    // Build the dependency graph
    const dependencyGraph = this.identifyDependencies(decomposedSubtasks);

    // Calculate estimated duration (sum of critical path durations)
    const estimatedDuration = this.calculateEstimatedDuration(
      decomposedSubtasks,
      dependencyGraph
    );

    // Calculate parallelism factor
    const parallelismFactor = this.calculateParallelismFactor(dependencyGraph);

    return {
      id: planId,
      rootTask: intent,
      subtasks: decomposedSubtasks,
      dependencyGraph,
      estimatedDuration,
      parallelismFactor,
    };
  }

  /**
   * Produces a complexity score (1-10 scale) based on description length,
   * dependencies count, and other heuristics.
   */
  estimateComplexity(subtask: SubTask): ComplexityScore {
    const dimensions: Record<string, number> = {};

    // Description complexity: longer descriptions indicate more complexity
    const descriptionLength = subtask.description.length;
    dimensions['description'] = Math.min(10, Math.max(1, Math.ceil(descriptionLength / 50)));

    // Dependency complexity: more dependencies = more coordination overhead
    dimensions['dependencies'] = Math.min(10, Math.max(1, subtask.dependencies.length * 2 + 1));

    // Duration complexity: longer tasks are more complex
    dimensions['duration'] = Math.min(10, Math.max(1, Math.ceil(subtask.estimatedDuration / 60000)));

    // Retry complexity: tasks needing retries are inherently complex
    dimensions['retries'] = Math.min(10, Math.max(1, subtask.maxRetries * 2));

    // Calculate overall score as weighted average
    const weights: Record<string, number> = {
      description: 0.3,
      dependencies: 0.3,
      duration: 0.25,
      retries: 0.15,
    };

    let overall = 0;
    for (const [key, weight] of Object.entries(weights)) {
      overall += (dimensions[key] ?? 1) * weight;
    }

    overall = Math.min(10, Math.max(1, Math.round(overall)));

    return {
      overall,
      dimensions,
      confidence: 0.8,
      decomposable: overall > this.complexityThreshold,
    };
  }

  /**
   * Builds a DAG from subtasks, validates acyclicity via topological sort (Kahn's algorithm).
   * Throws if a cycle is detected.
   */
  identifyDependencies(subtasks: SubTask[]): DependencyGraph {
    // Build nodes map
    const nodes = new Map<string, SubTask>();
    for (const subtask of subtasks) {
      nodes.set(subtask.id, subtask);
    }

    // Build edges from dependency lists
    const edges: DirectedEdge[] = [];
    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        if (nodes.has(depId)) {
          edges.push({ from: depId, to: subtask.id });
        }
      }
    }

    // Perform topological sort using Kahn's algorithm
    const topologicalOrder = this.topologicalSort(nodes, edges);

    // Compute critical path
    const criticalPath = this.computeCriticalPath(nodes, edges, topologicalOrder);

    // Identify parallel groups (independent subtasks with no shared edges)
    const parallelGroups = this.identifyParallelGroups(nodes, edges);

    return {
      nodes,
      edges,
      topologicalOrder,
      criticalPath,
      parallelGroups,
    };
  }

  /**
   * Re-evaluates the plan within 10 seconds, adjusting priorities for affected subtasks.
   */
  async reEvaluate(
    plan: DecompositionPlan,
    contextChange: ContextChange
  ): Promise<DecompositionPlan> {
    const startTime = Date.now();
    const timeLimit = 10000; // 10 seconds

    // Identify affected subtasks based on context change
    const affectedSubtasks = this.findAffectedSubtasks(plan.subtasks, contextChange);

    // Adjust priorities for affected subtasks
    const adjustedSubtasks = plan.subtasks.map((subtask) => {
      if (affectedSubtasks.has(subtask.id)) {
        return this.adjustSubtaskPriority(subtask, contextChange);
      }
      return subtask;
    });

    // Check time constraint
    const elapsed = Date.now() - startTime;
    if (elapsed > timeLimit) {
      // Return what we have if time limit exceeded
      return {
        ...plan,
        subtasks: adjustedSubtasks,
        dependencyGraph: this.identifyDependencies(adjustedSubtasks),
      };
    }

    // Rebuild dependency graph with adjusted subtasks
    const dependencyGraph = this.identifyDependencies(adjustedSubtasks);

    return {
      ...plan,
      subtasks: adjustedSubtasks,
      dependencyGraph,
      estimatedDuration: this.calculateEstimatedDuration(adjustedSubtasks, dependencyGraph),
      parallelismFactor: this.calculateParallelismFactor(dependencyGraph),
    };
  }

  /**
   * Recursively decomposes subtasks with complexity > 7 until all leaves are <= 7.
   * Maximum recursion depth is 5.
   */
  recursiveDecompose(subtask: SubTask, maxDepth: number): SubTask[] {
    if (maxDepth <= 0) {
      return [subtask];
    }

    const complexity = this.estimateComplexity(subtask);
    if (complexity.overall <= this.complexityThreshold) {
      return [subtask];
    }

    // Split into 2-3 subtasks
    const childCount = complexity.overall > 9 ? 3 : 2;
    const children = this.splitSubtask(subtask, childCount);

    // Recursively decompose each child
    const result: SubTask[] = [];
    for (const child of children) {
      const decomposed = this.recursiveDecompose(child, maxDepth - 1);
      result.push(...decomposed);
    }

    return result;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Recursively decompose all subtasks in the list.
   */
  private recursiveDecomposeAll(subtasks: SubTask[]): SubTask[] {
    const result: SubTask[] = [];
    for (const subtask of subtasks) {
      const decomposed = this.recursiveDecompose(subtask, this.maxRecursiveDepth);
      result.push(...decomposed);
    }
    return result;
  }

  /**
   * Generates initial subtasks from a resolved intent and project context.
   */
  private generateSubtasks(intent: ResolvedIntent, _context: ProjectContext): SubTask[] {
    const subtasks: SubTask[] = [];
    const structured = intent.intent;

    // Generate subtasks based on target scope
    const targetFiles = structured.targetScope.files;
    const targetModules = structured.targetScope.modules;
    const targetFunctions = structured.targetScope.functions;

    // Create a subtask for each target or a single one if scope is project-wide
    if (structured.targetScope.scope === 'project') {
      subtasks.push(
        this.createSubTask({
          parentId: 'root',
          description: `${structured.actionType} project-wide: ${structured.rawInput}`,
          dependencies: [],
          agentType: this.mapActionToAgentType(structured.actionType),
          estimatedDuration: 300000, // 5 minutes default
        })
      );
    } else {
      // Create subtasks for each target
      const targets = [...targetFiles, ...targetModules, ...targetFunctions];
      const createdIds: string[] = [];

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]!;
        const id = this.generateId();
        // Dependencies: later tasks may depend on earlier ones for sequential targets
        const dependencies = i > 0 && structured.targetScope.scope === 'module'
          ? [createdIds[i - 1]!]
          : [];

        subtasks.push(
          this.createSubTask({
            id,
            parentId: 'root',
            description: `${structured.actionType} ${structured.targetScope.scope}: ${target}`,
            dependencies,
            agentType: this.mapActionToAgentType(structured.actionType),
            estimatedDuration: 120000, // 2 minutes default
          })
        );
        createdIds.push(id);
      }
    }

    // If no targets found, create a single generic subtask
    if (subtasks.length === 0) {
      subtasks.push(
        this.createSubTask({
          parentId: 'root',
          description: `${structured.actionType}: ${structured.rawInput}`,
          dependencies: [],
          agentType: this.mapActionToAgentType(structured.actionType),
          estimatedDuration: 180000,
        })
      );
    }

    return subtasks;
  }

  /**
   * Performs topological sort using Kahn's algorithm.
   * Throws an error if a cycle is detected.
   */
  private topologicalSort(
    nodes: Map<string, SubTask>,
    edges: DirectedEdge[]
  ): string[] {
    // Build in-degree map and adjacency list
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const nodeId of nodes.keys()) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, []);
    }

    for (const edge of edges) {
      const currentInDegree = inDegree.get(edge.to) ?? 0;
      inDegree.set(edge.to, currentInDegree + 1);
      const neighbors = adjacency.get(edge.from) ?? [];
      neighbors.push(edge.to);
      adjacency.set(edge.from, neighbors);
    }

    // Initialize queue with nodes having in-degree 0
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      // Sort queue by priority for deterministic ordering
      queue.sort((a, b) => {
        const taskA = nodes.get(a);
        const taskB = nodes.get(b);
        return this.priorityToNumber(taskA?.priority ?? 'low') -
          this.priorityToNumber(taskB?.priority ?? 'low');
      });

      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // If not all nodes are in result, there's a cycle
    if (result.length !== nodes.size) {
      throw new Error(
        'Cycle detected in dependency graph: topological sort could not complete'
      );
    }

    return result;
  }

  /**
   * Computes the critical path through the DAG (longest path by estimated duration).
   */
  private computeCriticalPath(
    nodes: Map<string, SubTask>,
    edges: DirectedEdge[],
    topologicalOrder: string[]
  ): string[] {
    // Use dynamic programming on topological order
    const dist = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    for (const nodeId of topologicalOrder) {
      dist.set(nodeId, nodes.get(nodeId)?.estimatedDuration ?? 0);
      predecessor.set(nodeId, null);
    }

    // Build reverse adjacency (who points to whom)
    const incomingEdges = new Map<string, DirectedEdge[]>();
    for (const edge of edges) {
      const incoming = incomingEdges.get(edge.to) ?? [];
      incoming.push(edge);
      incomingEdges.set(edge.to, incoming);
    }

    for (const nodeId of topologicalOrder) {
      const incoming = incomingEdges.get(nodeId) ?? [];
      const nodeDuration = nodes.get(nodeId)?.estimatedDuration ?? 0;

      for (const edge of incoming) {
        const candidateDist = (dist.get(edge.from) ?? 0) + nodeDuration;
        if (candidateDist > (dist.get(nodeId) ?? 0)) {
          dist.set(nodeId, candidateDist);
          predecessor.set(nodeId, edge.from);
        }
      }
    }

    // Find node with maximum distance (end of critical path)
    let maxDist = 0;
    let endNode = topologicalOrder[0] ?? '';
    for (const [nodeId, d] of dist.entries()) {
      if (d > maxDist) {
        maxDist = d;
        endNode = nodeId;
      }
    }

    // Trace back the critical path
    const criticalPath: string[] = [];
    let current: string | null = endNode;
    while (current !== null) {
      criticalPath.unshift(current);
      current = predecessor.get(current) ?? null;
    }

    return criticalPath;
  }

  /**
   * Identifies groups of independent subtasks that can run in parallel.
   * Tasks with no shared dependency edges form a parallel group.
   */
  private identifyParallelGroups(
    nodes: Map<string, SubTask>,
    edges: DirectedEdge[]
  ): string[][] {
    // Build adjacency for reachability computation
    const adjacency = new Map<string, Set<string>>();

    for (const nodeId of nodes.keys()) {
      adjacency.set(nodeId, new Set());
    }

    for (const edge of edges) {
      adjacency.get(edge.from)?.add(edge.to);
    }

    // Compute reachability (transitive closure) for dependency detection
    const reachable = new Map<string, Set<string>>();
    const nodeIds = [...nodes.keys()];

    for (const nodeId of nodeIds) {
      const visited = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const curr = stack.pop()!;
        const neighbors = adjacency.get(curr) ?? new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        }
      }
      reachable.set(nodeId, visited);
    }

    // Two nodes are independent if neither can reach the other
    const groups: string[][] = [];
    const assigned = new Set<string>();

    for (const nodeId of nodeIds) {
      if (assigned.has(nodeId)) continue;

      const group: string[] = [nodeId];
      assigned.add(nodeId);

      for (const otherId of nodeIds) {
        if (assigned.has(otherId)) continue;
        if (nodeId === otherId) continue;

        // Check if nodeId and otherId are independent
        const nodeReachesOther = reachable.get(nodeId)?.has(otherId) ?? false;
        const otherReachesNode = reachable.get(otherId)?.has(nodeId) ?? false;

        if (!nodeReachesOther && !otherReachesNode) {
          // Check if otherId is independent of all current group members
          let isIndependent = true;
          for (const groupMember of group) {
            const memberReachesOther = reachable.get(groupMember)?.has(otherId) ?? false;
            const otherReachesMember = reachable.get(otherId)?.has(groupMember) ?? false;
            if (memberReachesOther || otherReachesMember) {
              isIndependent = false;
              break;
            }
          }

          if (isIndependent) {
            group.push(otherId);
            assigned.add(otherId);
          }
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    // Include singleton groups for nodes that have no parallel partners
    for (const nodeId of nodeIds) {
      if (!assigned.has(nodeId)) {
        groups.push([nodeId]);
      }
    }

    return groups;
  }

  /**
   * Splits a complex subtask into multiple simpler child subtasks.
   */
  private splitSubtask(subtask: SubTask, childCount: number): SubTask[] {
    const children: SubTask[] = [];
    const durationPerChild = Math.ceil(subtask.estimatedDuration / childCount);

    for (let i = 0; i < childCount; i++) {
      const childId = this.generateId();
      children.push({
        id: childId,
        parentId: subtask.id,
        description: `${subtask.description} (part ${i + 1}/${childCount})`,
        priority: subtask.priority,
        complexityScore: Math.max(1, Math.floor(subtask.complexityScore / childCount) + 1),
        dependencies: i > 0 ? [children[i - 1]!.id] : subtask.dependencies,
        recommendedAgentType: subtask.recommendedAgentType,
        estimatedDuration: durationPerChild,
        maxRetries: subtask.maxRetries,
      });
    }

    return children;
  }

  /**
   * Finds subtasks affected by a context change based on file paths.
   */
  private findAffectedSubtasks(
    subtasks: SubTask[],
    contextChange: ContextChange
  ): Set<string> {
    const affected = new Set<string>();

    for (const subtask of subtasks) {
      // Check if the subtask description mentions any affected path
      for (const path of contextChange.affectedPaths) {
        if (subtask.description.includes(path)) {
          affected.add(subtask.id);
          break;
        }
      }
    }

    // If change type is requirement_updated, affect all subtasks
    if (contextChange.changeType === 'requirement_updated') {
      for (const subtask of subtasks) {
        affected.add(subtask.id);
      }
    }

    return affected;
  }

  /**
   * Adjusts a subtask's priority based on a context change.
   */
  private adjustSubtaskPriority(
    subtask: SubTask,
    contextChange: ContextChange
  ): SubTask {
    let newPriority: Priority = subtask.priority;

    switch (contextChange.changeType) {
      case 'requirement_updated':
        newPriority = this.elevateHPriority(subtask.priority);
        break;
      case 'file_deleted':
        newPriority = 'critical';
        break;
      case 'dependency_changed':
        newPriority = this.elevateHPriority(subtask.priority);
        break;
      case 'file_modified':
      case 'file_added':
        // Keep existing priority or slightly elevate
        newPriority = subtask.priority;
        break;
    }

    return { ...subtask, priority: newPriority };
  }

  /**
   * Elevates a priority by one level.
   */
  private elevateHPriority(current: Priority): Priority {
    switch (current) {
      case 'low':
        return 'medium';
      case 'medium':
        return 'high';
      case 'high':
        return 'critical';
      case 'critical':
        return 'critical';
    }
  }

  /**
   * Maps a priority to a numeric value for sorting (lower number = higher priority).
   */
  private priorityToNumber(priority: Priority): number {
    switch (priority) {
      case 'critical':
        return 1;
      case 'high':
        return 2;
      case 'medium':
        return 3;
      case 'low':
        return 4;
    }
  }

  /**
   * Maps an action type to the recommended agent type.
   */
  private mapActionToAgentType(actionType: string): AgentType {
    switch (actionType) {
      case 'create':
      case 'modify':
      case 'fix':
        return 'coding';
      case 'refactor':
        return 'refactoring';
      case 'test':
        return 'testing';
      case 'document':
        return 'documentation';
      case 'analyze':
        return 'research';
      case 'deploy':
        return 'coding';
      default:
        return 'coding';
    }
  }

  /**
   * Creates a SubTask with defaults.
   */
  private createSubTask(params: {
    id?: string;
    parentId: string;
    description: string;
    dependencies: string[];
    agentType: AgentType;
    estimatedDuration: number;
  }): SubTask {
    const id = params.id ?? this.generateId();
    const complexity = Math.min(
      10,
      Math.max(1, Math.ceil(params.description.length / 50) + params.dependencies.length)
    );

    return {
      id,
      parentId: params.parentId,
      description: params.description,
      priority: this.complexityToPriority(complexity),
      complexityScore: complexity,
      dependencies: params.dependencies,
      recommendedAgentType: params.agentType,
      estimatedDuration: params.estimatedDuration,
      maxRetries: 3,
    };
  }

  /**
   * Maps complexity score to priority level.
   * 1-3: low, 4-5: medium, 6-7: high, 8-10: critical
   */
  private complexityToPriority(complexity: number): Priority {
    if (complexity <= 3) return 'low';
    if (complexity <= 5) return 'medium';
    if (complexity <= 7) return 'high';
    return 'critical';
  }

  /**
   * Calculates estimated total duration based on the critical path.
   */
  private calculateEstimatedDuration(
    subtasks: SubTask[],
    graph: DependencyGraph
  ): number {
    let totalDuration = 0;
    for (const nodeId of graph.criticalPath) {
      const subtask = graph.nodes.get(nodeId);
      if (subtask) {
        totalDuration += subtask.estimatedDuration;
      }
    }
    return totalDuration || subtasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
  }

  /**
   * Calculates the parallelism factor (total work / critical path duration).
   */
  private calculateParallelismFactor(graph: DependencyGraph): number {
    let totalWork = 0;
    for (const subtask of graph.nodes.values()) {
      totalWork += subtask.estimatedDuration;
    }

    let criticalPathDuration = 0;
    for (const nodeId of graph.criticalPath) {
      const subtask = graph.nodes.get(nodeId);
      if (subtask) {
        criticalPathDuration += subtask.estimatedDuration;
      }
    }

    if (criticalPathDuration === 0) return 1;
    return totalWork / criticalPathDuration;
  }

  /**
   * Generates a unique identifier.
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
