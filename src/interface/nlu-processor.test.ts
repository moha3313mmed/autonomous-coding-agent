// Feature: autonomous-coding-agent
// Task 8.2: Property tests for NLU_Processor

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NLUProcessor } from './nlu-processor';
import { ActionType, StructuredIntent } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

const ALL_ACTION_TYPES: ActionType[] = [
  'create',
  'modify',
  'refactor',
  'fix',
  'test',
  'document',
  'deploy',
  'analyze',
];

/**
 * Generates non-empty strings simulating natural language task descriptions.
 */
const naturalLanguageInputArb: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyz '.split('')
  ),
  { minLength: 3, maxLength: 200 }
).filter((s) => s.trim().length > 0);

/**
 * Generates input strings that contain known action keywords.
 */
const actionKeywordInputArb = (actionType: ActionType): fc.Arbitrary<string> => {
  const keywords: Record<ActionType, string[]> = {
    create: ['create', 'add', 'new', 'generate', 'build', 'make', 'implement'],
    modify: ['modify', 'change', 'update', 'edit', 'alter'],
    refactor: ['refactor', 'restructure', 'reorganize', 'clean', 'simplify'],
    fix: ['fix', 'repair', 'resolve', 'debug', 'patch', 'correct'],
    test: ['test', 'verify', 'validate', 'check'],
    document: ['document', 'describe', 'explain', 'comment', 'annotate'],
    deploy: ['deploy', 'release', 'publish', 'ship', 'launch'],
    analyze: ['analyze', 'inspect', 'review', 'audit', 'examine'],
  };

  return fc.tuple(
    fc.constantFrom(...keywords[actionType]),
    fc.string({ minLength: 3, maxLength: 100 })
  ).map(([keyword, rest]) => `${keyword} ${rest}`);
};

/**
 * Generates equivalent descriptions in different phrasings for same intent.
 * We use action keywords to represent cross-language normalization.
 */
const equivalentDescriptionPairArb: fc.Arbitrary<{
  inputA: string;
  inputB: string;
  expectedAction: ActionType;
}> = fc.constantFrom(...ALL_ACTION_TYPES).chain((actionType) => {
  const keywords: Record<ActionType, string[]> = {
    create: ['create', 'add', 'new', 'generate', 'build', 'make', 'implement'],
    modify: ['modify', 'change', 'update', 'edit', 'alter'],
    refactor: ['refactor', 'restructure', 'reorganize', 'clean', 'simplify'],
    fix: ['fix', 'repair', 'resolve', 'debug', 'patch', 'correct'],
    test: ['test', 'verify', 'validate', 'check'],
    document: ['document', 'describe', 'explain', 'comment', 'annotate'],
    deploy: ['deploy', 'release', 'publish', 'ship', 'launch'],
    analyze: ['analyze', 'inspect', 'review', 'audit', 'examine'],
  };

  const actionKeywords = keywords[actionType];

  return fc.tuple(
    fc.constantFrom(...actionKeywords),
    fc.constantFrom(...actionKeywords),
    fc.string({ minLength: 3, maxLength: 50 })
  )
    .filter(([kw1, kw2]) => kw1 !== kw2)
    .map(([keyword1, keyword2, target]) => ({
      inputA: `${keyword1} a new function in ${target}`,
      inputB: `${keyword2} a new function in ${target}`,
      expectedAction: actionType,
    }));
});

/**
 * Generates input strings containing contradictory term pairs.
 */
const contradictoryInputArb: fc.Arbitrary<string> = fc.constantFrom(
  ...[
    ['sync', 'async'],
    ['public', 'private'],
    ['add', 'remove'],
    ['create', 'delete'],
    ['enable', 'disable'],
    ['mutable', 'immutable'],
    ['optional', 'required'],
  ] as const
).chain(([termA, termB]) =>
  fc.string({ minLength: 3, maxLength: 50 }).map(
    (middle) => `make it ${termA} and also ${termB} with ${middle}`
  )
);

// =============================================================================
// Property Tests
// =============================================================================

describe('NLUProcessor Property Tests', () => {
  const processor = new NLUProcessor();

  // Property 33: NLU structured intent extraction
  // Feature: autonomous-coding-agent, Property 33: NLU structured intent extraction
  describe('Property 33: NLU structured intent extraction', () => {
    it('non-empty input produces valid actionType, non-null targetScope, confidence in [0,1]', () => {
      fc.assert(
        fc.property(naturalLanguageInputArb, async (input) => {
          const intent = await processor.parseInstruction(input);

          // actionType must be a valid ActionType
          expect(ALL_ACTION_TYPES).toContain(intent.actionType);

          // targetScope must not be null/undefined
          expect(intent.targetScope).toBeDefined();
          expect(intent.targetScope).not.toBeNull();
          expect(intent.targetScope.scope).toBeDefined();

          // confidence must be in [0, 1]
          expect(intent.confidence).toBeGreaterThanOrEqual(0);
          expect(intent.confidence).toBeLessThanOrEqual(1);

          // rawInput should preserve the trimmed input
          expect(intent.rawInput).toBe(input.trim());

          // language should be a non-empty string
          expect(intent.language.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Property 34: Cross-language intent normalization
  // Feature: autonomous-coding-agent, Property 34: Cross-language intent normalization
  describe('Property 34: Cross-language intent normalization', () => {
    it('equivalent descriptions using different keywords for the same action produce same actionType', () => {
      fc.assert(
        fc.property(equivalentDescriptionPairArb, async ({ inputA, inputB, expectedAction }) => {
          const intentA = await processor.parseInstruction(inputA);
          const intentB = await processor.parseInstruction(inputB);

          // Both should resolve to the same action type
          expect(intentA.actionType).toBe(expectedAction);
          expect(intentB.actionType).toBe(expectedAction);

          // Both should produce the same actionType
          expect(intentA.actionType).toBe(intentB.actionType);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Property 35: Contradiction detection
  // Feature: autonomous-coding-agent, Property 35: Contradiction detection
  describe('Property 35: Contradiction detection', () => {
    it('mutually exclusive requirements are detected as contradictions', () => {
      fc.assert(
        fc.property(contradictoryInputArb, async (input) => {
          const intent = await processor.parseInstruction(input);
          const contradictions = processor.detectContradictions(intent);

          // At least one contradiction should be detected
          expect(contradictions.length).toBeGreaterThan(0);

          // Each contradiction should have the required fields
          for (const contradiction of contradictions) {
            expect(contradiction.field).toBeDefined();
            expect(contradiction.conflictA.length).toBeGreaterThan(0);
            expect(contradiction.conflictB.length).toBeGreaterThan(0);
            expect(contradiction.description.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
