import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ToolRegistry } from './tool-registry';
import {
  ToolSpecification,
  Tool,
  SafetyCheckResult,
  InterfaceDefinition,
  JSONSchema,
  TestSuite,
} from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

/** Generates a valid ParameterDefinition */
const parameterDefinitionArb = fc.record({
  name: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 20 }),
  type: fc.constantFrom('string', 'number', 'boolean', 'object', 'array'),
  required: fc.boolean(),
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

/** Generates a valid MethodDefinition */
const methodDefinitionArb = fc.record({
  name: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 30 }),
  parameters: fc.array(parameterDefinitionArb, { minLength: 1, maxLength: 4 }),
  returnType: fc.constantFrom('string', 'number', 'boolean', 'void', 'Promise<string>', 'Promise<void>'),
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

/** Generates a valid InterfaceDefinition */
const interfaceDefinitionArb: fc.Arbitrary<InterfaceDefinition> = fc.record({
  name: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 30 }),
  methods: fc.array(methodDefinitionArb, { minLength: 1, maxLength: 5 }),
  version: fc.tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 99 }))
    .map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
});

/** Generates a valid JSON Schema with properties */
const jsonSchemaArb: fc.Arbitrary<JSONSchema> = fc.record({
  type: fc.constantFrom('object', 'string', 'number', 'array'),
  properties: fc.option(
    fc.dictionary(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 15 }),
      fc.record({ type: fc.constantFrom('string', 'number', 'boolean', 'object', 'array') }) as fc.Arbitrary<JSONSchema>,
      { minKeys: 1, maxKeys: 5 }
    ),
    { nil: undefined }
  ),
  required: fc.option(
    fc.array(fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

/** Generates a valid ToolSpecification */
const toolSpecificationArb: fc.Arbitrary<ToolSpecification> = fc.record({
  name: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  interfaceDefinition: interfaceDefinitionArb,
  inputSchema: jsonSchemaArb,
  outputSchema: jsonSchemaArb,
  requirements: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
  safetyRequirements: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
});

/** Generates a Tool that is missing safety features (no sanitization, no limits, no sandbox) */
const unsafeToolArb: fc.Arbitrary<Tool> = fc.record({
  id: fc.string({ minLength: 5, maxLength: 30 }).map((s) => `tool_${s}`),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  interfaceDefinition: interfaceDefinitionArb,
  inputSchema: fc.constant({ type: 'object' } as JSONSchema), // No properties or required -> no sanitization
  outputSchema: jsonSchemaArb,
  implementation: fc.constant('// stub implementation\nfunction run() { return null; }'), // No resource limit or sandbox keywords
  tests: fc.constant({ id: 'test_1', name: 'Test Suite', tests: [], coverage: 0 } as TestSuite),
  documentation: fc.string({ minLength: 1, maxLength: 100 }),
  safetyChecklist: fc.constant({
    passed: false,
    inputSanitization: false,
    resourceLimits: false,
    sandboxedExecution: false,
    issues: ['Not validated'],
  } as SafetyCheckResult),
  status: fc.constant('draft' as const),
});

// =============================================================================
// Property Tests
// =============================================================================

describe('ToolRegistry - Property Tests', () => {
  // Feature: autonomous-coding-agent, Property 21: Tool specification completeness
  describe('Property 21: Tool specification completeness', () => {
    it('generated tool specs contain valid interfaceDefinition, inputSchema, and outputSchema', async () => {
      await fc.assert(
        fc.asyncProperty(toolSpecificationArb, async (spec) => {
          const registry = new ToolRegistry();
          const tool = await registry.createTool(spec);

          // interfaceDefinition must be valid
          expect(tool.interfaceDefinition).toBeDefined();
          expect(tool.interfaceDefinition.name).toBeDefined();
          expect(tool.interfaceDefinition.name.length).toBeGreaterThan(0);
          expect(tool.interfaceDefinition.methods).toBeDefined();
          expect(tool.interfaceDefinition.methods.length).toBeGreaterThan(0);
          expect(tool.interfaceDefinition.version).toBeDefined();
          expect(tool.interfaceDefinition.version.length).toBeGreaterThan(0);

          // Each method must have a name, parameters, returnType, and description
          for (const method of tool.interfaceDefinition.methods) {
            expect(method.name.length).toBeGreaterThan(0);
            expect(method.parameters).toBeDefined();
            expect(method.returnType.length).toBeGreaterThan(0);
            expect(method.description.length).toBeGreaterThan(0);
          }

          // inputSchema must conform to JSON Schema structure
          expect(tool.inputSchema).toBeDefined();
          expect(tool.inputSchema.type).toBeDefined();
          expect(tool.inputSchema.type.length).toBeGreaterThan(0);

          // outputSchema must conform to JSON Schema structure
          expect(tool.outputSchema).toBeDefined();
          expect(tool.outputSchema.type).toBeDefined();
          expect(tool.outputSchema.type.length).toBeGreaterThan(0);

          // Tool should have draft status after creation
          expect(tool.status).toBe('draft');

          // Tool should have a generated implementation
          expect(tool.implementation).toBeDefined();
          expect(tool.implementation.length).toBeGreaterThan(0);

          // Tool should have documentation
          expect(tool.documentation).toBeDefined();
          expect(tool.documentation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: autonomous-coding-agent, Property 22: Tool safety validation
  describe('Property 22: Tool safety validation', () => {
    it('tools without sanitization, resource limits, or sandbox fail validation', async () => {
      await fc.assert(
        fc.asyncProperty(unsafeToolArb, async (unsafeTool) => {
          const registry = new ToolRegistry();
          const result = await registry.validateTool(unsafeTool);

          // Validation must fail for unsafe tools
          expect(result.valid).toBe(false);

          // Errors array must be non-empty
          expect(result.errors.length).toBeGreaterThan(0);

          // At least one error should mention the missing safety aspect
          const errorText = result.errors.join(' ');
          const mentionsSanitization = errorText.toLowerCase().includes('sanitization') || errorText.toLowerCase().includes('input');
          const mentionsLimits = errorText.toLowerCase().includes('limit') || errorText.toLowerCase().includes('resource');
          const mentionsSandbox = errorText.toLowerCase().includes('sandbox') || errorText.toLowerCase().includes('isolated');

          // At least one of the three safety issues should be flagged
          expect(mentionsSanitization || mentionsLimits || mentionsSandbox).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
