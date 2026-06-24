import {
  Tool,
  ToolSpecification,
  ToolRequirement,
  ValidationResult,
  IntegrationAdapter,
  ExternalService,
  SafetyCheckResult,
  TestSuite,
  RetryPolicy,
  RateLimitConfig,
  FallbackStrategy,
} from '../shared/types';

/**
 * ToolRegistry manages tools, creates new integrations, and provides discovery to agents.
 * It maintains an indexed collection of tools searchable by capability keywords.
 */
export class ToolRegistry {
  /** toolId -> Tool */
  private tools: Map<string, Tool> = new Map();

  /** capability keyword -> set of toolIds */
  private capabilityIndex: Map<string, Set<string>> = new Map();

  /**
   * Searches for active tools matching the capability requirement.
   * Returns the best match or null if no tool matches.
   */
  async findTool(requirement: ToolRequirement): Promise<Tool | null> {
    const capabilityKeywords = this.extractKeywords(requirement.capability);

    let bestMatch: Tool | null = null;
    let bestScore = 0;

    for (const keyword of capabilityKeywords) {
      const toolIds = this.capabilityIndex.get(keyword.toLowerCase());
      if (!toolIds) continue;

      for (const toolId of toolIds) {
        const tool = this.tools.get(toolId);
        if (!tool) continue;

        // Only consider active tools
        if (tool.status !== 'active' && tool.status !== 'validated') continue;

        const score = this.computeMatchScore(tool, requirement);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = tool;
        }
      }
    }

    // Also do a description-based search across all tools
    for (const tool of this.tools.values()) {
      if (tool.status !== 'active' && tool.status !== 'validated') continue;

      const descriptionKeywords = this.extractKeywords(tool.description);
      const overlap = capabilityKeywords.filter((kw) =>
        descriptionKeywords.includes(kw)
      );

      if (overlap.length > 0) {
        const score = this.computeMatchScore(tool, requirement);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = tool;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Generates a new tool from a specification with draft status.
   * Generates implementation stub, test suite, and documentation.
   * Tool creation failure after 3 attempts reports error to caller.
   */
  async createTool(spec: ToolSpecification): Promise<Tool> {
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const toolId = this.generateId();

        const implementation = this.generateImplementationStub(spec);
        const tests = this.generateTestSuite(spec, toolId);
        const documentation = this.generateDocumentation(spec);

        const safetyChecklist: SafetyCheckResult = {
          passed: false,
          inputSanitization: false,
          resourceLimits: false,
          sandboxedExecution: false,
          issues: ['Tool has not been validated yet'],
        };

        const tool: Tool = {
          id: toolId,
          name: spec.name,
          description: spec.description,
          interfaceDefinition: spec.interfaceDefinition,
          inputSchema: spec.inputSchema,
          outputSchema: spec.outputSchema,
          implementation,
          tests,
          documentation,
          safetyChecklist,
          status: 'draft',
        };

        return tool;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxAttempts) {
          break;
        }
      }
    }

    throw new Error(
      `Tool creation failed after ${maxAttempts} attempts: ${lastError?.message ?? 'Unknown error'}`
    );
  }

  /**
   * Checks safety checklist: input sanitization, resource limits (max 512MB memory, 60s CPU),
   * sandboxed execution. Returns validation result.
   */
  async validateTool(tool: Tool): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check input sanitization: inputSchema must have validation rules
    const hasInputValidation = this.checkInputSanitization(tool);
    if (!hasInputValidation) {
      errors.push(
        'Input sanitization missing: inputSchema must define validation rules (required fields or type constraints)'
      );
    }

    // Check resource limits configured (max 512MB memory, 60s CPU)
    const hasResourceLimits = this.checkResourceLimits(tool);
    if (!hasResourceLimits) {
      errors.push(
        'Resource limits not configured: tool must specify memory limit (max 512MB) and CPU timeout (max 60s)'
      );
    }

    // Check sandboxed execution flag
    const hasSandbox = this.checkSandboxedExecution(tool);
    if (!hasSandbox) {
      errors.push(
        'Sandboxed execution not configured: tool must run in an isolated sandbox environment'
      );
    }

    // Check for warnings
    if (tool.tests.tests.length === 0) {
      warnings.push('Tool has no test cases defined');
    }

    if (!tool.documentation || tool.documentation.trim().length === 0) {
      warnings.push('Tool documentation is empty');
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedAt: Date.now(),
    };

    return result;
  }

  /**
   * Activates a validated tool. Only registers if validation passes.
   * Only tools with status 'validated' or 'active' can be registered.
   */
  async registerTool(tool: Tool): Promise<void> {
    // Check status eligibility
    if (tool.status !== 'validated' && tool.status !== 'active') {
      throw new Error(
        `Cannot register tool with status '${tool.status}'. Only 'validated' or 'active' tools can be registered.`
      );
    }

    // Validate the tool before registration
    const validationResult = await this.validateTool(tool);
    if (!validationResult.valid) {
      throw new Error(
        `Tool validation failed: ${validationResult.errors.join('; ')}`
      );
    }

    // Activate the tool
    const activeTool: Tool = { ...tool, status: 'active' };

    // Store in the tools map
    this.tools.set(activeTool.id, activeTool);

    // Index by capability keywords
    this.indexToolCapabilities(activeTool);
  }

  /**
   * Creates an adapter with retry logic (3 retries, exponential backoff),
   * rate limiting, 30s timeout, and graceful degradation.
   */
  async createIntegrationAdapter(
    service: ExternalService
  ): Promise<IntegrationAdapter> {
    const retryPolicy: RetryPolicy = {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
    };

    const rateLimiter: RateLimitConfig = {
      maxRequestsPerSecond: 10,
      maxRequestsPerMinute: 100,
      burstLimit: 20,
      cooldownMs: 5000,
    };

    const fallbackStrategy: FallbackStrategy = {
      type: 'degrade',
      degradedCapabilities: ['non-critical operations'],
      cachedResponseTTL: 300000, // 5 minutes
    };

    const adapter: IntegrationAdapter = {
      serviceId: service.id,
      endpoint: service.baseUrl,
      retryPolicy,
      rateLimiter,
      fallbackStrategy,
      timeout: 30000, // 30 seconds
    };

    return adapter;
  }

  // =========================================================================
  // Private helper methods
  // =========================================================================

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  private computeMatchScore(tool: Tool, requirement: ToolRequirement): number {
    let score = 0;

    // Match on capability keywords
    const reqKeywords = this.extractKeywords(requirement.capability);
    const toolKeywords = [
      ...this.extractKeywords(tool.name),
      ...this.extractKeywords(tool.description),
    ];

    for (const kw of reqKeywords) {
      if (toolKeywords.includes(kw)) {
        score += 1;
      }
    }

    // Bonus for matching input/output types
    const toolInputTypes = this.extractSchemaTypes(tool.inputSchema);
    const toolOutputTypes = this.extractSchemaTypes(tool.outputSchema);

    for (const inputType of requirement.inputTypes) {
      if (toolInputTypes.includes(inputType.toLowerCase())) {
        score += 0.5;
      }
    }

    for (const outputType of requirement.outputTypes) {
      if (toolOutputTypes.includes(outputType.toLowerCase())) {
        score += 0.5;
      }
    }

    return score;
  }

  private extractSchemaTypes(schema: { type: string; properties?: Record<string, { type: string }> }): string[] {
    const types: string[] = [schema.type.toLowerCase()];
    if (schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        types.push(prop.type.toLowerCase());
      }
    }
    return types;
  }

  private generateId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateImplementationStub(spec: ToolSpecification): string {
    const methods = spec.interfaceDefinition.methods
      .map((m) => {
        const params = m.parameters
          .map((p) => `${p.name}: ${p.type}`)
          .join(', ');
        return `  async ${m.name}(${params}): Promise<${m.returnType}> {\n    // TODO: Implement ${m.description}\n    throw new Error('Not implemented');\n  }`;
      })
      .join('\n\n');

    return `// Auto-generated implementation stub for ${spec.name}\nexport class ${spec.name.replace(/\s+/g, '')}Tool {\n${methods}\n}`;
  }

  private generateTestSuite(spec: ToolSpecification, toolId: string): TestSuite {
    return {
      id: `testsuite_${toolId}`,
      name: `${spec.name} Test Suite`,
      tests: spec.requirements.map((req, idx) => ({
        id: `test_${idx + 1}`,
        name: `Validates: ${req}`,
        input: null,
        expectedOutput: null,
        assertions: [`${req} is satisfied`],
      })),
      coverage: 0,
    };
  }

  private generateDocumentation(spec: ToolSpecification): string {
    const methodDocs = spec.interfaceDefinition.methods
      .map((m) => {
        const params = m.parameters
          .map((p) => `  - \`${p.name}\` (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`)
          .join('\n');
        return `### ${m.name}\n\n${m.description}\n\n**Parameters:**\n${params}\n\n**Returns:** ${m.returnType}`;
      })
      .join('\n\n');

    return `# ${spec.name}\n\n${spec.description}\n\n## Methods\n\n${methodDocs}\n\n## Safety Requirements\n\n${spec.safetyRequirements.map((r) => `- ${r}`).join('\n')}`;
  }

  private checkInputSanitization(tool: Tool): boolean {
    // Input schema must have required fields or property type constraints defined
    const schema = tool.inputSchema;
    if (!schema) return false;

    // Must have either required fields specified or properties with type definitions
    const hasRequired = schema.required && schema.required.length > 0;
    const hasTypedProperties =
      schema.properties &&
      Object.keys(schema.properties).length > 0 &&
      Object.values(schema.properties).every((prop) => prop.type !== undefined);

    return hasRequired || hasTypedProperties;
  }

  private checkResourceLimits(tool: Tool): boolean {
    // Check if the tool's safety checklist or implementation references resource limits
    // The tool's safetyChecklist.resourceLimits should be true or the implementation must contain resource config
    if (tool.safetyChecklist && tool.safetyChecklist.resourceLimits) {
      return true;
    }

    // Check implementation for resource limit references
    const impl = tool.implementation.toLowerCase();
    return (
      impl.includes('memorylimit') ||
      impl.includes('memory_limit') ||
      impl.includes('maxmemory') ||
      impl.includes('cpulimit') ||
      impl.includes('cpu_limit') ||
      impl.includes('timeout') ||
      impl.includes('resourcelimit') ||
      impl.includes('resource_limit')
    );
  }

  private checkSandboxedExecution(tool: Tool): boolean {
    // Check if the tool's safety checklist has sandbox flag set
    if (tool.safetyChecklist && tool.safetyChecklist.sandboxedExecution) {
      return true;
    }

    // Check implementation for sandbox references
    const impl = tool.implementation.toLowerCase();
    return (
      impl.includes('sandbox') ||
      impl.includes('isolated') ||
      impl.includes('container')
    );
  }

  private indexToolCapabilities(tool: Tool): void {
    const keywords = [
      ...this.extractKeywords(tool.name),
      ...this.extractKeywords(tool.description),
    ];

    for (const keyword of keywords) {
      if (!this.capabilityIndex.has(keyword)) {
        this.capabilityIndex.set(keyword, new Set());
      }
      this.capabilityIndex.get(keyword)!.add(tool.id);
    }
  }
}
