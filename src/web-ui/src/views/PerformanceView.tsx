import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import { ResourceGauge } from '../components/ui/ResourceGauge';

type TimeRange = '1h' | '24h' | '7d' | '30d';

interface MetricCard {
  label: string;
  value: string;
  change: number;
  color: string;
}

interface CategoryBreakdown {
  name: string;
  successRate: number;
  totalTasks: number;
  avgTime: string;
}

const MOCK_METRICS: MetricCard[] = [
  { label: 'Avg Execution Time', value: '2.4s', change: -12, color: 'text-accent-secondary' },
  { label: 'Throughput', value: '847/hr', change: 8, color: 'text-accent-primary' },
  { label: 'Error Rate', value: '1.2%', change: -3, color: 'text-status-completed' },
  { label: 'Queue Depth', value: '23', change: 5, color: 'text-status-warning' },
];

const MOCK_CATEGORIES: CategoryBreakdown[] = [
  { name: 'Code Generation', successRate: 94, totalTasks: 1240, avgTime: '3.2s' },
  { name: 'Testing', successRate: 87, totalTasks: 856, avgTime: '5.1s' },
  { name: 'Refactoring', successRate: 91, totalTasks: 432, avgTime: '2.8s' },
  { name: 'Documentation', successRate: 98, totalTasks: 678, avgTime: '1.4s' },
  { name: 'Debugging', successRate: 72, totalTasks: 321, avgTime: '8.6s' },
];

const OPTIMIZATION_ALERTS = [
  { id: '1', message: 'Memory allocation spike detected in code generation pipeline', severity: 'warning' as const },
  { id: '2', message: 'Parallelism utilization below 60% for testing tasks', severity: 'warning' as const },
];

function getSuccessRateColor(rate: number): string {
  if (rate >= 90) return 'bg-status-completed';
  if (rate >= 75) return 'bg-status-warning';
  return 'bg-status-failed';
}

function getSuccessRateTextColor(rate: number): string {
  if (rate >= 90) return 'text-status-completed';
  if (rate >= 75) return 'text-status-warning';
  return 'text-status-failed';
}

// Simulated chart data points
function generateChartPoints(count: number, min: number, max: number): number[] {
  return Array.from({ length: count }, () => Math.random() * (max - min) + min);
}

function MiniChart({ data, color, height = 60 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = height - ((val - min) / range) * (height - 10);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} 100,${height}`;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#gradient-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PerformanceView() {
  const { t } = useTranslation('common');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  const timeRanges: TimeRange[] = ['1h', '24h', '7d', '30d'];

  const executionData = generateChartPoints(24, 1.5, 4.5);
  const throughputData = generateChartPoints(24, 600, 1100);
  const errorData = generateChartPoints(24, 0.5, 3.5);

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.performance')}</h1>
          <div className="flex items-center gap-1 bg-dark-tertiary rounded-lg p-0.5">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-fast ${
                  timeRange === range
                    ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </AnimatedPanel>

      {/* Optimization Alerts */}
      {OPTIMIZATION_ALERTS.length > 0 && (
        <AnimatedPanel variant="slideUp" delay={0.05}>
          <div className="space-y-2">
            {OPTIMIZATION_ALERTS.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-status-warning/5 border border-status-warning/20"
              >
                <svg className="w-4 h-4 text-status-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-xs text-status-warning">{alert.message}</span>
              </motion.div>
            ))}
          </div>
        </AnimatedPanel>
      )}

      {/* Metric Cards */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
          {MOCK_METRICS.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel p-4"
            >
              <p className="text-xs text-text-muted mb-1">{metric.label}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-bold ${metric.color}`}>{metric.value}</span>
                <span
                  className={`text-xs font-medium ${
                    metric.change > 0 ? 'text-status-failed' : 'text-status-completed'
                  }`}
                >
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatedPanel>

      {/* Charts */}
      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-4">
        <AnimatedPanel variant="slideUp" delay={0.15}>
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-text-secondary">Execution Time</h2>
              <span className="text-xs text-text-muted">{timeRange}</span>
            </div>
            <div className="relative">
              <MiniChart data={executionData} color="#3b82f6" height={120} />
              <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-text-muted pt-2">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>24h</span>
              </div>
            </div>
          </div>
        </AnimatedPanel>

        <AnimatedPanel variant="slideUp" delay={0.2}>
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-text-secondary">Throughput</h2>
              <span className="text-xs text-text-muted">{timeRange}</span>
            </div>
            <div className="relative">
              <MiniChart data={throughputData} color="#10b981" height={120} />
              <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-text-muted pt-2">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>24h</span>
              </div>
            </div>
          </div>
        </AnimatedPanel>

        <AnimatedPanel variant="slideUp" delay={0.25}>
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-text-secondary">Error Rate</h2>
              <span className="text-xs text-text-muted">{timeRange}</span>
            </div>
            <div className="relative">
              <MiniChart data={errorData} color="#ef4444" height={120} />
              <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-text-muted pt-2">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>24h</span>
              </div>
            </div>
          </div>
        </AnimatedPanel>

        {/* Parallelism Efficiency */}
        <AnimatedPanel variant="slideUp" delay={0.3}>
          <div className="glass-panel p-5">
            <h2 className="text-sm font-medium text-text-secondary mb-4">Parallelism Efficiency</h2>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-dark-tertiary" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    className="text-accent-primary"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${73 * 2.51} ${100 * 2.51}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-accent-primary">73%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <ResourceGauge value={73} label="Worker Utilization" size="sm" />
              <ResourceGauge value={85} label="Task Distribution" size="sm" />
              <ResourceGauge value={62} label="Queue Efficiency" size="sm" />
            </div>
          </div>
        </AnimatedPanel>
      </div>

      {/* Category Breakdown */}
      <AnimatedPanel variant="slideUp" delay={0.35}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {MOCK_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-lg bg-dark-primary/50 hover:bg-dark-primary transition-colors duration-fast"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-primary font-medium">{cat.name}</span>
                    <span className={`text-sm font-bold ${getSuccessRateTextColor(cat.successRate)}`}>
                      {cat.successRate}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-dark-tertiary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.successRate}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className={`h-full rounded-full ${getSuccessRateColor(cat.successRate)}`}
                    />
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-xs text-text-muted">{cat.totalTasks.toLocaleString()} tasks</p>
                  <p className="text-xs text-text-muted">avg {cat.avgTime}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedPanel>
    </div>
  );
}
