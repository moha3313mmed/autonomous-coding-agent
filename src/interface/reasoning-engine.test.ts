// Feature: autonomous-coding-agent
// Task 8.4: Property tests for Reasoning_Engine

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ReasoningEngine, ReasoningProblem, ReasoningChain } from './reasoning-engine';
import { Constraint, Priority } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

const priorityArb: fc.Arbitrary<Priority> = fc.constantFrom(
  'critical',
  'high',
  'medium',
  'low'
);

/**
 * Generates a valid Constraint.
 */
const constraintArb: fc.Arbitrary<Constraint> = fc.record({
  type: fc.constantFrom('performance', 'compatibility', 'security', 'style', 'testing'),
  description: fc.string({ minLength: 5, maxLength: 100 }),
  priority: priorityArb,
  enforceable: fc.boolean(),
});

/**
 * Generates a ReasoningProblem with configurable numbers of constraints and goals.
 */
const reasoningProblemArb = (
  minConstraints: number,
  maxConstraints: number,
  minGoals: number,
  maxGoals: number
): fc.Arbitrary<ReasoningProblem> =>
  fc.record({
    description: fc.string({ minLength: 10, maxLength: 200 }),
    constraints: fc.array(constraintArb, {
      minLength: minConstraints,
      maxLength: maxConstraints,
    }),
    context: fc.string({ minLength: 5, maxLength: 100 }),
    projectGoals: fc.array(fc.string({ minLength: 5, maxLength: 80 }), {
      minLength: minGoals,
      maxLength: maxGoals,
    }),
  });

/**
 * Generates a ReasoningProblem that will produce more than 10 steps.
 * This requires enough constraints (each generates a step) plus decomposition,
 * alternatives, and justification steps.
 * With 8+ constraints + 1 decomposition + 3 alternatives + 1 justification = 13+ steps.
 */
const largeReasoningProblemArb: fc.Arbitrary<ReasoningProblem> =
  reasoningProblemArb(8, 15, 2, 5);

// =============================================================================
// Property Tests
// =============================================================================

describe('ReasoningEngine Property Tests', () => {
  const engine = new ReasoningEngine();

  // Property 12: Reasoning chain structural completeness
  // Feature: autonomous-coding-agent, Property 12: Reasoning chain structural completeness
  describe('Property 12: Reasoning chain structural completeness', () => {
    it('chains contain decomposition, constraint identification, alternative evaluation, and decision justification', () => {
      fc.assert(
        fc.property(
          reasoningProblemArb(1, 5, 1, 4),
          async (problem) => {
            const chain = await engine.generateReasoningChain(problem);

            // Chain should have steps
            expect(chain.steps.length).toBeGreaterThan(0);

            // Collect all step types present in the chain
            const stepTypes = new Set(chain.steps.map((s) => s.type));

            // Must contain decomposition step
            expect(stepTypes.has('decomposition')).toBe(true);

            // Must contain constraint_identification step (if constraints exist)
            if (problem.constraints.length > 0) {
              expect(stepTypes.has('constraint_identification')).toBe(true);
            }

            // Must contain alternative_evaluation step (when goals exist)
            if (problem.projectGoals.length > 0) {
              expect(stepTypes.has('alternative_evaluation')).toBe(true);
            }

            // Must contain decision_justification step
            expect(stepTypes.has('decision_justification')).toBe(true);

            // Chain must have a non-empty conclusion
            expect(chain.conclusion.length).toBeGreaterThan(0);

            // Confidence score must be in [0, 1]
            expect(chain.confidenceScore).toBeGreaterThanOrEqual(0);
            expect(chain.confidenceScore).toBeLessThanOrEqual(1);

            // Steps should be ordered by stepIndex
            for (let i = 1; i < chain.steps.length; i++) {
              expect(chain.steps[i].stepIndex).toBeGreaterThan(
                chain.steps[i - 1].stepIndex
              );
            }

            // Chain should have a valid id
            expect(chain.id.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 13: Reasoning chain checkpoint invariant
  // Feature: autonomous-coding-agent, Property 13: Reasoning chain checkpoint invariant
  describe('Property 13: Reasoning chain checkpoint invariant', () => {
    it('traces with more than 10 steps have at least one checkpoint', () => {
      fc.assert(
        fc.property(largeReasoningProblemArb, async (problem) => {
          const chain = await engine.generateReasoningChain(problem);

          if (chain.steps.length > 10) {
            // Must have at least one checkpoint
            expect(chain.checkpoints.length).toBeGreaterThanOrEqual(1);

            // Each checkpoint should reference a valid step index
            for (const checkpoint of chain.checkpoints) {
              expect(checkpoint.afterStep).toBeGreaterThan(0);
              expect(checkpoint.afterStep).toBeLessThan(chain.steps.length);

              // Checkpoint should have a current sub-problem description
              expect(checkpoint.currentSubProblem.length).toBeGreaterThan(0);

              // resolvedConstraints and unresolvedConstraints should be arrays
              expect(Array.isArray(checkpoint.resolvedConstraints)).toBe(true);
              expect(Array.isArray(checkpoint.unresolvedConstraints)).toBe(true);

              // conclusionsSoFar should be an array
              expect(Array.isArray(checkpoint.conclusionsSoFar)).toBe(true);
            }
          }

          // If steps <= 10, no checkpoint requirement (but may still have one
          // if the engine inserts a final checkpoint)
          if (chain.steps.length <= 10) {
            // No assertion needed - checkpoints are optional for short chains
            expect(true).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
