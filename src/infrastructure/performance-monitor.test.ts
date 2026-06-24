// Feature: autonomous-coding-agent, Property 36: Performance anomaly detection
// Feature: autonomous-coding-agent, Property 37: Idle agent resource release

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PerformanceMonitor } from './performance-monitor';
import { ExecutionMetrics, ResourceUsage } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

/** Arbitrary for ResourceUsage with realistic ranges */
const resourceUsageArb: fc.Arbitrary<ResourceUsage> = fc.record({
  cpuPercent: fc.double({ min: 0, max: 100, noNaN: true }),
  memoryMB: fc.double({ min: 0, max: 16384, noNaN: true }),
  networkIO: fc.double({ min: 0, max: 10000, noNaN: true }),
  diskIO: fc.double({ min: 0, max: 10000, noNaN: true }),
});

/** Arbitrary for ExecutionMetrics with configurable execution time range */
function executionMetricsArb(opts?: {
  executionTimeMin?: number;
  executionTimeMax?: number;
  category?: string;
  agentId?: string;
}): fc.Arbitrary<ExecutionMetrics> {
  const minTime = opts?.executionTimeMin ?? 10;
  const maxTime = opts?.executionTimeMax ?? 5000;

  return fc.record({
    taskId: fc.uuid(),
    agentId: fc.constant(opts?.agentId ?? 'agent-1'),
    category: fc.constant(opts?.category ?? 'default'),
    executionTime: fc.double({ min: minTime, max: maxTime, noNaN: true }),
    resourceConsumption: resourceUsageArb,
    successRate: fc.double({ min: 0, max: 1, noNaN: true }),
    qualityScore: fc.double({ min: 0, max: 1, noNaN: true }),
    timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  });
}

// =============================================================================
// Property 36: Performance anomaly detection
// =============================================================================
// **Validates: Requirements 13.2**
//
// For any execution metric value where the absolute deviation from the baseline
// mean exceeds 2 standard deviations, the Performance_Monitor SHALL generate
// an alert. Set up a baseline with stable metrics, then test with a metric far
// outside the range.

describe('Property 36: Performance anomaly detection', () => {
  it('metrics exceeding 2 standard deviations from baseline trigger anomaly alerts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a stable baseline execution time (the "center" value)
        fc.double({ min: 100, max: 2000, noNaN: true }),
        // Generate a small stddev for the baseline (to keep baseline tight)
        fc.double({ min: 1, max: 50, noNaN: true }),
        // Generate a deviation multiplier > 2 (ensures anomaly threshold exceeded)
        fc.double({ min: 2.5, max: 10, noNaN: true }),
        // Generate direction of deviation (above or below)
        fc.boolean(),
        async (baselineMean, baselineStdDev, deviationMultiplier, above) => {
          const monitor = new PerformanceMonitor();
          const category = 'test-category';

          // Record 15 stable metrics to establish a baseline
          // All metrics have execution time = baselineMean (zero variance in exec time)
          for (let i = 0; i < 15; i++) {
            const stableMetrics: ExecutionMetrics = {
              taskId: `task-${i}`,
              agentId: 'agent-baseline',
              category,
              executionTime: baselineMean,
              resourceConsumption: {
                cpuPercent: 50,
                memoryMB: 512,
                networkIO: 100,
                diskIO: 50,
              },
              successRate: 1,
              qualityScore: 0.9,
              timestamp: Date.now() + i * 1000,
            };
            await monitor.recordExecution(stableMetrics.taskId, stableMetrics);
          }

          // Get the computed baseline
          const baseline = monitor.getBaseline(category);
          expect(baseline).not.toBeNull();

          // Since all values are identical, stdDev will be 0.
          // To properly test, we need some variance. Let's add a few varied samples.
          // Re-create with slight variance using baselineStdDev
          const monitor2 = new PerformanceMonitor();
          for (let i = 0; i < 15; i++) {
            // Alternate slightly above and below the mean to create non-zero stddev
            const offset = i % 2 === 0 ? baselineStdDev * 0.5 : -baselineStdDev * 0.5;
            const stableMetrics: ExecutionMetrics = {
              taskId: `task-${i}`,
              agentId: 'agent-baseline',
              category,
              executionTime: baselineMean + offset,
              resourceConsumption: {
                cpuPercent: 50,
                memoryMB: 512,
                networkIO: 100,
                diskIO: 50,
              },
              successRate: 1,
              qualityScore: 0.9,
              timestamp: Date.now() + i * 1000,
            };
            await monitor2.recordExecution(stableMetrics.taskId, stableMetrics);
          }

          const baseline2 = monitor2.getBaseline(category);
          expect(baseline2).not.toBeNull();
          // The stdDev should be approximately baselineStdDev * 0.5
          // (half the values are +0.5*stdDev and half are -0.5*stdDev)
          expect(baseline2!.stdDevExecutionTime).toBeGreaterThan(0);

          // Create an anomalous metric that deviates by more than 2 std devs
          const anomalousExecTime = above
            ? baseline2!.meanExecutionTime + deviationMultiplier * baseline2!.stdDevExecutionTime
            : baseline2!.meanExecutionTime - deviationMultiplier * baseline2!.stdDevExecutionTime;

          // Ensure execution time is positive
          if (anomalousExecTime <= 0) return; // skip degenerate case

          const anomalousMetrics: ExecutionMetrics = {
            taskId: 'task-anomaly',
            agentId: 'agent-anomaly',
            category,
            executionTime: anomalousExecTime,
            resourceConsumption: {
              cpuPercent: 50,
              memoryMB: 512,
              networkIO: 100,
              diskIO: 50,
            },
            successRate: 1,
            qualityScore: 0.9,
            timestamp: Date.now() + 20000,
          };

          // Detect anomalies
          const anomalies = monitor2.detectAnomalies(anomalousMetrics, baseline2!);

          // The executionTime anomaly should be detected
          const execTimeAnomaly = anomalies.find(a => a.metricName === 'executionTime');
          expect(execTimeAnomaly).toBeDefined();
          expect(execTimeAnomaly!.deviation).toBeGreaterThan(2);
          expect(execTimeAnomaly!.currentValue).toBe(anomalousExecTime);
          expect(execTimeAnomaly!.category).toBe(category);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 37: Idle agent resource release
// =============================================================================
// **Validates: Requirements 13.4, 13.5**
//
// For any agent instance with no assigned task and idle time exceeding 60 seconds
// (or a given threshold), identifyIdleAgents SHALL return that agent's ID.

describe('Property 37: Idle agent resource release', () => {
  it('agents idle longer than the threshold are identified for resource release', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a threshold in ms (between 1s and 120s)
        fc.integer({ min: 1000, max: 120_000 }),
        // Generate the number of agents (1 to 10)
        fc.integer({ min: 1, max: 10 }),
        // Generate the idle duration beyond threshold (positive offset in ms)
        fc.integer({ min: 1, max: 60_000 }),
        async (threshold, numAgents, idleExcess) => {
          const monitor = new PerformanceMonitor();

          const now = Date.now();
          const agentIds: string[] = [];

          // Record activity for agents that should be idle
          // Their last activity was (threshold + idleExcess) ms ago
          for (let i = 0; i < numAgents; i++) {
            const agentId = `idle-agent-${i}`;
            agentIds.push(agentId);

            const metrics: ExecutionMetrics = {
              taskId: `task-idle-${i}`,
              agentId,
              category: 'idle-test',
              executionTime: 100,
              resourceConsumption: {
                cpuPercent: 10,
                memoryMB: 256,
                networkIO: 10,
                diskIO: 5,
              },
              successRate: 1,
              qualityScore: 0.9,
              // Last activity was well before the threshold
              timestamp: now - threshold - idleExcess,
            };
            await monitor.recordExecution(metrics.taskId, metrics);
          }

          // Identify idle agents
          const idleAgents = monitor.identifyIdleAgents(threshold);

          // All agents should be identified as idle since their last activity
          // exceeds the threshold
          for (const agentId of agentIds) {
            expect(idleAgents).toContain(agentId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('agents active within the threshold are NOT identified as idle', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a threshold in ms (between 1s and 120s)
        fc.integer({ min: 1000, max: 120_000 }),
        // Generate the number of active agents (1 to 10)
        fc.integer({ min: 1, max: 10 }),
        // Generate how recently they were active (within threshold)
        fc.integer({ min: 0, max: 500 }),
        async (threshold, numAgents, recentOffset) => {
          const monitor = new PerformanceMonitor();

          const now = Date.now();
          const activeAgentIds: string[] = [];

          // Record activity for agents that should NOT be idle
          // Their last activity was only recentOffset ms ago (well within threshold)
          for (let i = 0; i < numAgents; i++) {
            const agentId = `active-agent-${i}`;
            activeAgentIds.push(agentId);

            const metrics: ExecutionMetrics = {
              taskId: `task-active-${i}`,
              agentId,
              category: 'active-test',
              executionTime: 100,
              resourceConsumption: {
                cpuPercent: 50,
                memoryMB: 512,
                networkIO: 50,
                diskIO: 20,
              },
              successRate: 1,
              qualityScore: 0.9,
              // Last activity is recent (within threshold)
              timestamp: now - recentOffset,
            };
            await monitor.recordExecution(metrics.taskId, metrics);
          }

          // Identify idle agents with the threshold
          const idleAgents = monitor.identifyIdleAgents(threshold);

          // None of the active agents should be flagged as idle
          for (const agentId of activeAgentIds) {
            expect(idleAgents).not.toContain(agentId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
