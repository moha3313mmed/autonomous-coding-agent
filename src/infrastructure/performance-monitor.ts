import {
  ExecutionMetrics,
  BaselineMetrics,
  PerformanceReport,
  ParallelismMetrics,
  Anomaly,
  OptimizationSuggestion,
  TimeRange,
  ResourceUsage,
  Priority,
} from '../shared/types';

/**
 * PerformanceMonitor tracks execution metrics, computes baselines,
 * detects anomalies, and generates performance reports.
 */
export class PerformanceMonitor {
  /** category -> list of recorded execution metrics */
  private metricsHistory: Map<string, ExecutionMetrics[]> = new Map();

  /** agentId -> last activity timestamp (ms) */
  private agentActivity: Map<string, number> = new Map();

  /** operationType -> expected execution time in ms */
  private timeBudgets: Map<string, number> = new Map();

  /**
   * Records metrics for a task execution.
   * Stores the metrics under the appropriate category and updates agent activity.
   */
  async recordExecution(taskId: string, metrics: ExecutionMetrics): Promise<void> {
    const category = metrics.category;

    if (!this.metricsHistory.has(category)) {
      this.metricsHistory.set(category, []);
    }

    this.metricsHistory.get(category)!.push(metrics);

    // Update agent activity timestamp
    this.agentActivity.set(metrics.agentId, metrics.timestamp);
  }

  /**
   * Computes mean and standard deviation for a category from recorded metrics.
   * Returns null if fewer than 10 samples exist.
   * Uses a rolling window of the last 100 executions per category.
   */
  getBaseline(category: string): BaselineMetrics | null {
    const history = this.metricsHistory.get(category);

    if (!history || history.length < 10) {
      return null;
    }

    // Rolling window of last 100 executions
    const window = history.slice(-100);
    const sampleSize = window.length;

    // Compute mean execution time
    const meanExecutionTime =
      window.reduce((sum, m) => sum + m.executionTime, 0) / sampleSize;

    // Compute standard deviation (population formula)
    const variance =
      window.reduce(
        (sum, m) => sum + Math.pow(m.executionTime - meanExecutionTime, 2),
        0
      ) / sampleSize;
    const stdDevExecutionTime = Math.sqrt(variance);

    // Compute mean resource usage
    const meanResourceUsage: ResourceUsage = {
      cpuPercent:
        window.reduce((sum, m) => sum + m.resourceConsumption.cpuPercent, 0) /
        sampleSize,
      memoryMB:
        window.reduce((sum, m) => sum + m.resourceConsumption.memoryMB, 0) /
        sampleSize,
      networkIO:
        window.reduce((sum, m) => sum + m.resourceConsumption.networkIO, 0) /
        sampleSize,
      diskIO:
        window.reduce((sum, m) => sum + m.resourceConsumption.diskIO, 0) /
        sampleSize,
    };

    return {
      category,
      meanExecutionTime,
      stdDevExecutionTime,
      meanResourceUsage,
      sampleSize,
    };
  }

  /**
   * Compares metrics against baseline, returns anomalies where
   * the deviation exceeds 2 standard deviations.
   */
  detectAnomalies(metrics: ExecutionMetrics, baseline: BaselineMetrics): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check execution time
    const execTimeDeviation = Math.abs(
      metrics.executionTime - baseline.meanExecutionTime
    );
    if (execTimeDeviation > 2 * baseline.stdDevExecutionTime) {
      anomalies.push({
        metricName: 'executionTime',
        currentValue: metrics.executionTime,
        expectedValue: baseline.meanExecutionTime,
        deviation: execTimeDeviation / baseline.stdDevExecutionTime,
        timestamp: metrics.timestamp,
        category: metrics.category,
      });
    }

    // Check CPU usage
    const cpuDeviation = Math.abs(
      metrics.resourceConsumption.cpuPercent -
        baseline.meanResourceUsage.cpuPercent
    );
    if (baseline.stdDevExecutionTime > 0) {
      // Use resource-specific deviation check
      const cpuValues = this.getMetricsWindow(metrics.category).map(
        (m) => m.resourceConsumption.cpuPercent
      );
      const cpuMean = baseline.meanResourceUsage.cpuPercent;
      const cpuStdDev = this.computeStdDev(cpuValues, cpuMean);
      if (cpuStdDev > 0 && cpuDeviation > 2 * cpuStdDev) {
        anomalies.push({
          metricName: 'cpuPercent',
          currentValue: metrics.resourceConsumption.cpuPercent,
          expectedValue: cpuMean,
          deviation: cpuDeviation / cpuStdDev,
          timestamp: metrics.timestamp,
          category: metrics.category,
        });
      }
    }

    // Check memory usage
    const memValues = this.getMetricsWindow(metrics.category).map(
      (m) => m.resourceConsumption.memoryMB
    );
    const memMean = baseline.meanResourceUsage.memoryMB;
    const memStdDev = this.computeStdDev(memValues, memMean);
    const memDeviation = Math.abs(
      metrics.resourceConsumption.memoryMB - memMean
    );
    if (memStdDev > 0 && memDeviation > 2 * memStdDev) {
      anomalies.push({
        metricName: 'memoryMB',
        currentValue: metrics.resourceConsumption.memoryMB,
        expectedValue: memMean,
        deviation: memDeviation / memStdDev,
        timestamp: metrics.timestamp,
        category: metrics.category,
      });
    }

    return anomalies;
  }

  /**
   * Flags an operation for optimization if it consistently exceeds
   * the time budget by 50%+.
   * Checks the last 10 executions — if 5+ exceed 150% of the baseline mean, flag it.
   */
  flagForOptimization(
    operationType: string,
    metrics: ExecutionMetrics
  ): OptimizationSuggestion | null {
    const history = this.metricsHistory.get(metrics.category);
    if (!history || history.length < 10) {
      return null;
    }

    const baseline = this.getBaseline(metrics.category);
    if (!baseline) {
      return null;
    }

    const threshold = baseline.meanExecutionTime * 1.5;

    // Check last 10 executions
    const lastTen = history.slice(-10);
    const exceedCount = lastTen.filter(
      (m) => m.executionTime > threshold
    ).length;

    if (exceedCount >= 5) {
      return {
        operationType,
        currentMetrics: metrics,
        suggestedApproach: `Operation "${operationType}" consistently exceeds time budget. ${exceedCount}/10 recent executions exceeded 150% of baseline mean (${baseline.meanExecutionTime.toFixed(0)}ms). Consider caching, parallelization, or algorithm optimization.`,
        estimatedImprovement:
          (metrics.executionTime - baseline.meanExecutionTime) /
          metrics.executionTime,
        priority: exceedCount >= 8 ? 'critical' : exceedCount >= 6 ? 'high' : 'medium',
      };
    }

    return null;
  }

  /**
   * Returns agent IDs that have been idle longer than the threshold (in ms).
   */
  identifyIdleAgents(threshold: number): string[] {
    const now = Date.now();
    const idleAgents: string[] = [];

    for (const [agentId, lastActivity] of this.agentActivity.entries()) {
      if (now - lastActivity > threshold) {
        idleAgents.push(agentId);
      }
    }

    return idleAgents;
  }

  /**
   * Generates a performance summary for a given time period.
   */
  generateReport(timeRange: TimeRange): PerformanceReport {
    const allMetrics: ExecutionMetrics[] = [];

    for (const [, categoryMetrics] of this.metricsHistory) {
      for (const m of categoryMetrics) {
        if (m.timestamp >= timeRange.start && m.timestamp <= timeRange.end) {
          allMetrics.push(m);
        }
      }
    }

    const totalTasks = allMetrics.length;
    const duration = timeRange.end - timeRange.start;

    // Throughput: tasks per second
    const throughput = duration > 0 ? totalTasks / (duration / 1000) : 0;

    // Error rate: proportion of tasks with successRate < 1
    const failedTasks = allMetrics.filter((m) => m.successRate < 1).length;
    const errorRate = totalTasks > 0 ? failedTasks / totalTasks : 0;

    // Average response time
    const avgResponseTime =
      totalTasks > 0
        ? allMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalTasks
        : 0;

    // Resource utilization: average CPU usage
    const resourceUtilization =
      totalTasks > 0
        ? allMetrics.reduce(
            (sum, m) => sum + m.resourceConsumption.cpuPercent,
            0
          ) / totalTasks
        : 0;

    // Improvement trend: compare first half vs second half avg execution time
    let improvementTrend = 0;
    if (totalTasks >= 2) {
      const midpoint = Math.floor(totalTasks / 2);
      const sortedByTime = [...allMetrics].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      const firstHalf = sortedByTime.slice(0, midpoint);
      const secondHalf = sortedByTime.slice(midpoint);
      const firstAvg =
        firstHalf.reduce((sum, m) => sum + m.executionTime, 0) /
        firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, m) => sum + m.executionTime, 0) /
        secondHalf.length;
      if (firstAvg > 0) {
        improvementTrend = (firstAvg - secondAvg) / firstAvg;
      }
    }

    // Top bottlenecks: categories with highest average execution time
    const categoryAvgs = new Map<string, number>();
    for (const m of allMetrics) {
      if (!categoryAvgs.has(m.category)) {
        categoryAvgs.set(m.category, 0);
      }
      categoryAvgs.set(
        m.category,
        categoryAvgs.get(m.category)! + m.executionTime
      );
    }
    const categoryCounts = new Map<string, number>();
    for (const m of allMetrics) {
      categoryCounts.set(
        m.category,
        (categoryCounts.get(m.category) || 0) + 1
      );
    }
    const topBottlenecks = [...categoryAvgs.entries()]
      .map(([cat, total]) => ({
        category: cat,
        avg: total / (categoryCounts.get(cat) || 1),
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map((entry) => entry.category);

    return {
      period: timeRange,
      throughput,
      errorRate,
      avgResponseTime,
      resourceUtilization,
      improvementTrend,
      topBottlenecks,
    };
  }

  /**
   * Sets the time budget for an operation type.
   */
  setTimeBudget(operationType: string, budgetMs: number): void {
    this.timeBudgets.set(operationType, budgetMs);
  }

  /**
   * Gets the time budget for an operation type.
   */
  getTimeBudget(operationType: string): number | undefined {
    return this.timeBudgets.get(operationType);
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Returns the rolling window of metrics for a category (last 100).
   */
  private getMetricsWindow(category: string): ExecutionMetrics[] {
    const history = this.metricsHistory.get(category);
    if (!history) return [];
    return history.slice(-100);
  }

  /**
   * Computes population standard deviation given values and their mean.
   */
  private computeStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }
}
