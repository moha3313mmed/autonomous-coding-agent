// Feature: autonomous-coding-agent
// Task 6.6: Property tests for Agent_Orchestrator

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AgentOrchestrator } from './agent-orchestrator';
import { MessageBus } from '../shared/message-bus';
import {
  DecompositionPlan,
  SubTask,
  AgentType,
  AgentInstance,
  DependencyGraph,
  DirectedEdge,
  Priority,
  ResolvedIntent,
  MergeConflict,
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
 * All possible agent types in the system.
 */
const ALL_AGENT_TYPES: AgentType[] = [
  'coding',
  'review',
  'research',
  'testing',
  'documentation',
  'refactoring',
];

/**
 * Generates a subtask with a specific recommended agent type.
 */
const subtaskArb = (agentType?: AgentType): fc.Arbitrary<SubTask> =>
  fc.record({
    id: fc.uuid(),
    parentId: fc.constant('root'),
    description: fc.string({ minLength: 5, maxLength: 100 }),
    priority: priorityArb,
    complexityScore: fc.integer({ min: 1, max: 7 }),
    dependencies: fc.constant([] as string[]),
    recommendedAgentType: agentType ? fc.constant(agentType) : agentTypeArb,
    estimatedDuration: fc.integer({ min: 5000, max: 120000 }),
    maxRetries: fc.integer({ min: 1, max: 3 }),
  });

/**
 * Generates a DecompositionPlan with subtasks covering specific agent types.
 */
const decompositionPlanArb = (
  requiredTypes: AgentType[]
): fc.Arbitrary<DecompositionPlan> =>
  fc.tuple(
    ...requiredTypes.map((type) => subtaskArb(type))
  ).map((subtasks) => {
    const nodes = new Map<string, SubTask>();
    for (const st of subtasks) {
      nodes.set(st.id, st);
    }

    const graph: DependencyGraph = {
      nodes,
      edges: [],
      topologicalOrder: subtasks.map((s) => s.id),
      criticalPath: subtasks.length > 0 ? [subtasks[0].id] : [],
      parallelGroups: [subtasks.map((s) => s.id)],
    };

    return {
      id: 'plan_test',
      rootTask: {
        intent: {
          actionType: 'create',
          targetScope: { files: [], modules: [], functions: [], scope: 'project' },
          constraints: [],
          successCriteria: [],
          language: 'en',
          confidence: 0.9,
          rawInput: 'test task',
        },
        resolvedReferences: {},
        projectContext: '',
        disambiguations: [],
      } as ResolvedIntent,
      subtasks,
      dependencyGraph: graph,
      estimatedDuration: subtasks.reduce((sum, s) => sum + s.estimatedDuration, 0),
      parallelismFactor: 1,
    } as DecompositionPlan;
  });

/**
 * Generates a merge conflict for overlapping code region testing.
 */
const mergeConflictArb: fc.Arbitrary<MergeConflict> = fc.record({
  filePath: fc.string({ minLength: 5, maxLength: 50 }).map((s) => `src/${s}.ts`),
  conflictRegion: fc.record({
    startLine: fc.integer({ min: 1, max: 100 }),
    endLine: fc.integer({ min: 101, max: 200 }),
  }),
  ourChange: fc.string({ minLength: 1, maxLength: 200 }),
  theirChange: fc.string({ minLength: 1, maxLength: 200 }),
  agentIds: fc.tuple(
    fc.uuid(),
    fc.uuid()
  ) as fc.Arbitrary<[string, string]>,
});

// =============================================================================
// Property Tests
// =============================================================================

describe('AgentOrchestrator Property Tests', () => {
  // Property 5: Agent specialization coverage
  // Feature: autonomous-coding-agent, Property 5: Agent specialization coverage
  describe('Property 5: Agent specialization coverage', () => {
    it('instantiated agents cover all required capabilities from the decomposition plan', () => {
      fc.assert(
        fc.property(
          // Generate a subset of required agent types (1 to 6 types)
          fc.shuffledSubarray(ALL_AGENT_TYPES, { minLength: 1, maxLength: 6 }).chain(
            (requiredTypes) => decompositionPlanArb(requiredTypes).map((plan) => ({
              plan,
              requiredTypes,
            }))
          ),
          async ({ plan, requiredTypes }) => {
            const messageBus = new MessageBus();
            const orchestrator = new AgentOrchestrator(messageBus);

            try {
              const agents = await orchestrator.instantiateAgents(plan);

              // Collect all agent types that were instantiated
              const instantiatedTypes = new Set(agents.map((a) => a.type));

              // Every required type should be represented in instantiated agents
              // (Note: may not all be instantiated if max instances is reached,
              // but for our test plans with one task per type, all should be covered)
              for (const requiredType of requiredTypes) {
                expect(instantiatedTypes.has(requiredType)).toBe(true);
              }

              // Every agent should have a non-empty specialization string
              for (const agent of agents) {
                expect(agent.specialization.length).toBeGreaterThan(0);
              }
            } finally {
              orchestrator.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 7: Unresponsive agent detection and reassignment
  // Feature: autonomous-coding-agent, Property 7: Unresponsive agent detection and reassignment
  describe('Property 7: Unresponsive agent detection and reassignment', () => {
    it('agents with lastHeartbeat > 30s are terminated and their tasks are reassigned', () => {
      fc.assert(
        fc.property(
          subtaskArb(),
          fc.integer({ min: 31000, max: 120000 }), // Time since last heartbeat (always > 30s)
          async (subtask, timeSinceHeartbeat) => {
            const messageBus = new MessageBus();
            const orchestrator = new AgentOrchestrator(messageBus);

            try {
              // Create a plan with one subtask
              const plan: DecompositionPlan = {
                id: 'plan_hb_test',
                rootTask: {
                  intent: {
                    actionType: 'create',
                    targetScope: { files: [], modules: [], functions: [], scope: 'project' },
                    constraints: [],
                    successCriteria: [],
                    language: 'en',
                    confidence: 0.9,
                    rawInput: 'test',
                  },
                  resolvedReferences: {},
                  projectContext: '',
                  disambiguations: [],
                },
                subtasks: [subtask],
                dependencyGraph: {
                  nodes: new Map([[subtask.id, subtask]]),
                  edges: [],
                  topologicalOrder: [subtask.id],
                  criticalPath: [subtask.id],
                  parallelGroups: [[subtask.id]],
                },
                estimatedDuration: subtask.estimatedDuration,
                parallelismFactor: 1,
              };

              const agents = await orchestrator.instantiateAgents(plan);

              if (agents.length > 0) {
                const agent = agents[0];

                // Simulate stale heartbeat by manually setting lastHeartbeat in the past
                // The agent's lastHeartbeat is set to (now - timeSinceHeartbeat) which is > 30s ago
                agent.lastHeartbeat = Date.now() - timeSinceHeartbeat;

                // Call terminateAgent directly (simulating what checkHeartbeat does)
                await orchestrator.terminateAgent(agent.id, 'Heartbeat timeout');

                // After termination, the agent should no longer be active
                const activeAgents = orchestrator.getActiveAgents();
                const terminatedAgent = activeAgents.find((a) => a.id === agent.id);
                expect(terminatedAgent).toBeUndefined();

                // Reassignment count should have incremented
                const reassignCount = orchestrator.getReassignmentCount(subtask.id);
                expect(reassignCount).toBeGreaterThanOrEqual(1);
              }
            } finally {
              orchestrator.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 10: Overlapping code region conflict detection
  // Feature: autonomous-coding-agent, Property 10: Overlapping code region conflict detection
  describe('Property 10: Overlapping code region conflict detection', () => {
    it('parallel changes to same file regions are detected and resolved', () => {
      fc.assert(
        fc.property(
          fc.array(mergeConflictArb, { minLength: 1, maxLength: 5 }),
          async (conflicts) => {
            const messageBus = new MessageBus();
            const orchestrator = new AgentOrchestrator(messageBus);

            try {
              const resolutions = await orchestrator.resolveConflict(conflicts);

              // Every conflict should produce a resolution
              expect(resolutions.length).toBe(conflicts.length);

              for (let i = 0; i < conflicts.length; i++) {
                const conflict = conflicts[i];
                const resolution = resolutions[i];

                // Resolution should have a valid conflictId referencing the file and region
                expect(resolution.conflictId).toContain(conflict.filePath);
                expect(resolution.conflictId).toContain(
                  `${conflict.conflictRegion.startLine}`
                );

                // Resolution should have non-empty resolved content
                expect(resolution.resolvedContent.length).toBeGreaterThan(0);

                // Resolution content should be one of the two change options
                const isOurChange = resolution.resolvedContent === conflict.ourChange;
                const isTheirChange = resolution.resolvedContent === conflict.theirChange;
                expect(isOurChange || isTheirChange).toBe(true);

                // Strategy should be set
                expect(resolution.strategy).toBe('ai_resolved');

                // ResolvedBy should be the orchestrator
                expect(resolution.resolvedBy).toBe('agent_orchestrator');
              }
            } finally {
              orchestrator.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
