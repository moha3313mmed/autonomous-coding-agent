// Feature: autonomous-coding-agent
// Task 6.2: Property tests for Task_Decomposer

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TaskDecomposer } from './task-decomposer';
import {
  SubTask,
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
 * Generates a SubTask with a given id, parentId, and dependencies.
 * Complexity score is kept <= 7 to represent a leaf task.
 */
const leafSubTaskArb = (id: string, deps: string[]): fc.Arbitrary<SubTask> =>
  fc.record({
    id: fc.constant(id),
    parentId: fc.constant('root'),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    priority: priorityArb,
    complexityScore: fc.integer({ min: 1, max: 7 }),
    dependencies: fc.constant(deps),
    recommendedAgentType: agentTypeArb,
    estimatedDuration: fc.integer({ min: 1000, max: 300000 }),
    maxRetries: fc.integer({ min: 1, max: 5 }),
  });

/**
 * Generates a valid DAG of subtasks (no cycles).
 * Strategy: assign each node an index; edges only go from lower index to higher index.
 */
const dagSubTasksArb = (size: number): fc.Arbitrary<SubTask[]> => {
  if (size <= 0) {
    return fc.constant([]);
  }

  return fc.tuple(
    // Generate node ids
    fc.constant(Array.from({ length: size }, (_, i) => `task_${i}`)),
    // Generate random edges (only from lower to higher index to avoid cycles)
    fc.array(
      fc.tuple(
        fc.integer({ min: 0, max: size - 1 }),
        fc.integer({ min: 0, max: size - 1 })
      ),
      { minLength: 0, maxLength: size * 2 }
    ),
    // Generate subtask properties
    fc.array(
      fc.record({
        description: fc.string({ minLength: 1, maxLength: 80 }),
        priority: priorityArb,
        complexityScore: fc.integer({ min: 1, max: 7 }),
        recommendedAgentType: agentTypeArb,
        estimatedDuration: fc.integer({ min: 1000, max: 300000 }),
        maxRetries: fc.integer({ min: 1, max: 5 }),
      }),
      { minLength: size, maxLength: size }
    )
  ).map(([ids, edgePairs, props]) => {
    // Filter edges: only allow from < to (ensures DAG)
    const validEdges = edgePairs.filter(([from, to]) => from < to);

    // Build dependency lists
    const deps: Map<string, string[]> = new Map();
    for (const id of ids) {
      deps.set(id, []);
    }
    for (const [fromIdx, toIdx] of validEdges) {
      const toId = ids[toIdx];
      const fromId = ids[fromIdx];
      const currentDeps = deps.get(toId) || [];
      if (!currentDeps.includes(fromId)) {
        currentDeps.push(fromId);
        deps.set(toId, currentDeps);
      }
    }

    // Build subtasks
    return ids.map((id, i) => ({
      id,
      parentId: 'root',
      description: props[i].description,
      priority: props[i].priority,
      complexityScore: props[i].complexityScore,
      dependencies: deps.get(id) || [],
      recommendedAgentType: props[i].recommendedAgentType,
      estimatedDuration: props[i].estimatedDuration,
      maxRetries: props[i].maxRetries,
    }));
  });
};

// =============================================================================
// Property Tests
// =============================================================================

describe('TaskDecomposer Property Tests', () => {
  const decomposer = new TaskDecomposer();

  // Property 28: DAG acyclicity invariant — dependency graphs always pass topological sort without cycles
  // Feature: autonomous-coding-agent, Property 28: DAG acyclicity invariant
  describe('Property 28: DAG acyclicity invariant', () => {
    it('dependency graphs produced by identifyDependencies always pass topological sort without cycles', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 15 }).chain((size) => dagSubTasksArb(size)),
          (subtasks) => {
            // identifyDependencies should succeed without throwing (no cycles)
            const graph = decomposer.identifyDependencies(subtasks);

            // Topological order must include all nodes
            expect(graph.topologicalOrder.length).toBe(subtasks.length);

            // Verify topological ordering: for every edge (from -> to),
            // 'from' must appear before 'to' in the topological order
            const orderIndex = new Map<string, number>();
            graph.topologicalOrder.forEach((id, idx) => {
              orderIndex.set(id, idx);
            });

            for (const edge of graph.edges) {
              const fromIdx = orderIndex.get(edge.from);
              const toIdx = orderIndex.get(edge.to);
              expect(fromIdx).toBeDefined();
              expect(toIdx).toBeDefined();
              expect(fromIdx!).toBeLessThan(toIdx!);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws an error when a cycle is introduced', () => {
      // Create a deliberate cycle: A -> B -> C -> A
      const cyclicSubtasks: SubTask[] = [
        {
          id: 'A',
          parentId: 'root',
          description: 'Task A',
          priority: 'medium',
          complexityScore: 3,
          dependencies: ['C'], // C -> A creates cycle
          recommendedAgentType: 'coding',
          estimatedDuration: 10000,
          maxRetries: 3,
        },
        {
          id: 'B',
          parentId: 'root',
          description: 'Task B',
          priority: 'medium',
          complexityScore: 3,
          dependencies: ['A'], // A -> B
          recommendedAgentType: 'coding',
          estimatedDuration: 10000,
          maxRetries: 3,
        },
        {
          id: 'C',
          parentId: 'root',
          description: 'Task C',
          priority: 'medium',
          complexityScore: 3,
          dependencies: ['B'], // B -> C
          recommendedAgentType: 'coding',
          estimatedDuration: 10000,
          maxRetries: 3,
        },
      ];

      expect(() => decomposer.identifyDependencies(cyclicSubtasks)).toThrow(
        /[Cc]ycle detected/
      );
    });
  });

  // Property 29: Leaf task complexity bound — all leaf tasks have complexity at or below single-agent threshold (7)
  // Feature: autonomous-coding-agent, Property 29: Leaf task complexity bound
  describe('Property 29: Leaf task complexity bound', () => {
    it('recursiveDecompose produces only leaf tasks with complexity <= 7', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.constant('test_task'),
            parentId: fc.constant('root'),
            description: fc.string({ minLength: 1, maxLength: 500 }),
            priority: priorityArb,
            complexityScore: fc.integer({ min: 1, max: 10 }),
            dependencies: fc.constant([] as string[]),
            recommendedAgentType: agentTypeArb,
            estimatedDuration: fc.integer({ min: 10000, max: 600000 }),
            maxRetries: fc.integer({ min: 1, max: 5 }),
          }),
          (subtask) => {
            const decomposed = decomposer.recursiveDecompose(subtask, 5);

            // All resulting tasks are leaf tasks
            expect(decomposed.length).toBeGreaterThan(0);

            // Every leaf task must have estimated complexity at or below 7
            for (const leaf of decomposed) {
              const complexity = decomposer.estimateComplexity(leaf);
              expect(complexity.overall).toBeLessThanOrEqual(7);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
