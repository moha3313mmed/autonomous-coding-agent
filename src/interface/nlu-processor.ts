import {
  StructuredIntent,
  TargetScope,
  Constraint,
  SuccessCriterion,
  ActionType,
  ResolvedIntent,
  ProjectContext,
} from '../shared/types';
import { MemoryStore } from '../infrastructure/memory-store';

// =============================================================================
// Supporting Interfaces
// =============================================================================

/** Report identifying ambiguous fields in a structured intent */
export interface AmbiguityReport {
  isAmbiguous: boolean;
  ambiguousFields: string[];
  confidenceScores: Record<string, number>;
}

/** A clarifying question to resolve ambiguity */
export interface ClarifyingQuestion {
  question: string;
  field: string;
  impact: 'high' | 'medium' | 'low';
  options?: string[];
}

/** A detected contradiction between two parts of an intent */
export interface Contradiction {
  field: string;
  conflictA: string;
  conflictB: string;
  description: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Keywords mapped to action types for intent detection */
const ACTION_KEYWORDS: Record<ActionType, string[]> = {
  create: ['create', 'add', 'new', 'generate', 'build', 'make', 'implement', 'write'],
  modify: ['modify', 'change', 'update', 'edit', 'alter', 'adjust', 'tweak'],
  refactor: ['refactor', 'restructure', 'reorganize', 'clean', 'simplify', 'optimize'],
  fix: ['fix', 'repair', 'resolve', 'debug', 'patch', 'correct', 'solve'],
  test: ['test', 'verify', 'validate', 'check', 'assert', 'spec'],
  document: ['document', 'describe', 'explain', 'comment', 'annotate', 'readme'],
  deploy: ['deploy', 'release', 'publish', 'ship', 'launch', 'push'],
  analyze: ['analyze', 'inspect', 'review', 'audit', 'examine', 'investigate', 'profile'],
};

/** Mutually exclusive term pairs for contradiction detection */
const CONTRADICTORY_PAIRS: Array<[string, string]> = [
  ['sync', 'async'],
  ['synchronous', 'asynchronous'],
  ['public', 'private'],
  ['add', 'remove'],
  ['create', 'delete'],
  ['increase', 'decrease'],
  ['enable', 'disable'],
  ['show', 'hide'],
  ['allow', 'deny'],
  ['include', 'exclude'],
  ['mutable', 'immutable'],
  ['static', 'dynamic'],
  ['optional', 'required'],
  ['internal', 'external'],
  ['encrypt', 'decrypt'],
  ['compress', 'decompress'],
];

/** File path pattern for detecting target scope references */
const FILE_PATH_REGEX = /(?:[\w-]+\/)*[\w-]+\.\w+/g;

/** Function name pattern (e.g., functionName, ClassName.method) */
const FUNCTION_REGEX = /\b[a-zA-Z_]\w*(?:\.\w+)*\s*\(\)/g;

// =============================================================================
// Language Detection
// =============================================================================

type DetectedLanguage = 'en' | 'ar' | 'zh' | 'ja' | 'ko' | 'ru' | 'unknown';

/**
 * Detects the primary language/script of the input string.
 * Uses Unicode character ranges to identify script families.
 */
function detectLanguage(input: string): DetectedLanguage {
  let latinCount = 0;
  let arabicCount = 0;
  let cjkCount = 0;
  let cyrillicCount = 0;
  let totalLetters = 0;

  for (const char of input) {
    const code = char.codePointAt(0)!;

    // Latin (Basic Latin + Latin Extended)
    if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x00C0 && code <= 0x024F)) {
      latinCount++;
      totalLetters++;
    }
    // Arabic
    else if (code >= 0x0600 && code <= 0x06FF) {
      arabicCount++;
      totalLetters++;
    }
    // CJK Unified Ideographs
    else if (code >= 0x4E00 && code <= 0x9FFF) {
      cjkCount++;
      totalLetters++;
    }
    // Hiragana
    else if (code >= 0x3040 && code <= 0x309F) {
      cjkCount++;
      totalLetters++;
    }
    // Katakana
    else if (code >= 0x30A0 && code <= 0x30FF) {
      cjkCount++;
      totalLetters++;
    }
    // Hangul (Korean)
    else if (code >= 0xAC00 && code <= 0xD7AF) {
      cjkCount++;
      totalLetters++;
    }
    // Cyrillic
    else if (code >= 0x0400 && code <= 0x04FF) {
      cyrillicCount++;
      totalLetters++;
    }
  }

  if (totalLetters === 0) {
    return 'unknown';
  }

  const threshold = 0.3;
  if (arabicCount / totalLetters > threshold) return 'ar';
  if (cyrillicCount / totalLetters > threshold) return 'ru';
  if (cjkCount / totalLetters > threshold) {
    // Distinguish between Chinese, Japanese, Korean based on character types
    // This is a simplification - in practice more sophisticated detection is needed
    return 'zh';
  }
  if (latinCount / totalLetters > threshold) return 'en';

  return 'unknown';
}

// =============================================================================
// NLUProcessor Implementation
// =============================================================================

/**
 * NLUProcessor interprets natural language task descriptions and produces
 * structured intents. Supports multi-language input, ambiguity detection,
 * contradiction detection, and project-context reference resolution.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
export class NLUProcessor {
  /**
   * Parses a natural language instruction into a StructuredIntent.
   * Extracts action type, target scope, constraints, and success criteria.
   * Confidence score ranges from 0 to 1 based on keyword recognition and scope clarity.
   *
   * @param input - The natural language instruction string
   * @param context - Optional project context for enhanced parsing
   * @returns A StructuredIntent with extracted information
   */
  async parseInstruction(input: string, context?: ProjectContext): Promise<StructuredIntent> {
    const normalizedInput = input.trim();
    const language = detectLanguage(normalizedInput);
    const lowerInput = normalizedInput.toLowerCase();

    // Detect action type from keywords
    const { actionType, actionConfidence } = this.detectActionType(lowerInput);

    // Extract target scope
    const targetScope = this.extractTargetScope(normalizedInput, context);

    // Extract constraints
    const constraints = this.extractConstraints(lowerInput);

    // Extract success criteria
    const successCriteria = this.extractSuccessCriteria(lowerInput);

    // Calculate overall confidence based on action clarity and scope specificity
    const scopeConfidence = this.calculateScopeConfidence(targetScope);
    const confidence = Math.min(1, Math.max(0, (actionConfidence + scopeConfidence) / 2));

    return {
      actionType,
      targetScope,
      constraints,
      successCriteria,
      language: language === 'unknown' ? 'en' : language,
      confidence,
      rawInput: normalizedInput,
    };
  }

  /**
   * Identifies unclear or ambiguous aspects of a structured intent.
   * Examines each field and determines if it lacks sufficient specificity.
   *
   * @param intent - The structured intent to analyze
   * @returns An AmbiguityReport with details about ambiguous fields
   */
  detectAmbiguity(intent: StructuredIntent): AmbiguityReport {
    const ambiguousFields: string[] = [];
    const confidenceScores: Record<string, number> = {};

    // Check action type confidence
    confidenceScores['actionType'] = intent.confidence;
    if (intent.confidence < 0.5) {
      ambiguousFields.push('actionType');
    }

    // Check target scope specificity
    const scopeScore = this.calculateScopeConfidence(intent.targetScope);
    confidenceScores['targetScope'] = scopeScore;
    if (scopeScore < 0.5) {
      ambiguousFields.push('targetScope');
    }

    // Check constraints clarity
    const constraintScore = intent.constraints.length > 0 ? 0.8 : 0.3;
    confidenceScores['constraints'] = constraintScore;
    if (intent.constraints.length === 0) {
      ambiguousFields.push('constraints');
    }

    // Check success criteria
    const criteriaScore = intent.successCriteria.length > 0 ? 0.8 : 0.3;
    confidenceScores['successCriteria'] = criteriaScore;
    if (intent.successCriteria.length === 0) {
      ambiguousFields.push('successCriteria');
    }

    return {
      isAmbiguous: ambiguousFields.length > 0,
      ambiguousFields,
      confidenceScores,
    };
  }

  /**
   * Generates ranked clarifying questions for ambiguous fields.
   * Returns at most 3 questions, ranked by impact on task execution.
   *
   * @param report - The ambiguity report to generate questions for
   * @returns Array of ClarifyingQuestion sorted by impact (max 3)
   */
  generateClarifications(report: AmbiguityReport): ClarifyingQuestion[] {
    const questions: ClarifyingQuestion[] = [];

    for (const field of report.ambiguousFields) {
      switch (field) {
        case 'actionType':
          questions.push({
            question: 'What type of action would you like to perform?',
            field: 'actionType',
            impact: 'high',
            options: ['create', 'modify', 'refactor', 'fix', 'test', 'document', 'deploy', 'analyze'],
          });
          break;

        case 'targetScope':
          questions.push({
            question: 'Which files, modules, or functions should this action target?',
            field: 'targetScope',
            impact: 'high',
          });
          break;

        case 'constraints':
          questions.push({
            question: 'Are there any specific constraints or requirements for this task?',
            field: 'constraints',
            impact: 'medium',
            options: ['performance requirements', 'compatibility constraints', 'style guidelines', 'no constraints'],
          });
          break;

        case 'successCriteria':
          questions.push({
            question: 'How will you determine if this task is completed successfully?',
            field: 'successCriteria',
            impact: 'medium',
            options: ['tests pass', 'no errors', 'performance threshold met', 'code review approval'],
          });
          break;
      }
    }

    // Sort by impact: high > medium > low
    const impactOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    questions.sort((a, b) => impactOrder[b.impact] - impactOrder[a.impact]);

    // Return at most 3 questions
    return questions.slice(0, 3);
  }

  /**
   * Resolves project-specific references using the Memory_Store.
   * Looks up terminology, code elements, and project context to enrich the intent.
   * Must complete within 2 seconds.
   *
   * @param intent - The structured intent with unresolved references
   * @param memory - The MemoryStore for project context lookup
   * @returns A ResolvedIntent with resolved references and context
   */
  async resolveReferences(intent: StructuredIntent, memory: MemoryStore): Promise<ResolvedIntent> {
    const resolvedReferences: Record<string, string> = {};
    const disambiguations: string[] = [];
    let projectContext = '';

    // Look up project context from memory
    const contextResults = await memory.retrieve({
      semanticQuery: intent.rawInput,
      namespace: 'project',
      maxResults: 5,
      minRelevance: 0.1,
    });

    if (contextResults.length > 0) {
      projectContext = contextResults.map((entry) => entry.content).join('; ');
    }

    // Resolve file references against project knowledge
    for (const file of intent.targetScope.files) {
      const fileResults = await memory.retrieve({
        semanticQuery: file,
        namespace: 'project',
        maxResults: 1,
        minRelevance: 0.2,
      });

      if (fileResults.length > 0) {
        resolvedReferences[file] = fileResults[0].content;
      }
    }

    // Resolve module references
    for (const module of intent.targetScope.modules) {
      const moduleResults = await memory.retrieve({
        semanticQuery: module,
        namespace: 'project',
        maxResults: 1,
        minRelevance: 0.2,
      });

      if (moduleResults.length > 0) {
        resolvedReferences[module] = moduleResults[0].content;
        disambiguations.push(`Resolved "${module}" to: ${moduleResults[0].content}`);
      }
    }

    // Resolve function references
    for (const func of intent.targetScope.functions) {
      const funcResults = await memory.retrieve({
        semanticQuery: func,
        namespace: 'project',
        maxResults: 1,
        minRelevance: 0.2,
      });

      if (funcResults.length > 0) {
        resolvedReferences[func] = funcResults[0].content;
        disambiguations.push(`Resolved "${func}" to: ${funcResults[0].content}`);
      }
    }

    return {
      intent,
      resolvedReferences,
      projectContext,
      disambiguations,
    };
  }

  /**
   * Detects contradictions (mutually exclusive requirements) within an intent.
   * Checks for opposing terms applied to the same target or scope.
   *
   * @param intent - The structured intent to check for contradictions
   * @returns Array of detected contradictions
   */
  detectContradictions(intent: StructuredIntent): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const lowerInput = intent.rawInput.toLowerCase();
    const words = lowerInput.split(/\s+/);

    // Check for contradictory term pairs in the raw input
    for (const [termA, termB] of CONTRADICTORY_PAIRS) {
      const hasTermA = words.some((w) => w.includes(termA));
      const hasTermB = words.some((w) => w.includes(termB));

      if (hasTermA && hasTermB) {
        contradictions.push({
          field: 'constraints',
          conflictA: termA,
          conflictB: termB,
          description: `Mutually exclusive requirements detected: "${termA}" and "${termB}" cannot both apply.`,
        });
      }
    }

    // Check constraints for contradictions
    if (intent.constraints.length > 1) {
      for (let i = 0; i < intent.constraints.length; i++) {
        for (let j = i + 1; j < intent.constraints.length; j++) {
          const constraintA = intent.constraints[i].description.toLowerCase();
          const constraintB = intent.constraints[j].description.toLowerCase();

          for (const [termA, termB] of CONTRADICTORY_PAIRS) {
            if (constraintA.includes(termA) && constraintB.includes(termB)) {
              contradictions.push({
                field: 'constraints',
                conflictA: intent.constraints[i].description,
                conflictB: intent.constraints[j].description,
                description: `Constraint "${intent.constraints[i].description}" conflicts with "${intent.constraints[j].description}".`,
              });
            }
          }
        }
      }
    }

    return contradictions;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Detects the action type from the input text using keyword matching.
   * Returns the detected action type and a confidence score for the detection.
   */
  private detectActionType(lowerInput: string): { actionType: ActionType; actionConfidence: number } {
    const words = lowerInput.split(/\s+/);
    let bestAction: ActionType = 'analyze'; // default fallback
    let bestScore = 0;

    for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (words.some((w) => w.includes(keyword))) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestAction = action as ActionType;
      }
    }

    // Confidence based on how many keywords matched
    const actionConfidence = bestScore > 0 ? Math.min(1, 0.5 + bestScore * 0.15) : 0.2;

    return { actionType: bestAction, actionConfidence };
  }

  /**
   * Extracts the target scope from the input, identifying file paths,
   * module names, and function references.
   */
  private extractTargetScope(input: string, context?: ProjectContext): TargetScope {
    const files: string[] = [];
    const modules: string[] = [];
    const functions: string[] = [];

    // Extract file paths
    const fileMatches = input.match(FILE_PATH_REGEX);
    if (fileMatches) {
      for (const match of fileMatches) {
        // Filter to likely file paths (must have a valid extension)
        if (/\.\w{1,5}$/.test(match)) {
          files.push(match);
        }
      }
    }

    // Extract function references (pattern: name())
    const funcMatches = input.match(FUNCTION_REGEX);
    if (funcMatches) {
      for (const match of funcMatches) {
        functions.push(match.replace(/\s*\(\)$/, ''));
      }
    }

    // Extract module references from context if available
    if (context) {
      const contextModules = this.extractModulesFromContext(input, context);
      modules.push(...contextModules);
    }

    // Try to extract module-like references from the input
    const modulePatterns = input.match(/\b(?:module|package|component|service|layer)\s+(\w[\w-]*)/gi);
    if (modulePatterns) {
      for (const match of modulePatterns) {
        const parts = match.split(/\s+/);
        if (parts.length > 1) {
          modules.push(parts[parts.length - 1]);
        }
      }
    }

    // Determine scope level
    let scope: TargetScope['scope'] = 'project';
    if (functions.length > 0) {
      scope = 'function';
    } else if (files.length > 0) {
      scope = 'file';
    } else if (modules.length > 0) {
      scope = 'module';
    }

    return { files, modules, functions, scope };
  }

  /**
   * Extracts module names by matching input terms against project context structure.
   */
  private extractModulesFromContext(input: string, context: ProjectContext): string[] {
    const modules: string[] = [];
    const lowerInput = input.toLowerCase();

    // Check project structure for module matches
    if (context.structure && context.structure.children) {
      for (const child of context.structure.children) {
        if (child.type === 'directory' && lowerInput.includes(child.name.toLowerCase())) {
          modules.push(child.name);
        }
      }
    }

    return modules;
  }

  /**
   * Extracts constraints from the input text.
   * Looks for constraint-indicating keywords and phrases.
   */
  private extractConstraints(lowerInput: string): Constraint[] {
    const constraints: Constraint[] = [];

    // Performance constraints
    if (/(?:fast|quick|performan|speed|latency|under \d+\s*(?:ms|second))/i.test(lowerInput)) {
      constraints.push({
        type: 'performance',
        description: 'Performance requirement detected in instruction',
        priority: 'high',
        enforceable: true,
      });
    }

    // Compatibility constraints
    if (/(?:compat|backward|legacy|support|cross-platform)/i.test(lowerInput)) {
      constraints.push({
        type: 'compatibility',
        description: 'Compatibility requirement detected in instruction',
        priority: 'medium',
        enforceable: true,
      });
    }

    // Security constraints
    if (/(?:secur|auth|encrypt|sanitiz|validat|protect)/i.test(lowerInput)) {
      constraints.push({
        type: 'security',
        description: 'Security requirement detected in instruction',
        priority: 'critical',
        enforceable: true,
      });
    }

    // Style/convention constraints
    if (/(?:style|convention|pattern|clean|standard|lint)/i.test(lowerInput)) {
      constraints.push({
        type: 'style',
        description: 'Style/convention requirement detected in instruction',
        priority: 'low',
        enforceable: true,
      });
    }

    // Testing constraints
    if (/(?:test coverage|unit test|integration test|100%|coverage)/i.test(lowerInput)) {
      constraints.push({
        type: 'testing',
        description: 'Testing requirement detected in instruction',
        priority: 'medium',
        enforceable: true,
      });
    }

    return constraints;
  }

  /**
   * Extracts success criteria from the input text.
   */
  private extractSuccessCriteria(lowerInput: string): SuccessCriterion[] {
    const criteria: SuccessCriterion[] = [];

    // Tests passing
    if (/(?:tests?\s+pass|all\s+tests|test\s+suite)/i.test(lowerInput)) {
      criteria.push({
        description: 'All tests must pass',
        metric: 'test_pass_rate',
        threshold: 1.0,
        required: true,
      });
    }

    // No errors
    if (/(?:no\s+error|error[- ]free|zero\s+error)/i.test(lowerInput)) {
      criteria.push({
        description: 'No errors in output',
        metric: 'error_count',
        threshold: 0,
        required: true,
      });
    }

    // Performance thresholds
    const perfMatch = lowerInput.match(/under\s+(\d+)\s*(?:ms|millisecond)/i);
    if (perfMatch) {
      criteria.push({
        description: `Response time under ${perfMatch[1]}ms`,
        metric: 'response_time_ms',
        threshold: parseInt(perfMatch[1], 10),
        required: true,
      });
    }

    // Coverage thresholds
    const coverageMatch = lowerInput.match(/(\d+)%\s*(?:coverage|test\s*coverage)/i);
    if (coverageMatch) {
      criteria.push({
        description: `Test coverage at ${coverageMatch[1]}%`,
        metric: 'test_coverage',
        threshold: parseInt(coverageMatch[1], 10) / 100,
        required: false,
      });
    }

    return criteria;
  }

  /**
   * Calculates confidence in the target scope based on specificity.
   * More specific targets (files, functions) yield higher confidence.
   */
  private calculateScopeConfidence(scope: TargetScope): number {
    let confidence = 0.2; // base confidence

    if (scope.files.length > 0) {
      confidence += 0.3;
    }
    if (scope.modules.length > 0) {
      confidence += 0.2;
    }
    if (scope.functions.length > 0) {
      confidence += 0.3;
    }

    return Math.min(1, confidence);
  }
}
