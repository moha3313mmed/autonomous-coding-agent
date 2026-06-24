import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FeedbackLoop } from './feedback-loop';
import { UserCorrection } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

/** Generates a valid UserCorrection where original differs from corrected */
const userCorrectionArb: fc.Arbitrary<UserCorrection> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
  )
  .filter(([original, corrected]) => original !== corrected)
  .map(([originalOutput, correctedOutput, explanation, affectedSkillId]) => ({
    originalOutput,
    correctedOutput,
    explanation,
    affectedSkillId,
  }));

/** Generates a category name */
const categoryArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
  { minLength: 2, maxLength: 20 }
);

/** Generates acceptance/rejection feedback data for a category */
const feedbackSeriesArb = fc.tuple(
  categoryArb,
  fc.array(fc.boolean(), { minLength: 1, maxLength: 20 })
);

/** Generates a series of corrections with the same patternType (to test recurring patterns) */
const recurringCorrectionsArb: fc.Arbitrary<UserCorrection[]> = fc
  .tuple(
    fc.string({ minLength: 5, maxLength: 50 }), // base original
    fc.string({ minLength: 5, maxLength: 50 })  // base corrected (different length for consistent patternType)
  )
  .filter(([orig, corr]) => orig.length !== corr.length && orig !== corr)
  .chain(([baseOriginal, baseCorrected]) =>
    fc.array(
      fc.tuple(
        fc.string({ minLength: 0, maxLength: 10 }),
        fc.string({ minLength: 0, maxLength: 10 }),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
      ).map(([suffixOrig, suffixCorr, explanation, affectedSkillId]) => ({
        originalOutput: baseOriginal + suffixOrig,
        correctedOutput: baseCorrected + suffixCorr,
        explanation,
        affectedSkillId,
      })),
      { minLength: 3, maxLength: 6 }
    )
    // Ensure all have consistent length difference pattern
    .filter((corrections) => {
      if (corrections.length < 3) return false;
      // All corrections should produce the same patternType
      const firstOrigLen = corrections[0].originalOutput.length;
      const firstCorrLen = corrections[0].correctedOutput.length;
      const firstPattern = firstCorrLen > firstOrigLen ? 'incomplete_output' : 'verbose_output';
      return corrections.every((c) => {
        const pattern = c.correctedOutput.length > c.originalOutput.length ? 'incomplete_output' : 'verbose_output';
        return pattern === firstPattern;
      });
    })
  );

// =============================================================================
// Property Tests
// =============================================================================

describe('FeedbackLoop - Property Tests', () => {
  // Feature: autonomous-coding-agent, Property 23: Feedback pattern extraction
  describe('Property 23: Feedback pattern extraction', () => {
    it('corrections produce patterns with non-empty rootCause and at least one affectedCategory', () => {
      fc.assert(
        fc.property(userCorrectionArb, (correction) => {
          const loop = new FeedbackLoop();
          const pattern = loop.extractCorrectionPattern(correction);

          // rootCause must be non-empty
          expect(pattern.rootCause).toBeDefined();
          expect(pattern.rootCause.length).toBeGreaterThan(0);

          // affectedCategories must have at least one entry
          expect(pattern.affectedCategories).toBeDefined();
          expect(pattern.affectedCategories.length).toBeGreaterThanOrEqual(1);

          // Each affected category should be non-empty
          for (const category of pattern.affectedCategories) {
            expect(category.length).toBeGreaterThan(0);
          }

          // patternType must be non-empty
          expect(pattern.patternType).toBeDefined();
          expect(pattern.patternType.length).toBeGreaterThan(0);

          // suggestedFix must be non-empty
          expect(pattern.suggestedFix).toBeDefined();
          expect(pattern.suggestedFix.length).toBeGreaterThan(0);

          // frequency must be positive
          expect(pattern.frequency).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 24: Acceptance rate flagging threshold
  describe('Property 24: Acceptance rate flagging threshold', () => {
    it('categories with acceptance rate below 70% appear in the flagged list', async () => {
      await fc.assert(
        fc.asyncProperty(feedbackSeriesArb, async ([category, acceptanceResults]) => {
          const loop = new FeedbackLoop();

          // Record implicit feedback for the category
          for (const accepted of acceptanceResults) {
            await loop.recordImplicitFeedback(category, accepted);
          }

          const acceptanceRate = loop.getAcceptanceRate(category);
          const flaggedCategories = loop.getFlaggedCategories();

          if (acceptanceRate < 0.7) {
            // Category should be flagged when acceptance rate is below 70%
            expect(flaggedCategories).toContain(category);
          } else {
            // Category should NOT be flagged when acceptance rate is at or above 70%
            expect(flaggedCategories).not.toContain(category);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('acceptance rate is correctly computed from the rolling window', async () => {
      await fc.assert(
        fc.asyncProperty(feedbackSeriesArb, async ([category, acceptanceResults]) => {
          const loop = new FeedbackLoop();

          // Record all feedback
          for (const accepted of acceptanceResults) {
            await loop.recordImplicitFeedback(category, accepted);
          }

          const rate = loop.getAcceptanceRate(category);

          // Rate should be between 0 and 1
          expect(rate).toBeGreaterThanOrEqual(0.0);
          expect(rate).toBeLessThanOrEqual(1.0);

          // Compute expected rate from the last 20 entries
          const window = acceptanceResults.slice(-20);
          const expectedRate = window.filter((a) => a).length / window.length;
          expect(rate).toBeCloseTo(expectedRate, 5);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 25: Recurring pattern rule generation
  describe('Property 25: Recurring pattern rule generation', () => {
    it('3+ occurrences of the same pattern type generate a QualityRule', async () => {
      await fc.assert(
        fc.asyncProperty(recurringCorrectionsArb, async (corrections) => {
          const loop = new FeedbackLoop();

          // Record explicit feedback for each correction
          for (let i = 0; i < corrections.length; i++) {
            await loop.recordExplicitFeedback(`task_${i}`, corrections[i]);
          }

          // Detect recurring patterns
          const recurringPatterns = loop.detectRecurringPatterns();

          // Should find at least one recurring pattern (since we have 3+ of same type)
          expect(recurringPatterns.length).toBeGreaterThanOrEqual(1);

          // Each recurring pattern should have 3+ occurrences
          for (const recurring of recurringPatterns) {
            expect(recurring.occurrences).toBeGreaterThanOrEqual(3);
            expect(recurring.categories.length).toBeGreaterThan(0);
            expect(recurring.generalizableRule.length).toBeGreaterThan(0);
            expect(recurring.examples.length).toBeGreaterThanOrEqual(3);

            // Generate a rule from the recurring pattern
            const rule = loop.generateRule(recurring);

            // Rule should be valid
            expect(rule.id).toBeDefined();
            expect(rule.id.length).toBeGreaterThan(0);
            expect(rule.name).toBeDefined();
            expect(rule.name.length).toBeGreaterThan(0);
            expect(rule.description).toBeDefined();
            expect(rule.description.length).toBeGreaterThan(0);
            expect(rule.pattern).toBe(recurring);
            expect(rule.appliesTo.length).toBeGreaterThan(0);
            expect(rule.createdAt).toBeGreaterThan(0);

            // Enforcement should be either 'error' or 'warning'
            expect(['error', 'warning', 'suggestion']).toContain(rule.enforcement);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
