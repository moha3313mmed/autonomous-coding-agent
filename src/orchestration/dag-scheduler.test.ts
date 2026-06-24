// Feature: autonomous-coding-agent
// Task 6.4: Property tests for DAG Scheduler

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DAGScheduler } from './dag-scheduler';
import {
  DependencyGraph,
  SubTask,
  SubTaskResult,
  DirectedEdge,
  AgentType,
  Priority,
} from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

const agentTypeArb: fc.Arbitrary<AgentType> = fc.constantFrom(
  'coding',
  'review',
  'research',
  'testing',
  'documentation',
  'refactoring'
);

const priorityArb: fc.Arbitrary<Priority> = fc.constantFrom(
  'critical',
  'high',
  'medium',
  'low'
);

/**
 * Generates a valid DependencyGraph (DAG) with a given number of nodes.
 * Edges only go from lower indexed nodes to higher indexed nodes to ensure acyclicity.
 */
const dependencyGraphArb = (minNodes: number, maxNodes: number): fc.Arbitrary<DependencyGraph> => {
  return fc.integer({ min: minNodes, max: maxNodes }).chain((size) =>
    fc.tuple(
      // Edge candidates (from lower to higher index)
      fc.array(
        fc.tuple(
          fc.integer({ min: 0, max: Math.max(0, size - 1) }),
          fc.integer({ min: 0, max: Math.max(0, size - 1) })
        ),
        { minLength: 0, maxLength: size * 2 }
      ),
      // Node properties
      fc.array(
        fc.record({
          description: fc.string({ minLength: 1, maxLength: 60 }),
          priority: priorityArb,
          complexityScore: fc.integer({ min: 1, max: 7 }),
          recommendedAgentType: agentTypeArb,
          estimatedDuration: fc.integer({ min: 1000, max: 60000 }),
          maxRetries: fc.integer({ min: 1, max: 3 }),
        }),
        { minLength: size, maxLength: size }
      )
    ).map(([edgePairs, props]) => {
      const ids = Array.from({ length: size }, (_, i) => `node_${i}`);
      const validEdges = edgePairs.filter(([from, to]) => from < to);

      // Build dependency lists
      const deps = new Map<string, string[]>();
      for (const id of ids) {
        deps.set(id, []);
      }
      for (const [fromIdx, toIdx] of validEdges) {
        const currentDeps = deps.get(ids[toIdx]) || [];
        if (!currentDeps.includes(ids[fromIdx])) {
          currentDeps.push(ids[fromIdx]);
          deps.set(ids[toIdx], currentDeps);
        }
      }

      // Build nodes map
      const nodes = new Map<string, SubTask>();
      for (let i = 0; i < size; i++) {
        nodes.set(ids[i], {
          id: ids[i],
          parentId: 'root',
          description: props[i].description,
          priority: props[i].priority,
          complexityScore: props[i].complexityScore,
          dependencies: deps.get(ids[i]) || [],
          recommendedAgentType: props[i].recommendedAgentType,
          estimatedDuration: props[i].estimatedDuration,
          maxRetries: props[i].maxRetries,
        });
      }

      // Build edges
      const edges: DirectedEdge[] = [];
      for (const [toId, depList] of deps) {
        for (const fromId of depList) {
          edges.push({ from: fromId, to: toId });
        }
      }

      // Compute topological order
      const topologicalOrder = computeTopoSort(ids, edges);

      return {
        nodes,
        edges,
        topologicalOrder,
        criticalPath: topologicalOrder.length > 0 ? [topologicalOrder[0]] : [],
        parallelGroups: [],
      } as DependencyGraph;
    })
  );
};

/**
 * Helper to compute topological sort for test graphs.
 */
function computeTopoSort(nodeIds: string[], edges: DirectedEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    adjacency.get(edge.from)!.push(edge.to);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return result;
}

// =============================================================================
// Property Tests
// =============================================================================

describe('DAGScheduler Property Tests', () => {
  // Property 6: Dependency completion triggers ready notification
  // Feature: autonomous-coding-agent, Property 6: Dependency completion triggers ready notification
  describe('Property 6: Dependency completion triggers ready notification', () => {
    it('completed tasks make their dependents ready when all dependencies are satisfied', () => {
      fc.assert(
        fc.property(
          dependencyGraphArb(2, 10),
          (graph) => {
            const scheduler = new DAGScheduler();
            scheduler.schedule(graph);

            // Find a task that has dependents
            const taskIds = Array.from(graph.nodes.keys());
            for (const taskId of taskIds) {
              // Find tasks that depend on this one
              const dependents = graph.edges
                .filter((e) => e.from === taskId)
                .map((e) => e.to);

              if (dependents.length === 0) continue;

              // First, complete all tasks that have no dependencies (wave 0 tasks)
              const state = scheduler.getState();

              // Complete this task
              const successResult: SubTaskResult = {
                subtaskId: taskId,
                agentId: 'agent_1',
                output: { data: 'done' },
                duration: 1000,
                retries: 0,
                status: 'success',
              };

              // If this task is ready, mark it complete
              if (state.taskStatuses.get(taskId) === 'ready') {
                scheduler.markComplete(taskId, successResult);

                // Check each dependent
                for (const depId of dependents) {
                  const depDependencies = graph.nodes.get(depId)?.dependencies || [];
                  const allDepsCompleted = depDependencies.every(
                    (d) => scheduler.getState().taskStatuses.get(d) === 'completed'
                  );

                  if (allDepsCompleted) {
                    // Dependent should now be 'ready'
                    expect(scheduler.getState().taskStatuses.get(depId)).toBe('ready');
                  } else {
                    // Dependent should still be 'pending'
                    expect(scheduler.getState().taskStatuses.get(depId)).toBe('pending');
                  }
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 8: Independent subtasks scheduled in parallel
  // Feature: autonomous-coding-agent, Property 8: Independent subtasks scheduled in parallel
  describe('Property 8: Independent subtasks scheduled in parallel', () => {
    it('tasks with no shared edges appear in the same wave', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }).chain((size) =>
            fc.record({
              nodeCount: fc.constant(size),
              descriptions: fc.array(
                fc.string({ minLength: 1, maxLength: 40 }),
                { minLength: size, maxLength: size }
              ),
            })
          ),
          ({ nodeCount, descriptions }) => {
            // Create completely independent tasks (no edges)
            const nodes = new Map<string, SubTask>();
            for (let i = 0; i < nodeCount; i++) {
              const id = `ind_${i}`;
              nodes.set(id, {
                id,
                parentId: 'root',
                description: descriptions[i],
                priority: 'medium',
                complexityScore: 3,
                dependencies: [],
                recommendedAgentType: 'coding',
                estimatedDuration: 10000,
                maxRetries: 2,
              });
            }

            const graph: DependencyGraph = {
              nodes,
              edges: [], // No edges = all independent
              topologicalOrder: Array.from(nodes.keys()),
              criticalPath: [Array.from(nodes.keys())[0]],
              parallelGroups: [Array.from(nodes.keys())],
            };

            const scheduler = new DAGScheduler();
            const plan = scheduler.schedule(graph);

            // All independent tasks should be in wave 0 (possibly split across sub-waves
            // due to MAX_CONCURRENCY, but all with the same logical wave assignment)
            // At minimum, the first wave should contain tasks
            const wave0Tasks = plan.waves[0]?.tasks || [];
            
            // All tasks that fit in a single wave should be in wave 0
            // (up to MAX_CONCURRENCY = 8)
            if (nodeCount <= 8) {
              // All nodes should be in the first wave
              expect(wave0Tasks.length).toBe(nodeCount);
            } else {
              // First wave should be at max concurrency
              expect(wave0Tasks.length).toBeLessThanOrEqual(8);
            }

            // All wave 0 tasks should be independent (have no dependencies)
            for (const task of wave0Tasks) {
              expect(task.dependencies.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 9: Resource allocation cap enforcement
  // Feature: autonomous-coding-agent, Property 9: Resource allocation cap enforcement
  describe('Property 9: Resource allocation cap enforcement', () => {
    it('wouldExceedResourceCap returns true when agent exceeds 40% of total resources', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (totalResources, agentUsagePercent) => {
            const scheduler = new DAGScheduler();

            // Create a minimal graph to initialize the scheduler
            const nodes = new Map<string, SubTask>();
            nodes.set('t1', {
              id: 't1',
              parentId: 'root',
              description: 'task',
              priority: 'medium',
              complexityScore: 3,
              dependencies: [],
              recommendedAgentType: 'coding',
              estimatedDuration: 10000,
              maxRetries: 2,
            });

            const graph: DependencyGraph = {
              nodes,
              edges: [],
              topologicalOrder: ['t1'],
              criticalPath: ['t1'],
              parallelGroups: [],
            };

            scheduler.schedule(graph);

            // Simulate agent resource usage by completing tasks with a duration
            const agentId = 'test_agent';
            const agentUsage = Math.floor((agentUsagePercent / 100) * totalResources);

            // Complete task with this agent's duration to build up resource usage
            const result: SubTaskResult = {
              subtaskId: 't1',
              agentId,
              output: {},
              duration: agentUsage,
              retries: 0,
              status: 'success',
            };
            scheduler.markComplete('t1', result);

            // Check if the resource cap is enforced correctly
            const wouldExceed = scheduler.wouldExceedResourceCap(agentId, totalResources);

            if (agentUsage / totalResources > 0.4) {
              expect(wouldExceed).toBe(true);
            } else {
              expect(wouldExceed).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 11: Parallelism metrics correctness
  // Feature: autonomous-coding-agent, Property 11: Parallelism metrics correctness
  describe('Property 11: Parallelism metrics correctness', () => {
    it('parallelism ratio equals sum of durations / wall-clock time', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 10 }),
              duration: fc.integer({ min: 10, max: 5000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (taskDefs) => {
            const scheduler = new DAGScheduler();

            // Create independent tasks
            const uniqueIds = taskDefs.map((t, i) => `metric_${i}`);
            const nodes = new Map<string, SubTask>();
            for (let i = 0; i < uniqueIds.length; i++) {
              nodes.set(uniqueIds[i], {
                id: uniqueIds[i],
                parentId: 'root',
                description: `Task ${i}`,
                priority: 'medium',
                complexityScore: 3,
                dependencies: [],
                recommendedAgentType: 'coding',
                estimatedDuration: taskDefs[i].duration,
                maxRetries: 2,
              });
            }

            const graph: DependencyGraph = {
              nodes,
              edges: [],
              topologicalOrder: uniqueIds,
              criticalPath: uniqueIds.length > 0 ? [uniqueIds[0]] : [],
              parallelGroups: [uniqueIds],
            };

            scheduler.schedule(graph);

            // Complete all tasks with their specified durations
            for (let i = 0; i < uniqueIds.length; i++) {
              const result: SubTaskResult = {
                subtaskId: uniqueIds[i],
                agentId: `agent_${i}`,
                output: {},
                duration: taskDefs[i].duration,
                retries: 0,
                status: 'success',
              };
              scheduler.markComplete(uniqueIds[i], result);
            }

            const metrics = scheduler.getParallelismMetrics();

            // Cumulative agent time should equal sum of all task durations
            const expectedCumulativeTime = taskDefs.reduce((sum, t) => sum + t.duration, 0);
            expect(metrics.cumulativeAgentTime).toBe(expectedCumulativeTime);

            // Parallelism ratio should equal cumulativeAgentTime / wallClockTime
            if (metrics.wallClockTime > 0) {
              const expectedRatio = metrics.cumulativeAgentTime / metrics.wallClockTime;
              expect(metrics.parallelismRatio).toBeCloseTo(expectedRatio, 5);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
