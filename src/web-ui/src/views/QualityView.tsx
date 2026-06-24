import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import { ResourceGauge } from '../components/ui/ResourceGauge';

type Severity = 'error' | 'warning' | 'info';
type IssueCategory = 'lint' | 'type' | 'security' | 'performance' | 'style';

interface QualityIssue {
  id: string;
  severity: Severity;
  category: IssueCategory;
  file: string;
  line: number;
  description: string;
  remediation: string;
}

const MOCK_ISSUES: QualityIssue[] = [
  { id: '1', severity: 'error', category: 'type', file: 'src/auth/oauth.ts', line: 45, description: 'Type \'string | undefined\' is not assignable to type \'string\'', remediation: 'Add null check or use optional chaining with a default value' },
  { id: '2', severity: 'error', category: 'security', file: 'src/api/routes/users.ts', line: 23, description: 'SQL injection vulnerability: unsanitized user input in query', remediation: 'Use parameterized queries or ORM methods instead of string concatenation' },
  { id: '3', severity: 'warning', category: 'performance', file: 'src/db/queries.ts', line: 67, description: 'N+1 query pattern detected in loop', remediation: 'Use batch query or eager loading to reduce database round trips' },
  { id: '4', severity: 'warning', category: 'lint', file: 'src/utils/helpers.ts', line: 12, description: 'Function complexity exceeds threshold (cyclomatic: 15)', remediation: 'Extract sub-functions or use early returns to reduce complexity' },
  { id: '5', severity: 'warning', category: 'style', file: 'src/components/Dashboard.tsx', line: 89, description: 'Component exceeds 200 lines recommendation', remediation: 'Split into smaller, focused sub-components' },
  { id: '6', severity: 'info', category: 'lint', file: 'src/config/index.ts', line: 3, description: 'Unused import: \'deprecated_config\'', remediation: 'Remove unused import to reduce bundle size' },
  { id: '7', severity: 'info', category: 'style', file: 'src/types/api.ts', line: 34, description: 'Interface could be simplified using utility types', remediation: 'Consider using Pick<> or Omit<> instead of manual property listing' },
  { id: '8', severity: 'error', category: 'type', file: 'src/ws/handler.ts', line: 112, description: 'Property \'data\' does not exist on type \'WebSocketMessage\'', remediation: 'Add \'data\' property to WebSocketMessage interface or use type assertion' },
];

const SEVERITY_CONFIG: Record<Severity, { color: string; bgColor: string; borderColor: string; icon: string }> = {
  error: { color: 'text-status-failed', bgColor: 'bg-status-failed/10', borderColor: 'border-status-failed/20', icon: '✕' },
  warning: { color: 'text-status-warning', bgColor: 'bg-status-warning/10', borderColor: 'border-status-warning/20', icon: '⚠' },
  info: { color: 'text-accent-primary', bgColor: 'bg-accent-primary/10', borderColor: 'border-accent-primary/20', icon: 'ℹ' },
};

type FilterTab = 'all' | Severity | IssueCategory;

export function QualityView() {
  const { t } = useTranslation('common');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const qualityScore = 74;
  const lintScore = 88;
  const typeCheckScore = 72;
  const coverageScore = 65;
  const complexityScore = 81;

  const errorCount = MOCK_ISSUES.filter((i) => i.severity === 'error').length;
  const warningCount = MOCK_ISSUES.filter((i) => i.severity === 'warning').length;
  const infoCount = MOCK_ISSUES.filter((i) => i.severity === 'info').length;

  const filteredIssues = MOCK_ISSUES.filter((issue) => {
    if (activeFilter === 'all') return true;
    if (['error', 'warning', 'info'].includes(activeFilter)) return issue.severity === activeFilter;
    return issue.category === activeFilter;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-status-completed';
    if (score >= 60) return 'text-status-warning';
    return 'text-status-failed';
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <h1 className="text-2xl font-bold text-text-primary">{t('navigation.quality')}</h1>
      </AnimatedPanel>

      {/* Quality Score + Metrics */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
        {/* Main Score Gauge */}
        <AnimatedPanel variant="scale" delay={0.1}>
          <div className="glass-panel p-5 flex flex-col items-center justify-center tablet:col-span-2 desktop:col-span-1">
            <p className="text-xs text-text-muted mb-3">Quality Score</p>
            <div className="relative w-28 h-28 mb-2">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-dark-tertiary" strokeWidth="6" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={getScoreRingColor(qualityScore)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${qualityScore * 2.51} ${100 * 2.51}`}
                  className="transition-all duration-slow"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getScoreColor(qualityScore)}`}>{qualityScore}</span>
                <span className="text-[10px] text-text-muted">/ 100</span>
              </div>
            </div>
          </div>
        </AnimatedPanel>

        {/* Metric Gauges */}
        <AnimatedPanel variant="slideUp" delay={0.15}>
          <div className="glass-panel p-4 space-y-3">
            <ResourceGauge value={lintScore} label="Lint Score" size="sm" />
            <ResourceGauge value={typeCheckScore} label="Type Check" size="sm" />
          </div>
        </AnimatedPanel>

        <AnimatedPanel variant="slideUp" delay={0.2}>
          <div className="glass-panel p-4 space-y-3">
            <ResourceGauge value={coverageScore} label="Test Coverage" size="sm" />
            <ResourceGauge value={complexityScore} label="Complexity" size="sm" />
          </div>
        </AnimatedPanel>

        {/* Issue Summary */}
        <AnimatedPanel variant="slideUp" delay={0.25}>
          <div className="glass-panel p-4">
            <p className="text-xs text-text-muted mb-3">Issues by Severity</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-status-failed/5 border border-status-failed/10">
                <span className="text-xs text-status-failed font-medium">Errors</span>
                <span className="text-lg font-bold text-status-failed">{errorCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-status-warning/5 border border-status-warning/10">
                <span className="text-xs text-status-warning font-medium">Warnings</span>
                <span className="text-lg font-bold text-status-warning">{warningCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-accent-primary/5 border border-accent-primary/10">
                <span className="text-xs text-accent-primary font-medium">Info</span>
                <span className="text-lg font-bold text-accent-primary">{infoCount}</span>
              </div>
            </div>
          </div>
        </AnimatedPanel>
      </div>

      {/* Filter Tabs */}
      <AnimatedPanel variant="slideUp" delay={0.3}>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all' as FilterTab, label: 'All', count: MOCK_ISSUES.length },
            { key: 'error' as FilterTab, label: 'Errors', count: errorCount },
            { key: 'warning' as FilterTab, label: 'Warnings', count: warningCount },
            { key: 'info' as FilterTab, label: 'Info', count: infoCount },
            { key: 'lint' as FilterTab, label: 'Lint', count: MOCK_ISSUES.filter((i) => i.category === 'lint').length },
            { key: 'type' as FilterTab, label: 'Type', count: MOCK_ISSUES.filter((i) => i.category === 'type').length },
            { key: 'security' as FilterTab, label: 'Security', count: MOCK_ISSUES.filter((i) => i.category === 'security').length },
            { key: 'performance' as FilterTab, label: 'Perf', count: MOCK_ISSUES.filter((i) => i.category === 'performance').length },
            { key: 'style' as FilterTab, label: 'Style', count: MOCK_ISSUES.filter((i) => i.category === 'style').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-fast
                ${
                  activeFilter === tab.key
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                    : 'bg-dark-tertiary text-text-secondary hover:text-text-primary border border-transparent'
                }
              `}
            >
              {tab.label}
              <span className="px-1 py-0.5 rounded text-[10px] bg-dark-primary/50">{tab.count}</span>
            </button>
          ))}
        </div>
      </AnimatedPanel>

      {/* Issues List */}
      <AnimatedPanel variant="slideUp" delay={0.35}>
        <div className="space-y-2">
          {filteredIssues.map((issue, i) => {
            const config = SEVERITY_CONFIG[issue.severity];
            return (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`glass-panel p-4 border-s-3 ${config.borderColor}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-sm ${config.color} shrink-0 mt-0.5`}>{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${config.bgColor} ${config.color}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-dark-tertiary text-text-muted">
                        {issue.category}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary mb-1">{issue.description}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-[10px] font-mono text-text-muted">{issue.file}:{issue.line}</span>
                    </div>
                    <div className="bg-dark-primary/50 rounded p-2.5">
                      <p className="text-[10px] text-text-muted mb-0.5">Remediation</p>
                      <p className="text-xs text-text-secondary">{issue.remediation}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatedPanel>
    </div>
  );
}
