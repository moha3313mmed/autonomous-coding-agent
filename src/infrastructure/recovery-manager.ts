import {
  ErrorCapture,
  RecoveryStrategy,
  RecoveryResult,
  RecoveryStep,
  ErrorClassification,
  ExecutionStep,
  RuntimeError,
  DegradationAlert,
  UnrecoverableIssue,
  EscalationReport,
  ExecutionContext,
  ExecutionMetrics,
  BaselineMetrics,
} from '../shared/types';

/**
 * RecoveryManager implements the MAPE-K (Monitor, Analyze, Plan, Execute, Knowledge)
 * loop for autonomous error recovery. It captures errors, classifies them, selects
 * recovery strategies, executes recovery steps, and escalates unrecoverable issues.
 */
export class RecoveryManager {
  private strategyLibrary: RecoveryStrategy[] = [];
  private errorHistory: ErrorCapture[] = [];
  private recoveryLog: RecoveryResult[] = [];

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Captures full error context including stack trace, input state, and last 50
   * execution steps from history. Must capture within 2 seconds of error occurrence.
   */
  async captureError(
    error: RuntimeError,
    context: ExecutionContext
  ): Promise<ErrorCapture> {
    const captureStart = Date.now();

    // Get last 50 execution steps from history
    const allSteps = [context.currentStep, ...context.previousSteps];
    const executionHistory = allSteps.slice(0, 50);

    const capture: ErrorCapture = {
      id: this.generateId(),
      timestamp: Date.now(),
      errorType: error.type,
      message: error.message,
      stackTrace: error.stackTrace,
      inputState: error.context,
      executionHistory,
      agentId: context.agentId,
      taskId: context.taskId,
    };

    // Ensure capture completes within 2 seconds
    const elapsed = Date.now() - captureStart;
    if (elapsed > 2000) {
      console.warn(
        `Error capture took ${elapsed}ms, exceeding 2-second threshold`
      );
    }

    this.errorHistory.push(capture);
    return capture;
  }

  /**
   * Classifies an error into categories using pattern matching on error type and message.
   * Categories: 'resource_exhaustion', 'external_service_failure', 'logic_error',
   * 'permission_error', 'data_corruption'.
   */
  classifyError(capture: ErrorCapture): ErrorClassification {
    const category = this.determineCategory(capture.errorType, capture.message);
    const severity = this.determineSeverity(category, capture);
    const recoverable = this.isRecoverable(category, severity);
    const rootCause = this.analyzeRootCause(capture);
    const relatedPatterns = this.findRelatedPatterns(capture);

    return {
      category,
      severity,
      recoverable,
      rootCause,
      relatedPatterns,
    };
  }

  /**
   * Selects the highest-ranked applicable recovery strategy from the strategy library.
   * Matches classification.category against strategy.applicableErrors, sorted by
   * success rate descending. Returns null if no strategy matches.
   */
  selectStrategy(classification: ErrorClassification): RecoveryStrategy | null {
    const applicableStrategies = this.strategyLibrary
      .filter((strategy) =>
        strategy.applicableErrors.includes(classification.category)
      )
      .sort((a, b) => b.successRate - a.successRate);

    if (applicableStrategies.length === 0) {
      return null;
    }

    return applicableStrategies[0];
  }

  /**
   * Executes recovery steps with retry logic. Max 3 attempts per strategy.
   * Tries each step in sequence; if any step fails and rollbackOnFailure is true, undoes it.
   */
  async executeRecovery(
    strategy: RecoveryStrategy,
    context: ExecutionContext
  ): Promise<RecoveryResult> {
    const maxAttempts = Math.min(strategy.maxAttempts, 3);
    const startTime = Date.now();
    let attemptsNeeded = 0;
    const sideEffects: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsNeeded = attempt;
      let allStepsSucceeded = true;
      const completedSteps: RecoveryStep[] = [];

      const sortedSteps = [...strategy.steps].sort(
        (a, b) => a.order - b.order
      );

      for (const step of sortedSteps) {
        const stepSuccess = await this.executeStep(step, context);

        if (stepSuccess) {
          completedSteps.push(step);
          sideEffects.push(`Executed: ${step.action}`);
        } else {
          allStepsSucceeded = false;

          // Rollback if configured
          if (step.rollbackOnFailure) {
            for (const completedStep of completedSteps.reverse()) {
              await this.rollbackStep(completedStep, context);
              sideEffects.push(`Rolled back: ${completedStep.action}`);
            }
          }
          break;
        }
      }

      if (allStepsSucceeded) {
        const result: RecoveryResult = {
          success: true,
          strategyUsed: strategy.name,
          attemptsNeeded,
          timeToRecover: Date.now() - startTime,
          sideEffects,
        };
        this.recoveryLog.push(result);
        return result;
      }
    }

    // All attempts exhausted
    const result: RecoveryResult = {
      success: false,
      strategyUsed: strategy.name,
      attemptsNeeded,
      timeToRecover: Date.now() - startTime,
      sideEffects,
    };
    this.recoveryLog.push(result);
    return result;
  }

  /**
   * Produces diagnostic summary after max retries. Includes attempted strategies
   * and recommendations for manual intervention.
   */
  async escalate(issue: UnrecoverableIssue): Promise<EscalationReport> {
    const attemptedRecoveries = this.recoveryLog.filter((log) =>
      issue.attemptedStrategies.includes(log.strategyUsed)
    );

    const recommendations = this.generateRecommendations(issue);
    const diagnostics = this.compileDiagnostics(issue);

    const report: EscalationReport = {
      issueId: this.generateId(),
      summary: `Unrecoverable error: ${issue.errorCapture.errorType} - ${issue.errorCapture.message}`,
      diagnostics,
      attemptedRecoveries,
      recommendations,
      timestamp: Date.now(),
    };

    return report;
  }

  /**
   * Generates alerts when current metrics exceed 2x the baseline mean.
   * Used for proactive failure prevention via degradation detection.
   */
  detectDegradation(
    metrics: ExecutionMetrics,
    baseline: BaselineMetrics
  ): DegradationAlert[] {
    const alerts: DegradationAlert[] = [];
    const threshold = 2 * baseline.meanExecutionTime;

    if (metrics.executionTime > threshold) {
      alerts.push({
        metricName: 'executionTime',
        currentValue: metrics.executionTime,
        baselineValue: baseline.meanExecutionTime,
        threshold,
        severity: metrics.executionTime > 4 * baseline.meanExecutionTime ? 'critical' : 'warning',
        timestamp: Date.now(),
        suggestedAction: 'Consider restarting agent or reducing workload',
      });
    }

    // Check resource consumption metrics
    if (
      metrics.resourceConsumption.cpuPercent >
      2 * baseline.meanResourceUsage.cpuPercent
    ) {
      alerts.push({
        metricName: 'cpuPercent',
        currentValue: metrics.resourceConsumption.cpuPercent,
        baselineValue: baseline.meanResourceUsage.cpuPercent,
        threshold: 2 * baseline.meanResourceUsage.cpuPercent,
        severity: 'warning',
        timestamp: Date.now(),
        suggestedAction: 'Investigate CPU-intensive operations',
      });
    }

    if (
      metrics.resourceConsumption.memoryMB >
      2 * baseline.meanResourceUsage.memoryMB
    ) {
      alerts.push({
        metricName: 'memoryMB',
        currentValue: metrics.resourceConsumption.memoryMB,
        baselineValue: baseline.meanResourceUsage.memoryMB,
        threshold: 2 * baseline.meanResourceUsage.memoryMB,
        severity: 'warning',
        timestamp: Date.now(),
        suggestedAction: 'Check for memory leaks or excessive caching',
      });
    }

    return alerts;
  }

  /**
   * Adds a new strategy to the strategy library.
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategyLibrary.push(strategy);
  }

  // =========================================================================
  // Public accessors for testing/inspection
  // =========================================================================

  getStrategyLibrary(): RecoveryStrategy[] {
    return [...this.strategyLibrary];
  }

  getErrorHistory(): ErrorCapture[] {
    return [...this.errorHistory];
  }

  getRecoveryLog(): RecoveryResult[] {
    return [...this.recoveryLog];
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private initializeDefaultStrategies(): void {
    this.strategyLibrary = [
      {
        id: 'strategy-restart-agent',
        name: 'restart_agent',
        applicableErrors: ['resource_exhaustion', 'logic_error'],
        steps: [
          {
            order: 1,
            action: 'save_state',
            description: 'Save current agent state to checkpoint',
            timeout: 5000,
            rollbackOnFailure: false,
          },
          {
            order: 2,
            action: 'terminate_agent',
            description: 'Gracefully terminate the failing agent',
            timeout: 10000,
            rollbackOnFailure: true,
          },
          {
            order: 3,
            action: 'spawn_replacement',
            description: 'Spawn a new agent with saved state',
            timeout: 15000,
            rollbackOnFailure: true,
          },
        ],
        maxAttempts: 3,
        successRate: 0.85,
      },
      {
        id: 'strategy-retry-backoff',
        name: 'retry_with_backoff',
        applicableErrors: ['external_service_failure'],
        steps: [
          {
            order: 1,
            action: 'wait_backoff',
            description: 'Wait with exponential backoff',
            timeout: 30000,
            rollbackOnFailure: false,
          },
          {
            order: 2,
            action: 'retry_operation',
            description: 'Retry the failed operation',
            timeout: 10000,
            rollbackOnFailure: false,
          },
        ],
        maxAttempts: 3,
        successRate: 0.75,
      },
      {
        id: 'strategy-rollback-checkpoint',
        name: 'rollback_to_checkpoint',
        applicableErrors: ['data_corruption'],
        steps: [
          {
            order: 1,
            action: 'identify_checkpoint',
            description: 'Find the most recent valid checkpoint',
            timeout: 5000,
            rollbackOnFailure: false,
          },
          {
            order: 2,
            action: 'restore_checkpoint',
            description: 'Restore system state from checkpoint',
            timeout: 20000,
            rollbackOnFailure: true,
          },
          {
            order: 3,
            action: 'verify_integrity',
            description: 'Verify data integrity after restoration',
            timeout: 10000,
            rollbackOnFailure: true,
          },
        ],
        maxAttempts: 3,
        successRate: 0.9,
      },
      {
        id: 'strategy-request-elevation',
        name: 'request_elevation',
        applicableErrors: ['permission_error'],
        steps: [
          {
            order: 1,
            action: 'identify_required_permissions',
            description: 'Determine which permissions are needed',
            timeout: 5000,
            rollbackOnFailure: false,
          },
          {
            order: 2,
            action: 'request_permissions',
            description: 'Request elevated permissions from orchestrator',
            timeout: 30000,
            rollbackOnFailure: false,
          },
          {
            order: 3,
            action: 'retry_with_elevation',
            description: 'Retry operation with elevated permissions',
            timeout: 10000,
            rollbackOnFailure: true,
          },
        ],
        maxAttempts: 3,
        successRate: 0.7,
      },
    ];
  }

  private determineCategory(errorType: string, message: string): string {
    const lowerType = errorType.toLowerCase();
    const lowerMessage = message.toLowerCase();

    if (
      lowerType.includes('memory') ||
      lowerType.includes('oom') ||
      lowerType.includes('resource') ||
      lowerMessage.includes('out of memory') ||
      lowerMessage.includes('resource exhausted') ||
      lowerMessage.includes('heap')
    ) {
      return 'resource_exhaustion';
    }

    if (
      lowerType.includes('network') ||
      lowerType.includes('timeout') ||
      lowerType.includes('connection') ||
      lowerType.includes('service') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('service unavailable') ||
      lowerMessage.includes('gateway timeout')
    ) {
      return 'external_service_failure';
    }

    if (
      lowerType.includes('permission') ||
      lowerType.includes('auth') ||
      lowerType.includes('forbidden') ||
      lowerMessage.includes('access denied') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('permission denied')
    ) {
      return 'permission_error';
    }

    if (
      lowerType.includes('corrupt') ||
      lowerType.includes('integrity') ||
      lowerType.includes('checksum') ||
      lowerMessage.includes('data corruption') ||
      lowerMessage.includes('invalid checksum') ||
      lowerMessage.includes('integrity violation')
    ) {
      return 'data_corruption';
    }

    // Default: logic_error
    return 'logic_error';
  }

  private determineSeverity(
    category: string,
    capture: ErrorCapture
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (category) {
      case 'data_corruption':
        return 'critical';
      case 'resource_exhaustion':
        return 'high';
      case 'external_service_failure':
        return 'medium';
      case 'permission_error':
        return 'medium';
      case 'logic_error':
        // Check if it has cascading effects based on execution history
        if (capture.executionHistory.length > 10) {
          return 'high';
        }
        return 'low';
      default:
        return 'medium';
    }
  }

  private isRecoverable(
    category: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): boolean {
    // Critical data corruption may not be recoverable without a checkpoint
    if (category === 'data_corruption' && severity === 'critical') {
      return true; // Still attempt via checkpoint rollback
    }

    // All categories have at least one strategy
    return this.strategyLibrary.some((s) =>
      s.applicableErrors.includes(category)
    );
  }

  private analyzeRootCause(capture: ErrorCapture): string {
    const failedSteps = capture.executionHistory.filter(
      (step) => step.status === 'failed'
    );

    if (failedSteps.length > 0) {
      const lastFailed = failedSteps[failedSteps.length - 1];
      return `Failed at step ${lastFailed.stepIndex}: ${lastFailed.action}`;
    }

    return `Error type: ${capture.errorType} - ${capture.message}`;
  }

  private findRelatedPatterns(capture: ErrorCapture): string[] {
    const patterns: string[] = [];

    // Find similar errors in history
    const similarErrors = this.errorHistory.filter(
      (prev) =>
        prev.id !== capture.id &&
        (prev.errorType === capture.errorType ||
          prev.message === capture.message)
    );

    if (similarErrors.length > 0) {
      patterns.push(
        `Recurring error: seen ${similarErrors.length} time(s) before`
      );
    }

    if (capture.executionHistory.some((step) => step.duration > 10000)) {
      patterns.push('Long-running operations detected before failure');
    }

    return patterns;
  }

  private async executeStep(
    step: RecoveryStep,
    _context: ExecutionContext
  ): Promise<boolean> {
    // Simulate step execution with timeout
    // In a real implementation, this would dispatch to actual recovery actions
    return new Promise((resolve) => {
      const timeout = Math.min(step.timeout, 100); // Cap for testing
      setTimeout(() => {
        // Steps succeed by default in the base implementation
        // Specific step logic would be implemented by subclasses or plugins
        resolve(true);
      }, timeout);
    });
  }

  private async rollbackStep(
    _step: RecoveryStep,
    _context: ExecutionContext
  ): Promise<void> {
    // Simulate rollback - in a real implementation, this would undo the step's action
    return Promise.resolve();
  }

  private generateRecommendations(issue: UnrecoverableIssue): string[] {
    const recommendations: string[] = [];

    recommendations.push(
      `Review error: ${issue.errorCapture.errorType} - ${issue.errorCapture.message}`
    );

    if (issue.attemptedStrategies.length > 0) {
      recommendations.push(
        `Strategies attempted without success: ${issue.attemptedStrategies.join(', ')}`
      );
    }

    recommendations.push(issue.recommendation);

    if (issue.errorCapture.executionHistory.length > 0) {
      const failedSteps = issue.errorCapture.executionHistory.filter(
        (s) => s.status === 'failed'
      );
      if (failedSteps.length > 0) {
        recommendations.push(
          `Investigate failed execution steps: ${failedSteps.map((s) => s.action).join(', ')}`
        );
      }
    }

    return recommendations;
  }

  private compileDiagnostics(issue: UnrecoverableIssue): string {
    const lines: string[] = [
      `Error Type: ${issue.errorCapture.errorType}`,
      `Message: ${issue.errorCapture.message}`,
      `Agent: ${issue.errorCapture.agentId}`,
      `Task: ${issue.errorCapture.taskId}`,
      `Timestamp: ${new Date(issue.errorCapture.timestamp).toISOString()}`,
      `Total Recovery Attempts: ${issue.totalAttempts}`,
      `Strategies Attempted: ${issue.attemptedStrategies.join(', ')}`,
      `Stack Trace: ${issue.errorCapture.stackTrace}`,
    ];

    return lines.join('\n');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
