// =============================================================================
// Shared Type Definitions for the Autonomous Coding Agent
// =============================================================================

// =============================================================================
// Enums
// =============================================================================

/** Actions that can be performed on code/project targets */
export type ActionType = 'create' | 'modify' | 'refactor' | 'fix' | 'test' | 'document' | 'deploy' | 'analyze';

/** Lifecycle status of an agent instance */
export type AgentStatus = 'initializing' | 'running' | 'waiting' | 'completed' | 'failed' | 'terminated';

/** Types of specialized agents in the swarm */
export type AgentType = 'coding' | 'review' | 'research' | 'testing' | 'documentation' | 'refactoring';

/** Status of a task through its lifecycle state machine */
export type TaskStatus = 'received' | 'parsing' | 'decomposing' | 'scheduling' | 'executing' | 'reviewing' | 'completed' | 'failed' | 'escalated';

/** Types of messages flowing through the event-driven message bus */
export type MessageType =
  | 'task_assignment'
  | 'result_submission'
  | 'assistance_request'
  | 'intermediate_result'
  | 'heartbeat'
  | 'termination'
  | 'conflict_detected'
  | 'dependency_resolved';

/** Namespaces for memory isolation in the Memory_Store */
export type MemoryNamespace = 'project' | 'patterns' | 'preferences' | 'decisions' | 'lessons';

/** Priority levels for task ordering */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

// =============================================================================
// Intent Interfaces (NLU_Processor)
// =============================================================================

/** Structured representation of a parsed natural language instruction */
export interface StructuredIntent {
  actionType: ActionType;
  targetScope: TargetScope;
  constraints: Constraint[];
  successCriteria: SuccessCriterion[];
  language: string;
  confidence: number;
  rawInput: string;
}

/** Scope of files/modules/functions affected by the task */
export interface TargetScope {
  files: string[];
  modules: string[];
  functions: string[];
  scope: 'file' | 'module' | 'project' | 'function';
}

/** A constraint imposed on the task execution */
export interface Constraint {
  type: string;
  description: string;
  priority: Priority;
  enforceable: boolean;
}

/** A criterion used to determine task success */
export interface SuccessCriterion {
  description: string;
  metric: string;
  threshold: number;
  required: boolean;
}

/** Intent with resolved project references and context */
export interface ResolvedIntent {
  intent: StructuredIntent;
  resolvedReferences: Record<string, string>;
  projectContext: string;
  disambiguations: string[];
}

// =============================================================================
// Task Interfaces (Task_Decomposer & DAG Scheduler)
// =============================================================================

/** A single subtask within a decomposition plan */
export interface SubTask {
  id: string;
  parentId: string;
  description: string;
  priority: Priority;
  complexityScore: number;
  dependencies: string[];
  recommendedAgentType: AgentType;
  estimatedDuration: number;
  maxRetries: number;
}

/** Directed acyclic graph representing task dependencies */
export interface DependencyGraph {
  nodes: Map<string, SubTask>;
  edges: DirectedEdge[];
  topologicalOrder: string[];
  criticalPath: string[];
  parallelGroups: string[][];
}

/** A directed edge in the dependency graph */
export interface DirectedEdge {
  from: string;
  to: string;
  weight?: number;
}

/** A complete plan for decomposing a task into subtasks */
export interface DecompositionPlan {
  id: string;
  rootTask: ResolvedIntent;
  subtasks: SubTask[];
  dependencyGraph: DependencyGraph;
  estimatedDuration: number;
  parallelismFactor: number;
}

/** A group of tasks that can execute concurrently */
export interface ExecutionWave {
  waveIndex: number;
  tasks: SubTask[];
  prerequisites: string[];
}

/** A plan for executing waves of parallel tasks */
export interface ExecutionPlan {
  waves: ExecutionWave[];
  totalEstimatedTime: number;
  maxConcurrency: number;
}

// =============================================================================
// Agent Interfaces (Agent_Orchestrator & Swarm)
// =============================================================================

/** An instantiated agent in the swarm */
export interface AgentInstance {
  id: string;
  type: AgentType;
  specialization: string;
  status: AgentStatus;
  assignedTask: SubTask;
  resourceAllocation: ResourceLimits;
  startTime: number;
  lastHeartbeat: number;
}

/** Resource limits allocated to an agent */
export interface ResourceLimits {
  maxCpuPercent: number;
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  maxConcurrentOperations: number;
}

/** A message exchanged between agents via the message bus */
export interface AgentMessage {
  id: string;
  type: MessageType;
  senderId: string;
  recipientId: string | 'broadcast';
  payload: unknown;
  timestamp: number;
  correlationId: string;
}

/** Tracking resource consumption of an agent */
export interface ResourceUsage {
  cpuPercent: number;
  memoryMB: number;
  networkIO: number;
  diskIO: number;
}

// =============================================================================
// Skill Interfaces (Skill_Engine)
// =============================================================================

/** A reusable skill module with versioning and metrics */
export interface SkillModule {
  id: string;
  version: number;
  name: string;
  description: string;
  categories: string[];
  programmingLanguages: string[];
  domainContexts: string[];
  solutionTemplate: string;
  confidenceScore: number;
  usageCount: number;
  successRate: number;
  createdAt: number;
  updatedAt: number;
  versionHistory: SkillVersion[];
}

/** Query parameters for finding a skill */
export interface SkillQuery {
  taskCategory: string;
  language?: string;
  domain?: string;
  minConfidence?: number;
}

/** Outcome of applying a skill to a task */
export interface SkillOutcome {
  success: boolean;
  context: string;
  executionTime: number;
  userFeedback?: string;
}

/** A historical version of a skill module */
export interface SkillVersion {
  version: number;
  skillId: string;
  template: string;
  changelog: string;
  confidenceScore: number;
  createdAt: number;
  refinementSource: 'auto' | 'feedback' | 'failure_analysis';
}

/** A record of skill usage for tracking */
export interface SkillUsage {
  id: string;
  skillId: string;
  skillVersion: number;
  taskId: string;
  outcome: SkillOutcome;
  timestamp: number;
}

/** Criteria for searching skills in the engine */
export interface SearchCriteria {
  categories?: string[];
  languages?: string[];
  domains?: string[];
  minConfidence?: number;
  minSuccessRate?: number;
  limit?: number;
}

/** Requirements for generating a new skill */
export interface TaskRequirements {
  taskDescription: string;
  targetLanguage: string;
  domain: string;
  constraints: Constraint[];
  exampleInputs?: string[];
  expectedBehavior: string;
}

/** Analysis of why a skill failed */
export interface FailureAnalysis {
  skillId: string;
  failureType: string;
  rootCause: string;
  context: string;
  suggestedImprovement: string;
  affectedInputPatterns: string[];
}

// =============================================================================
// Memory Interfaces (Memory_Store)
// =============================================================================

/** An entry stored in the memory system */
export interface MemoryEntry {
  id: string;
  namespace: MemoryNamespace;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
  relevanceScore: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

/** Query parameters for retrieving memory entries */
export interface MemoryQuery {
  semanticQuery: string;
  namespace?: MemoryNamespace;
  projectId?: string;
  maxResults?: number;
  minRelevance?: number;
  timeRange?: TimeRange;
}

/** Metadata associated with a memory entry */
export interface MemoryMetadata {
  taskId?: string;
  projectId?: string;
  language?: string;
  domain?: string;
  tags: string[];
  outcome?: 'success' | 'failure' | 'partial';
}

/** Contextual information about a project */
export interface ProjectContext {
  projectId: string;
  structure: FileTree;
  dependencies: DependencyGraph;
  codingStandards: CodingStandards;
  recentChanges: Commit[];
  activeAgents: AgentInstance[];
  userPreferences: UserPreferences;
}

/** Configuration for memory relevance decay */
export interface DecayConfig {
  capacityThreshold: number;
  decayRate: number;
  preservationThreshold: number;
  highImpactBoost: number;
}

/** Report from running the decay algorithm */
export interface DecayReport {
  entriesProcessed: number;
  entriesArchived: number;
  entriesPreserved: number;
  spaceReclaimed: number;
  timestamp: number;
}

/** A time range for querying */
export interface TimeRange {
  start: number;
  end: number;
}

/** Representation of a project file tree */
export interface FileTree {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileTree[];
}

/** User preferences stored in memory */
export interface UserPreferences {
  preferredLanguages: string[];
  codingStyle: string;
  verbosityLevel: 'minimal' | 'standard' | 'verbose';
  autoApprove: boolean;
  customRules: string[];
}

/** Coding standards configuration for a project */
export interface CodingStandards {
  namingConventions: Record<string, string>;
  documentationRequirements: string[];
  architecturalPatterns: string[];
  lintRules: Record<string, unknown>;
  maxComplexity: number;
}

// =============================================================================
// Error/Recovery Interfaces (Recovery_Manager)
// =============================================================================

/** Captured error with full context for diagnosis */
export interface ErrorCapture {
  id: string;
  timestamp: number;
  errorType: string;
  message: string;
  stackTrace: string;
  inputState: unknown;
  executionHistory: ExecutionStep[];
  agentId: string;
  taskId: string;
}

/** A strategy for recovering from an error */
export interface RecoveryStrategy {
  id: string;
  name: string;
  applicableErrors: string[];
  steps: RecoveryStep[];
  maxAttempts: number;
  successRate: number;
}

/** Result of executing a recovery strategy */
export interface RecoveryResult {
  success: boolean;
  strategyUsed: string;
  attemptsNeeded: number;
  timeToRecover: number;
  sideEffects: string[];
}

/** A single step in a recovery strategy */
export interface RecoveryStep {
  order: number;
  action: string;
  description: string;
  timeout: number;
  rollbackOnFailure: boolean;
}

/** Classification of an error for strategy selection */
export interface ErrorClassification {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  rootCause: string;
  relatedPatterns: string[];
}

/** A step in an execution trace for debugging */
export interface ExecutionStep {
  stepIndex: number;
  action: string;
  input: unknown;
  output: unknown;
  timestamp: number;
  duration: number;
  status: 'success' | 'failed' | 'skipped';
}

/** A runtime error encountered during agent execution */
export interface RuntimeError {
  type: string;
  message: string;
  stackTrace: string;
  timestamp: number;
  agentId: string;
  taskId: string;
  context: Record<string, unknown>;
}

/** Alert when system performance degrades */
export interface DegradationAlert {
  metricName: string;
  currentValue: number;
  baselineValue: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: number;
  suggestedAction: string;
}

/** An issue that cannot be recovered automatically */
export interface UnrecoverableIssue {
  errorCapture: ErrorCapture;
  attemptedStrategies: string[];
  totalAttempts: number;
  recommendation: string;
}

/** Report generated when escalating to the user */
export interface EscalationReport {
  issueId: string;
  summary: string;
  diagnostics: string;
  attemptedRecoveries: RecoveryResult[];
  recommendations: string[];
  timestamp: number;
}

/** Context provided to the recovery manager */
export interface ExecutionContext {
  taskId: string;
  agentId: string;
  currentStep: ExecutionStep;
  previousSteps: ExecutionStep[];
  availableResources: ResourceLimits;
  checkpointId?: string;
}

// =============================================================================
// Tool Interfaces (Tool_Registry)
// =============================================================================

/** A registered tool available to agents */
export interface Tool {
  id: string;
  name: string;
  description: string;
  interfaceDefinition: InterfaceDefinition;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  implementation: string;
  tests: TestSuite;
  documentation: string;
  safetyChecklist: SafetyCheckResult;
  status: 'draft' | 'validated' | 'active' | 'deprecated';
}

/** Specification for creating a new tool */
export interface ToolSpecification {
  name: string;
  description: string;
  interfaceDefinition: InterfaceDefinition;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  requirements: string[];
  safetyRequirements: string[];
}

/** Requirement description for finding a tool */
export interface ToolRequirement {
  capability: string;
  inputTypes: string[];
  outputTypes: string[];
  constraints?: string[];
}

/** Adapter for integrating with external services */
export interface IntegrationAdapter {
  serviceId: string;
  endpoint: string;
  retryPolicy: RetryPolicy;
  rateLimiter: RateLimitConfig;
  fallbackStrategy: FallbackStrategy;
  timeout: number;
}

/** Configuration for retry behavior */
export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fibonacci';
  initialDelay: number;
  maxDelay: number;
}

/** Configuration for rate limiting */
export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  burstLimit: number;
  cooldownMs: number;
}

/** Strategy for handling failures with fallbacks */
export interface FallbackStrategy {
  type: 'retry' | 'cache' | 'degrade' | 'abort';
  fallbackEndpoint?: string;
  cachedResponseTTL?: number;
  degradedCapabilities?: string[];
}

/** Result of validating a tool */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: number;
}

/** Result of a safety check on a tool */
export interface SafetyCheckResult {
  passed: boolean;
  inputSanitization: boolean;
  resourceLimits: boolean;
  sandboxedExecution: boolean;
  issues: string[];
}

/** Interface definition for a tool */
export interface InterfaceDefinition {
  name: string;
  methods: MethodDefinition[];
  version: string;
}

/** Definition of a single method in an interface */
export interface MethodDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  description: string;
}

/** Definition of a method parameter */
export interface ParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** External service configuration */
export interface ExternalService {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'none' | 'api_key' | 'oauth' | 'basic';
  documentation: string;
}

/** JSON Schema representation */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  enum?: string[];
  additionalProperties?: boolean;
}

/** A test suite for validating a tool */
export interface TestSuite {
  id: string;
  name: string;
  tests: TestCase[];
  coverage: number;
}

/** A single test case */
export interface TestCase {
  id: string;
  name: string;
  input: unknown;
  expectedOutput: unknown;
  assertions: string[];
}

// =============================================================================
// Quality Interfaces (Quality_Assurer)
// =============================================================================

/** Result of a code review */
export interface ReviewResult {
  passed: boolean;
  issues: QualityIssue[];
  suggestions: Suggestion[];
  metrics: QualityMetrics;
}

/** A quality issue found during review */
export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'lint' | 'type' | 'pattern' | 'security' | 'performance';
  location: CodeLocation;
  message: string;
  remediation: string;
  autoFixable: boolean;
}

/** Metrics from a quality review */
export interface QualityMetrics {
  lintScore: number;
  typeCheckPassed: boolean;
  testCoverage: number;
  cyclomaticComplexity: number;
  documentationCoverage: number;
}

/** A suggestion for improving code quality */
export interface Suggestion {
  type: string;
  description: string;
  location: CodeLocation;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
}

/** A location in source code */
export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

/** Result of a compliance check */
export interface ComplianceResult {
  compliant: boolean;
  violations: QualityIssue[];
  standardsChecked: string[];
  checkedAt: number;
}

/** Coverage report for tests */
export interface CoverageReport {
  totalLines: number;
  coveredLines: number;
  coveragePercent: number;
  uncoveredPaths: string[];
  branchCoverage: number;
}

/** Code output from an agent */
export interface CodeOutput {
  filePath: string;
  content: string;
  language: string;
  agentId: string;
  taskId: string;
}

/** Result of static analysis */
export interface StaticAnalysisResult {
  passed: boolean;
  errors: QualityIssue[];
  warnings: QualityIssue[];
  info: QualityIssue[];
  analysisTime: number;
}

// =============================================================================
// Version Control Interfaces (Version_Controller)
// =============================================================================

/** A saved checkpoint of file states before modification */
export interface Checkpoint {
  id: string;
  taskId: string;
  timestamp: number;
  fileSnapshots: FileSnapshot[];
  branchName: string;
}

/** A code change produced by an agent */
export interface CodeChange {
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  diff: string;
  agentId: string;
  taskId: string;
}

/** Result of a rollback operation */
export interface RollbackResult {
  success: boolean;
  revertedFiles: string[];
  preservedFiles: string[];
  conflictsEncountered: MergeConflict[];
}

/** A conflict between two changes to the same code region */
export interface MergeConflict {
  filePath: string;
  conflictRegion: { startLine: number; endLine: number };
  ourChange: string;
  theirChange: string;
  agentIds: [string, string];
}

/** A snapshot of a file at a point in time */
export interface FileSnapshot {
  filePath: string;
  content: string;
  hash: string;
  timestamp: number;
}

/** A committed set of changes */
export interface Commit {
  id: string;
  message: string;
  changes: CodeChange[];
  author: string;
  timestamp: number;
  parentId: string | null;
}

/** A branch in version control */
export interface Branch {
  name: string;
  headCommitId: string;
  baseBranch: string;
  createdAt: number;
  status: 'active' | 'merged' | 'abandoned';
}

/** Result of merging two branches */
export interface MergeResult {
  success: boolean;
  mergedCommitId?: string;
  conflicts: MergeConflict[];
  filesModified: string[];
}

/** A resolution to a merge conflict */
export interface Resolution {
  conflictId: string;
  resolvedContent: string;
  strategy: 'ours' | 'theirs' | 'manual' | 'ai_resolved';
  resolvedBy: string;
}

// =============================================================================
// Performance Interfaces (Performance_Monitor)
// =============================================================================

/** Metrics recorded for a single task execution */
export interface ExecutionMetrics {
  taskId: string;
  agentId: string;
  category: string;
  executionTime: number;
  resourceConsumption: ResourceUsage;
  successRate: number;
  qualityScore: number;
  timestamp: number;
}

/** Baseline performance metrics for a task category */
export interface BaselineMetrics {
  category: string;
  meanExecutionTime: number;
  stdDevExecutionTime: number;
  meanResourceUsage: ResourceUsage;
  sampleSize: number;
}

/** A performance report for a time period */
export interface PerformanceReport {
  period: TimeRange;
  throughput: number;
  errorRate: number;
  avgResponseTime: number;
  resourceUtilization: number;
  improvementTrend: number;
  topBottlenecks: string[];
}

/** Metrics about parallel execution efficiency */
export interface ParallelismMetrics {
  wallClockTime: number;
  cumulativeAgentTime: number;
  parallelismRatio: number;
  maxConcurrentAgents: number;
}

/** An anomaly detected in performance metrics */
export interface Anomaly {
  metricName: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  timestamp: number;
  category: string;
}

/** A suggestion for optimizing performance */
export interface OptimizationSuggestion {
  operationType: string;
  currentMetrics: ExecutionMetrics;
  suggestedApproach: string;
  estimatedImprovement: number;
  priority: Priority;
}

// =============================================================================
// Feedback Interfaces (Feedback_Loop)
// =============================================================================

/** A correction provided by the user */
export interface UserCorrection {
  originalOutput: string;
  correctedOutput: string;
  explanation?: string;
  affectedSkillId?: string;
}

/** A pattern extracted from user corrections */
export interface CorrectionPattern {
  patternType: string;
  rootCause: string;
  affectedCategories: string[];
  suggestedFix: string;
  frequency: number;
}

/** A pattern that recurs across multiple corrections */
export interface RecurringPattern {
  patternId: string;
  occurrences: number;
  categories: string[];
  examples: CorrectionPattern[];
  generalizableRule: string;
}

/** A quality rule generated from recurring patterns */
export interface QualityRule {
  id: string;
  name: string;
  description: string;
  pattern: RecurringPattern;
  enforcement: 'error' | 'warning' | 'suggestion';
  appliesTo: string[];
  createdAt: number;
}

// =============================================================================
// Communication Interfaces (Agent Events & Orchestration)
// =============================================================================

/** An event emitted by an agent for monitoring */
export interface AgentEvent {
  eventType: string;
  agentId: string;
  taskId: string;
  payload: unknown;
  timestamp: number;
  correlationId: string;
}

/** A change in project context that may affect execution */
export interface ContextChange {
  changeType: 'file_added' | 'file_modified' | 'file_deleted' | 'requirement_updated' | 'dependency_changed';
  affectedPaths: string[];
  description: string;
  timestamp: number;
}

/** A complexity score for a task or subtask */
export interface ComplexityScore {
  overall: number;
  dimensions: Record<string, number>;
  confidence: number;
  decomposable: boolean;
}

/** The final result of a top-level task */
export interface TaskResult {
  taskId: string;
  subtaskResults: SubTaskResult[];
  codeChanges: CodeChange[];
  qualityReport: ReviewResult;
  metrics: ParallelismMetrics;
  totalDuration: number;
}

/** Result of a single subtask execution */
export interface SubTaskResult {
  subtaskId: string;
  agentId: string;
  output: unknown;
  duration: number;
  retries: number;
  status: 'success' | 'failed' | 'skipped';
}

/** A top-level task in the system */
export interface Task {
  id: string;
  intent: ResolvedIntent;
  status: TaskStatus;
  decompositionPlan: DecompositionPlan;
  executionTimeline: ExecutionEvent[];
  result: TaskResult | null;
  createdAt: number;
  completedAt: number | null;
}

/** A record of task execution for timeline tracking */
export interface TaskExecution {
  taskId: string;
  startTime: number;
  endTime: number | null;
  status: TaskStatus;
  agents: AgentInstance[];
  events: ExecutionEvent[];
}

/** An event occurring during task execution */
export interface ExecutionEvent {
  eventType: string;
  timestamp: number;
  agentId?: string;
  taskId: string;
  details: unknown;
}
