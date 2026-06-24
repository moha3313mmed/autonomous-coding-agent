import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { QualityAssurer } from './quality-assurer';
import { CodeOutput, CodingStandards, QualityIssue } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

/** Generates code that contains at least one quality issue (e.g., uses 'any' type) */
const codeWithAnyTypeArb: fc.Arbitrary<CodeOutput> = fc.record({
  filePath: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/'.split('')), { minLength: 3, maxLength: 50 }).map((s) => `src/${s}.ts`),
  content: fc.string({ minLength: 1, maxLength: 100 }).map(
    (prefix) => `${prefix}\nconst value: any = getData();\nfunction process() {\n  return value;\n}\n`
  ),
  language: fc.constant('typescript'),
  agentId: fc.string({ minLength: 1, maxLength: 20 }),
  taskId: fc.string({ minLength: 1, maxLength: 20 }),
});

/** Generates code that violates naming conventions (class names not PascalCase) */
const codeWithNamingViolationArb: fc.Arbitrary<CodeOutput> = fc.record({
  filePath: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/'.split('')), { minLength: 3, maxLength: 50 }).map((s) => `src/${s}.ts`),
  content: fc.tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 15 })
  ).map(([name]) => {
    // Create a class with a lowercase name (violates PascalCase convention)
    const badClassName = name.toLowerCase();
    return `export class ${badClassName} {\n  constructor() {}\n  run(): void {\n    console.log('running');\n  }\n}\n`;
  }),
  language: fc.constant('typescript'),
  agentId: fc.string({ minLength: 1, maxLength: 20 }),
  taskId: fc.string({ minLength: 1, maxLength: 20 }),
});

/** Generates valid CodingStandards configuration */
const codingStandardsArb: fc.Arbitrary<CodingStandards> = fc.record({
  namingConventions: fc.constant({ class: 'PascalCase', variable: 'camelCase', constant: 'UPPER_CASE' }),
  documentationRequirements: fc.constant(['JSDoc for public functions', 'README for modules']),
  architecturalPatterns: fc.constant(['single responsibility', 'dependency injection']),
  lintRules: fc.constant({ semi: 'error', 'no-unused-vars': 'warn' }),
  maxComplexity: fc.integer({ min: 5, max: 20 }),
});

/** Generates arbitrary QualityIssue objects to test remediation completeness */
const qualityIssueArb: fc.Arbitrary<QualityIssue> = fc.record({
  severity: fc.constantFrom('error', 'warning', 'info') as fc.Arbitrary<'error' | 'warning' | 'info'>,
  category: fc.constantFrom('lint', 'type', 'pattern', 'security', 'performance') as fc.Arbitrary<'lint' | 'type' | 'pattern' | 'security' | 'performance'>,
  location: fc.record({
    filePath: fc.string({ minLength: 3, maxLength: 50 }).map((s) => `src/${s}.ts`),
    startLine: fc.integer({ min: 1, max: 500 }),
    endLine: fc.integer({ min: 1, max: 500 }),
  }),
  message: fc.string({ minLength: 1, maxLength: 200 }),
  remediation: fc.string({ minLength: 0, maxLength: 200 }),
  autoFixable: fc.boolean(),
});

// =============================================================================
// Property Tests
// =============================================================================

describe('QualityAssurer - Property Tests', () => {
  // Feature: autonomous-coding-agent, Property 26: Quality issue remediation completeness
  describe('Property 26: Quality issue remediation completeness', () => {
    it('every quality issue detected has a non-empty remediation', async () => {
      await fc.assert(
        fc.asyncProperty(codeWithAnyTypeArb, codingStandardsArb, async (code, standards) => {
          const assurer = new QualityAssurer();
          const result = await assurer.reviewCode(code, standards);

          // Every issue in the result should have a non-empty remediation field
          for (const issue of result.issues) {
            expect(issue.remediation).toBeDefined();
            expect(issue.remediation.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('generateRemediation produces non-empty remediation for every issue', () => {
      fc.assert(
        fc.property(fc.array(qualityIssueArb, { minLength: 1, maxLength: 10 }), (issues) => {
          const assurer = new QualityAssurer();
          const remediations = assurer.generateRemediation(issues);

          // Should produce a remediation for every issue
          expect(remediations.length).toBe(issues.length);

          // Every remediation should be non-empty
          for (const remediation of remediations) {
            expect(remediation).toBeDefined();
            expect(remediation.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 27: Coding standards enforcement
  describe('Property 27: Coding standards enforcement', () => {
    it('code violating naming conventions produces failure results', async () => {
      await fc.assert(
        fc.asyncProperty(codeWithNamingViolationArb, codingStandardsArb, async (code, standards) => {
          const assurer = new QualityAssurer();
          const complianceResult = assurer.enforceStandards(code, standards);

          // Should detect violations (class names not PascalCase)
          expect(complianceResult.violations.length).toBeGreaterThan(0);

          // At least one violation should relate to naming conventions
          const hasNamingViolation = complianceResult.violations.some(
            (v) => v.message.toLowerCase().includes('case') ||
                   v.message.toLowerCase().includes('naming') ||
                   v.message.toLowerCase().includes('convention')
          );
          expect(hasNamingViolation).toBe(true);

          // Each violation should have a non-empty remediation
          for (const violation of complianceResult.violations) {
            expect(violation.remediation).toBeDefined();
            expect(violation.remediation.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('code with "any" type produces static analysis errors', async () => {
      await fc.assert(
        fc.asyncProperty(codeWithAnyTypeArb, async (code) => {
          const assurer = new QualityAssurer();
          const result = assurer.runStaticAnalysis(code);

          // Should detect "any" type usage as an error
          expect(result.errors.length).toBeGreaterThan(0);

          const hasAnyTypeError = result.errors.some(
            (e) => e.message.toLowerCase().includes('any')
          );
          expect(hasAnyTypeError).toBe(true);

          // Static analysis should report failure
          expect(result.passed).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});
