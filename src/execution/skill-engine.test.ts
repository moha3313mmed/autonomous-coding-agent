import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SkillEngine } from './skill-engine';
import { TaskRequirements, FailureAnalysis, SkillOutcome } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

/** Generates valid TaskRequirements with non-empty fields */
const taskRequirementsArb: fc.Arbitrary<TaskRequirements> = fc.record({
  taskDescription: fc.string({ minLength: 1, maxLength: 200 }),
  targetLanguage: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 20 }),
  domain: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 30 }),
  constraints: fc.array(
    fc.record({
      type: fc.string({ minLength: 1 }),
      description: fc.string({ minLength: 1 }),
      priority: fc.constantFrom('critical', 'high', 'medium', 'low') as fc.Arbitrary<'critical' | 'high' | 'medium' | 'low'>,
      enforceable: fc.boolean(),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  exampleInputs: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 3 }),
  expectedBehavior: fc.string({ minLength: 1, maxLength: 200 }),
});

/** Generates a valid FailureAnalysis for skill refinement */
const failureAnalysisArb = (skillId: string): fc.Arbitrary<FailureAnalysis> =>
  fc.record({
    skillId: fc.constant(skillId),
    failureType: fc.string({ minLength: 1, maxLength: 50 }),
    rootCause: fc.string({ minLength: 1, maxLength: 100 }),
    context: fc.string({ minLength: 1, maxLength: 200 }),
    suggestedImprovement: fc.string({ minLength: 1, maxLength: 200 }),
    affectedInputPatterns: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
  });

/** Generates a successful SkillOutcome */
const successOutcomeArb: fc.Arbitrary<SkillOutcome> = fc.record({
  success: fc.constant(true),
  context: fc.string({ minLength: 1 }),
  executionTime: fc.integer({ min: 1, max: 10000 }),
  userFeedback: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
});

// =============================================================================
// Property Tests
// =============================================================================

describe('SkillEngine - Property Tests', () => {
  // Feature: autonomous-coding-agent, Property 1: Skill generation produces valid modules
  describe('Property 1: Skill generation produces valid modules', () => {
    it('generated skills have non-empty name, description, categories, valid template, and initial confidence', async () => {
      await fc.assert(
        fc.asyncProperty(taskRequirementsArb, async (requirements) => {
          const engine = new SkillEngine();
          const skill = await engine.generateSkill(requirements);

          // Non-empty name
          expect(skill.name).toBeDefined();
          expect(skill.name.length).toBeGreaterThan(0);

          // Non-empty description
          expect(skill.description).toBeDefined();
          expect(skill.description.length).toBeGreaterThan(0);

          // At least one category
          expect(skill.categories).toBeDefined();
          expect(skill.categories.length).toBeGreaterThanOrEqual(1);

          // Valid solutionTemplate (non-empty)
          expect(skill.solutionTemplate).toBeDefined();
          expect(skill.solutionTemplate.length).toBeGreaterThan(0);

          // Initial confidence score of 0.1
          expect(skill.confidenceScore).toBe(0.1);

          // Version starts at 1
          expect(skill.version).toBe(1);

          // Usage count starts at 0
          expect(skill.usageCount).toBe(0);

          // Has valid timestamps
          expect(skill.createdAt).toBeGreaterThan(0);
          expect(skill.updatedAt).toBeGreaterThan(0);

          // Has version history with at least one entry
          expect(skill.versionHistory.length).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 2: Skill persistence round-trip
  describe('Property 2: Skill persistence round-trip', () => {
    it('persisted skills are retrievable with all metadata intact', async () => {
      await fc.assert(
        fc.asyncProperty(taskRequirementsArb, async (requirements) => {
          const engine = new SkillEngine();
          const generatedSkill = await engine.generateSkill(requirements);

          // Record a successful usage to increase confidence above default minConfidence (0.5)
          // First bring confidence up so findSkill can find it
          for (let i = 0; i < 5; i++) {
            await engine.recordUsage(generatedSkill.id, {
              success: true,
              context: 'test',
              executionTime: 100,
            });
          }

          // Retrieve by category (the first category was derived from domain)
          const retrieved = await engine.findSkill({
            taskCategory: requirements.domain,
            language: requirements.targetLanguage,
            minConfidence: 0.1,
          });

          // Should find the skill
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(generatedSkill.id);
          expect(retrieved!.name).toBe(generatedSkill.name);
          expect(retrieved!.description).toBe(generatedSkill.description);
          expect(retrieved!.categories).toEqual(generatedSkill.categories);
          expect(retrieved!.programmingLanguages).toEqual(generatedSkill.programmingLanguages);
          expect(retrieved!.createdAt).toBe(generatedSkill.createdAt);
          expect(retrieved!.versionHistory.length).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 3: Skill confidence monotonically increases on success
  describe('Property 3: Skill confidence monotonically increases on success', () => {
    it('confidence C\' > C after recording a successful outcome', async () => {
      await fc.assert(
        fc.asyncProperty(taskRequirementsArb, successOutcomeArb, async (requirements, outcome) => {
          const engine = new SkillEngine();
          const skill = await engine.generateSkill(requirements);

          const confidenceBefore = skill.confidenceScore;

          await engine.recordUsage(skill.id, outcome);

          // Re-fetch the skill through search to verify the updated confidence
          const results = await engine.searchSkills({
            categories: skill.categories,
            minConfidence: 0,
          });

          const updatedSkill = results.find((s) => s.id === skill.id);
          expect(updatedSkill).toBeDefined();
          expect(updatedSkill!.confidenceScore).toBeGreaterThan(confidenceBefore);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 4: Skill refinement on failure
  describe('Property 4: Skill refinement on failure', () => {
    it('new version number is strictly greater than previous after refinement', async () => {
      await fc.assert(
        fc.asyncProperty(taskRequirementsArb, async (requirements) => {
          const engine = new SkillEngine();
          const skill = await engine.generateSkill(requirements);

          const versionBefore = skill.version;

          // Generate failure analysis for refinement
          const failureAnalysis: FailureAnalysis = {
            skillId: skill.id,
            failureType: 'logic_error',
            rootCause: 'Missing edge case handling',
            context: 'Test context',
            suggestedImprovement: 'Add boundary checks',
            affectedInputPatterns: ['empty input', 'null values'],
          };

          const refinedSkill = await engine.refineSkill(skill.id, failureAnalysis);

          // Version number must be strictly greater
          expect(refinedSkill.version).toBeGreaterThan(versionBefore);

          // Version history should have grown
          expect(refinedSkill.versionHistory.length).toBeGreaterThan(1);

          // The latest version entry should reference the failure analysis
          const latestVersion = refinedSkill.versionHistory[refinedSkill.versionHistory.length - 1];
          expect(latestVersion.version).toBe(refinedSkill.version);
          expect(latestVersion.refinementSource).toBe('failure_analysis');
        }),
        { numRuns: 100 }
      );
    });
  });
});
