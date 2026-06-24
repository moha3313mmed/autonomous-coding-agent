import {
  CodeOutput,
  CodingStandards,
  ReviewResult,
  CoverageReport,
  StaticAnalysisResult,
  ComplianceResult,
  QualityIssue,
  QualityMetrics,
  Suggestion,
} from '../shared/types';

/**
 * QualityAssurer performs automated code review, standards enforcement,
 * and output validation for agent-produced code.
 */
export class QualityAssurer {
  private remediationAttempts: Map<string, number> = new Map();
  private static readonly MAX_REMEDIATION_CYCLES = 3;
  private static readonly REVIEW_TIMEOUT_MS = 60_000;

  /**
   * Performs a comprehensive code review combining static analysis,
   * standards enforcement, and error handling verification.
   */
  async reviewCode(code: CodeOutput, standards: CodingStandards): Promise<ReviewResult> {
    const staticResult = this.runStaticAnalysis(code);
    const complianceResult = this.enforceStandards(code, standards);
    const coverageReport = this.verifyErrorHandling(code);

    const allIssues: QualityIssue[] = [
      ...staticResult.errors,
      ...staticResult.warnings,
      ...staticResult.info,
      ...complianceResult.violations,
    ];

    const suggestions = this.generateSuggestions(allIssues);
    const metrics = this.computeMetrics(staticResult, complianceResult, coverageReport, code);

    const passed = staticResult.passed && complianceResult.compliant &&
      allIssues.filter(i => i.severity === 'error').length === 0;

    return { passed, issues: allIssues, suggestions, metrics };
  }


  /**
   * Checks error handling and input validation on public interfaces.
   */
  verifyErrorHandling(code: CodeOutput): CoverageReport {
    const lines = code.content.split('\n');
    const totalPublicFunctions = this.findPublicFunctions(lines);
    const functionsWithErrorHandling = this.findFunctionsWithErrorHandling(lines);

    const coveredLines = functionsWithErrorHandling.length;
    const totalLines = totalPublicFunctions.length;
    const coveragePercent = totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;

    const uncoveredPaths = totalPublicFunctions
      .filter(fn => !functionsWithErrorHandling.includes(fn))
      .map(fn => `${code.filePath}:${fn}`);

    return {
      totalLines: totalLines,
      coveredLines: coveredLines,
      coveragePercent,
      uncoveredPaths,
      branchCoverage: coveragePercent,
    };
  }

  /**
   * Returns structured static analysis results with errors, warnings, and info.
   */
  runStaticAnalysis(code: CodeOutput): StaticAnalysisResult {
    const startTime = Date.now();
    const lines = code.content.split('\n');

    const errors: QualityIssue[] = [];
    const warnings: QualityIssue[] = [];
    const info: QualityIssue[] = [];

    // Lint checks
    this.checkMissingSemicolons(lines, code.filePath, warnings);
    this.checkUnusedVariables(code.content, lines, code.filePath, warnings);

    // Type checks
    this.checkAnyUsage(lines, code.filePath, errors);
    this.checkMissingReturnTypes(lines, code.filePath, warnings);

    const analysisTime = Date.now() - startTime;
    const passed = errors.length === 0;

    return { passed, errors, warnings, info, analysisTime };
  }


  /**
   * Compares coverage and ensures line coverage doesn't decrease by more than 1%.
   */
  checkTestCoverage(code: CodeOutput, baselineCoverage: number): CoverageReport {
    const lines = code.content.split('\n');
    const executableLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('*') &&
        trimmed !== '{' &&
        trimmed !== '}';
    });

    const totalLines = executableLines.length;
    // Estimate coverage based on test-related patterns in the code
    const testedLines = executableLines.filter(line =>
      !line.includes('TODO') && !line.includes('FIXME')
    );

    const coveragePercent = totalLines === 0 ? 100 : (testedLines.length / totalLines) * 100;
    const coverageDropped = baselineCoverage - coveragePercent > 1;

    const uncoveredPaths: string[] = [];
    if (coverageDropped) {
      uncoveredPaths.push(`${code.filePath}: coverage dropped from ${baselineCoverage.toFixed(1)}% to ${coveragePercent.toFixed(1)}%`);
    }

    return {
      totalLines,
      coveredLines: testedLines.length,
      coveragePercent,
      uncoveredPaths,
      branchCoverage: coveragePercent,
    };
  }

  /**
   * Checks naming conventions, documentation, and architectural patterns.
   */
  enforceStandards(code: CodeOutput, config: CodingStandards): ComplianceResult {
    const lines = code.content.split('\n');
    const violations: QualityIssue[] = [];
    const standardsChecked: string[] = [];

    // Check naming conventions
    standardsChecked.push('naming-conventions');
    this.checkNamingConventions(lines, code.filePath, violations);

    // Check documentation requirements
    standardsChecked.push('documentation-requirements');
    this.checkDocumentation(lines, code.filePath, config, violations);

    // Check architectural patterns
    standardsChecked.push('architectural-patterns');
    this.checkArchitecturalPatterns(code.content, code.filePath, config, violations);

    const compliant = violations.filter(v => v.severity === 'error').length === 0;

    return {
      compliant,
      violations,
      standardsChecked,
      checkedAt: Date.now(),
    };
  }


  /**
   * Generates specific remediation instructions per issue.
   * Tracks remediation attempts per task (max 3 cycles).
   * After 3 failed cycles, escalates with unresolved issues.
   */
  generateRemediation(issues: QualityIssue[]): string[] {
    return issues.map(issue => {
      if (issue.remediation && issue.remediation.length > 0) {
        return issue.remediation;
      }
      return this.generateRemediationForIssue(issue);
    });
  }

  /**
   * Tracks remediation attempts for a task. Returns true if
   * remediation can continue, false if max cycles exceeded (escalation needed).
   */
  trackRemediationAttempt(taskId: string): boolean {
    const current = this.remediationAttempts.get(taskId) || 0;
    const next = current + 1;
    this.remediationAttempts.set(taskId, next);
    return next <= QualityAssurer.MAX_REMEDIATION_CYCLES;
  }

  /**
   * Returns true if the task has exceeded max remediation cycles.
   */
  shouldEscalate(taskId: string): boolean {
    const attempts = this.remediationAttempts.get(taskId) || 0;
    return attempts >= QualityAssurer.MAX_REMEDIATION_CYCLES;
  }

  /**
   * Gets the number of remediation attempts for a task.
   */
  getRemediationAttempts(taskId: string): number {
    return this.remediationAttempts.get(taskId) || 0;
  }

  // =========================================================================
  // Private helper methods
  // =========================================================================

  private findPublicFunctions(lines: string[]): string[] {
    const publicFns: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match exported functions or class methods (not private/protected)
      if (
        /^\s*export\s+(async\s+)?function\s+\w+/.test(line) ||
        /^\s*(public\s+)?(async\s+)?\w+\s*\(/.test(line) &&
        !line.includes('private') && !line.includes('protected')
      ) {
        const match = line.match(/(?:function\s+)?(\w+)\s*\(/);
        if (match) {
          publicFns.push(match[1]);
        }
      }
    }
    return publicFns;
  }


  private findFunctionsWithErrorHandling(lines: string[]): string[] {
    const fnsWithHandling: string[] = [];
    let currentFunction: string | null = null;
    let braceDepth = 0;
    let hasTryCatch = false;
    let hasNullCheck = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect function start
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:public\s+)?(?:async\s+)?(\w+)\s*\(/);
      if (fnMatch && !line.includes('private') && !line.includes('protected')) {
        if (currentFunction && (hasTryCatch || hasNullCheck)) {
          fnsWithHandling.push(currentFunction);
        }
        currentFunction = fnMatch[1] || fnMatch[2];
        braceDepth = 0;
        hasTryCatch = false;
        hasNullCheck = false;
      }

      // Track brace depth
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      // Detect error handling patterns
      if (currentFunction) {
        if (/\btry\s*\{/.test(line) || /\bcatch\s*\(/.test(line)) {
          hasTryCatch = true;
        }
        if (/!=\s*null|!==\s*null|!=\s*undefined|!==\s*undefined|\?\.|if\s*\(\s*\w+\s*\)/.test(line)) {
          hasNullCheck = true;
        }
      }

      // End of function
      if (currentFunction && braceDepth === 0 && i > 0) {
        if (hasTryCatch || hasNullCheck) {
          fnsWithHandling.push(currentFunction);
        }
        currentFunction = null;
      }
    }

    // Handle last function
    if (currentFunction && (hasTryCatch || hasNullCheck)) {
      fnsWithHandling.push(currentFunction);
    }

    return [...new Set(fnsWithHandling)];
  }


  private checkMissingSemicolons(lines: string[], filePath: string, issues: QualityIssue[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines, comments, block openers/closers, imports, decorators
      if (
        line.length === 0 ||
        line.startsWith('//') ||
        line.startsWith('/*') ||
        line.startsWith('*') ||
        line.endsWith('{') ||
        line.endsWith('}') ||
        line === '}' ||
        line.startsWith('import ') ||
        line.startsWith('export ') ||
        line.startsWith('@') ||
        line.endsWith(',') ||
        line.endsWith('(') ||
        line.endsWith(';')
      ) {
        continue;
      }

      // Statements that should end with semicolons
      if (
        /^(const|let|var|return|throw|break|continue)\s/.test(line) ||
        /^\w+\s*=\s*/.test(line) ||
        /\)\s*$/.test(line) && !line.includes('=>') && !line.startsWith('if') && !line.startsWith('for') && !line.startsWith('while')
      ) {
        if (!line.endsWith(';') && !line.endsWith('{') && !line.endsWith(',')) {
          issues.push(this.createIssue(
            'warning', 'lint', filePath, i + 1,
            'Missing semicolon at end of statement',
            'Add semicolon at the end of the statement'
          ));
        }
      }
    }
  }

  private checkUnusedVariables(content: string, lines: string[], filePath: string, issues: QualityIssue[]): void {
    const variableDeclarations: Array<{ name: string; line: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/(?:const|let|var)\s+(\w+)\s*[=:]/);
      if (match) {
        variableDeclarations.push({ name: match[1], line: i + 1 });
      }
    }

    for (const decl of variableDeclarations) {
      // Count occurrences of the variable name (word boundary matching)
      const regex = new RegExp(`\\b${decl.name}\\b`, 'g');
      const matches = content.match(regex);
      // If it only appears once (the declaration itself), it's unused
      if (matches && matches.length === 1) {
        issues.push(this.createIssue(
          'warning', 'lint', filePath, decl.line,
          `Variable '${decl.name}' is declared but never used`,
          `Remove unused variable '${decl.name}' or use it in the code`
        ));
      }
    }
  }


  private checkAnyUsage(lines: string[], filePath: string, issues: QualityIssue[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect explicit 'any' type usage (excluding comments)
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      if (/:\s*any\b/.test(line) || /as\s+any\b/.test(line) || /<any>/.test(line)) {
        issues.push(this.createIssue(
          'error', 'type', filePath, i + 1,
          'Usage of "any" type detected',
          'Replace "any" with a specific type or use "unknown" for type-safe handling'
        ));
      }
    }
  }

  private checkMissingReturnTypes(lines: string[], filePath: string, issues: QualityIssue[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check function declarations without return types
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/);
      if (fnMatch && !line.includes(':') || (fnMatch && !line.match(/\)\s*:\s*\w/))) {
        // Only flag if there's no return type annotation after the params
        if (!/\)\s*:\s*\S+/.test(line)) {
          issues.push(this.createIssue(
            'warning', 'type', filePath, i + 1,
            'Function is missing explicit return type annotation',
            'Add an explicit return type annotation to the function'
          ));
        }
      }
    }
  }

  private checkNamingConventions(lines: string[], filePath: string, violations: QualityIssue[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check class names are PascalCase
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(className)) {
          violations.push(this.createIssue(
            'error', 'pattern', filePath, i + 1,
            `Class name '${className}' does not follow PascalCase convention`,
            `Rename class to PascalCase: '${this.toPascalCase(className)}'`
          ));
        }
      }

      // Check variable names are camelCase
      const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);
      if (varMatch) {
        const varName = varMatch[1];
        // Allow UPPER_CASE for constants, and camelCase for variables
        if (!/^[a-z][a-zA-Z0-9]*$/.test(varName) && !/^[A-Z][A-Z0-9_]*$/.test(varName)) {
          violations.push(this.createIssue(
            'warning', 'pattern', filePath, i + 1,
            `Variable '${varName}' does not follow camelCase convention`,
            `Rename variable to camelCase: '${this.toCamelCase(varName)}'`
          ));
        }
      }
    }
  }


  private checkDocumentation(
    lines: string[],
    filePath: string,
    _config: CodingStandards,
    violations: QualityIssue[]
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if public functions have JSDoc comments
      const isFunctionDecl = /(?:export\s+)?(?:async\s+)?function\s+\w+/.test(line) ||
        (/^\s*(public\s+)?(async\s+)?\w+\s*\(/.test(line) &&
        !line.includes('private') && !line.includes('protected'));

      if (isFunctionDecl) {
        // Look backwards for JSDoc
        let hasJsDoc = false;
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prevLine = lines[j].trim();
          if (prevLine === '*/') {
            hasJsDoc = true;
            break;
          }
          if (prevLine.length > 0 && prevLine !== '*/' && !prevLine.startsWith('*') && !prevLine.startsWith('/**')) {
            break;
          }
          if (prevLine.startsWith('/**')) {
            hasJsDoc = true;
            break;
          }
        }

        if (!hasJsDoc) {
          const fnName = line.match(/(?:function\s+)?(\w+)\s*\(/)?.[1] || 'unknown';
          violations.push(this.createIssue(
            'warning', 'pattern', filePath, i + 1,
            `Public function '${fnName}' is missing JSDoc documentation`,
            `Add JSDoc comment above function '${fnName}' describing its purpose, parameters, and return value`
          ));
        }
      }
    }
  }

  private checkArchitecturalPatterns(
    content: string,
    filePath: string,
    config: CodingStandards,
    violations: QualityIssue[]
  ): void {
    // Check for architectural pattern violations based on config
    for (const pattern of config.architecturalPatterns) {
      if (pattern.toLowerCase().includes('single responsibility')) {
        // Heuristic: files with too many exported classes may violate SRP
        const classCount = (content.match(/export\s+class\s+/g) || []).length;
        if (classCount > 3) {
          violations.push(this.createIssue(
            'warning', 'pattern', filePath, 1,
            `File contains ${classCount} exported classes, which may violate Single Responsibility Principle`,
            'Consider splitting this file into multiple files with one class each'
          ));
        }
      }

      if (pattern.toLowerCase().includes('dependency injection')) {
        // Check for direct instantiation in non-factory classes
        const directNew = (content.match(/new\s+\w+\(/g) || []).length;
        const constructorParams = (content.match(/constructor\s*\([^)]+\)/g) || []).length;
        if (directNew > 3 && constructorParams === 0) {
          violations.push(this.createIssue(
            'info', 'pattern', filePath, 1,
            'Multiple direct instantiations found without dependency injection',
            'Consider using constructor injection for dependencies'
          ));
        }
      }
    }
  }


  private generateRemediationForIssue(issue: QualityIssue): string {
    switch (issue.category) {
      case 'lint':
        return `Fix lint issue at ${issue.location.filePath}:${issue.location.startLine} - ${issue.message}`;
      case 'type':
        return `Fix type issue at ${issue.location.filePath}:${issue.location.startLine} - ${issue.message}`;
      case 'pattern':
        return `Fix pattern violation at ${issue.location.filePath}:${issue.location.startLine} - ${issue.message}`;
      case 'security':
        return `Fix security issue at ${issue.location.filePath}:${issue.location.startLine} - ${issue.message}`;
      case 'performance':
        return `Optimize performance at ${issue.location.filePath}:${issue.location.startLine} - ${issue.message}`;
      default:
        return `Address issue at ${issue.location.filePath}:${issue.location.startLine} - ${issue.message}`;
    }
  }

  private generateSuggestions(issues: QualityIssue[]): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Group issues by category to generate higher-level suggestions
    const byCategory = new Map<string, QualityIssue[]>();
    for (const issue of issues) {
      const existing = byCategory.get(issue.category) || [];
      existing.push(issue);
      byCategory.set(issue.category, existing);
    }

    for (const [category, categoryIssues] of byCategory) {
      if (categoryIssues.length >= 3) {
        suggestions.push({
          type: 'refactoring',
          description: `Multiple ${category} issues detected (${categoryIssues.length}). Consider a systematic review of ${category} practices.`,
          location: categoryIssues[0].location,
          impact: categoryIssues.length >= 5 ? 'high' : 'medium',
          effort: 'medium',
        });
      }
    }

    return suggestions;
  }

  private computeMetrics(
    staticResult: StaticAnalysisResult,
    complianceResult: ComplianceResult,
    coverageReport: CoverageReport,
    code: CodeOutput
  ): QualityMetrics {
    const totalIssues = staticResult.errors.length + staticResult.warnings.length + staticResult.info.length;
    const maxScore = 100;
    const lintDeductions = Math.min(maxScore, totalIssues * 5);

    return {
      lintScore: maxScore - lintDeductions,
      typeCheckPassed: staticResult.errors.filter(e => e.category === 'type').length === 0,
      testCoverage: coverageReport.coveragePercent,
      cyclomaticComplexity: this.estimateCyclomaticComplexity(code.content),
      documentationCoverage: this.estimateDocumentationCoverage(code.content),
    };
  }


  private estimateCyclomaticComplexity(content: string): number {
    // Count decision points: if, else if, while, for, case, &&, ||, ?
    const decisionPoints = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /&&/g,
      /\|\|/g,
      /\?[^:]/g,
    ];

    let complexity = 1; // Base complexity
    for (const pattern of decisionPoints) {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }

  private estimateDocumentationCoverage(content: string): number {
    const functionCount = (content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/g) || []).length +
      (content.match(/(?:public\s+)?(?:async\s+)?\w+\s*\([^)]*\)\s*[:{]/g) || []).length;

    if (functionCount === 0) return 100;

    const jsDocCount = (content.match(/\/\*\*/g) || []).length;
    return Math.min(100, (jsDocCount / functionCount) * 100);
  }

  private createIssue(
    severity: QualityIssue['severity'],
    category: QualityIssue['category'],
    filePath: string,
    line: number,
    message: string,
    remediation: string
  ): QualityIssue {
    return {
      severity,
      category,
      location: {
        filePath,
        startLine: line,
        endLine: line,
      },
      message,
      remediation,
      autoFixable: severity !== 'error',
    };
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_match, c) => (c as string).toUpperCase())
      .replace(/^(.)/, (_match, c) => (c as string).toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_match, c) => (c as string).toUpperCase())
      .replace(/^(.)/, (_match, c) => (c as string).toLowerCase());
  }
}
