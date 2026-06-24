import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import { StatusBadge } from '../components/ui/StatusBadge';

type RecoveryStatus = 'recovered' | 'escalated' | 'pending';

interface ErrorEntry {
  id: string;
  timestamp: Date;
  errorType: string;
  message: string;
  stackTrace: string;
  recoveryStatus: RecoveryStatus;
  strategy: string;
  attempts: number;
  maxAttempts: number;
  component: string;
}

const MOCK_ERRORS: ErrorEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 300000),
    errorType: 'ConnectionTimeout',
    message: 'WebSocket connection timed out after 30s',
    stackTrace: `Error: ConnectionTimeout\n  at WebSocketManager.connect (src/ws/manager.ts:45)\n  at ReconnectionEngine.attempt (src/ws/reconnection.ts:23)\n  at async ConnectionPool.maintain (src/ws/pool.ts:89)`,
    recoveryStatus: 'recovered',
    strategy: 'Exponential backoff with jitter',
    attempts: 3,
    maxAttempts: 5,
    component: 'WebSocket Manager',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 600000),
    errorType: 'OutOfMemory',
    message: 'Heap allocation failed: memory limit exceeded',
    stackTrace: `Error: OutOfMemory\n  at MemoryStore.allocate (src/infrastructure/memory-store.ts:112)\n  at CacheManager.store (src/cache/manager.ts:34)\n  at async TaskExecutor.cacheResult (src/execution/executor.ts:67)`,
    recoveryStatus: 'escalated',
    strategy: 'Cache eviction + GC trigger',
    attempts: 5,
    maxAttempts: 5,
    component: 'Memory Store',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 900000),
    errorType: 'RateLimitExceeded',
    message: 'API rate limit exceeded: 429 Too Many Requests',
    stackTrace: `Error: RateLimitExceeded\n  at APIClient.request (src/api/client.ts:78)\n  at SkillEngine.fetchModel (src/execution/skill-engine.ts:56)\n  at async TaskProcessor.process (src/orchestration/processor.ts:112)`,
    recoveryStatus: 'recovered',
    strategy: 'Adaptive rate limiting with queue',
    attempts: 1,
    maxAttempts: 3,
    component: 'Skill Engine',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1800000),
    errorType: 'ValidationError',
    message: 'Schema validation failed: invalid task decomposition output',
    stackTrace: `Error: ValidationError\n  at SchemaValidator.validate (src/shared/validator.ts:34)\n  at TaskDecomposer.decompose (src/orchestration/task-decomposer.ts:89)\n  at async DAGScheduler.plan (src/orchestration/dag-scheduler.ts:45)`,
    recoveryStatus: 'pending',
    strategy: 'Retry with relaxed schema + manual review',
    attempts: 2,
    maxAttempts: 3,
    component: 'Task Decomposer',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 3600000),
    errorType: 'DatabaseDeadlock',
    message: 'Transaction deadlock detected on table \'task_results\'',
    stackTrace: `Error: DatabaseDeadlock\n  at DatabaseClient.transaction (src/db/client.ts:156)\n  at ResultStore.save (src/infrastructure/result-store.ts:45)\n  at async QualityAssurer.persist (src/execution/quality-assurer.ts:78)`,
    recoveryStatus: 'recovered',
    strategy: 'Transaction retry with random delay',
    attempts: 2,
    maxAttempts: 5,
    component: 'Quality Assurer',
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 7200000),
    errorType: 'PluginCrash',
    message: 'Skill plugin crashed: segmentation fault in native module',
    stackTrace: `Error: PluginCrash\n  at NativeModule.execute (src/plugins/native.ts:23)\n  at SkillEngine.runPlugin (src/execution/skill-engine.ts:134)\n  at async ToolRegistry.invoke (src/execution/tool-registry.ts:67)`,
    recoveryStatus: 'escalated',
    strategy: 'Plugin isolation + restart',
    attempts: 3,
    maxAttempts: 3,
    component: 'Tool Registry',
  },
];

const STATUS_MAP: Record<RecoveryStatus, { badgeStatus: 'completed' | 'failed' | 'warning'; label: string }> = {
  recovered: { badgeStatus: 'completed', label: 'Recovered' },
  escalated: { badgeStatus: 'failed', label: 'Escalated' },
  pending: { badgeStatus: 'warning', label: 'Pending' },
};

export function RecoveryView() {
  const { t } = useTranslation('common');
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);

  const recoveredCount = MOCK_ERRORS.filter((e) => e.recoveryStatus === 'recovered').length;
  const escalatedCount = MOCK_ERRORS.filter((e) => e.recoveryStatus === 'escalated').length;
  const pendingCount = MOCK_ERRORS.filter((e) => e.recoveryStatus === 'pending').length;
  const totalCount = MOCK_ERRORS.length;
  const recoveryRate = Math.round((recoveredCount / totalCount) * 100);
  const escalationRate = Math.round((escalatedCount / totalCount) * 100);

  const escalatedErrors = MOCK_ERRORS.filter((e) => e.recoveryStatus === 'escalated');

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <h1 className="text-2xl font-bold text-text-primary">{t('navigation.recovery')}</h1>
      </AnimatedPanel>

      {/* Escalation Alerts */}
      {escalatedErrors.length > 0 && (
        <AnimatedPanel variant="slideDown" delay={0.05}>
          <div className="border border-status-failed/30 bg-status-failed/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-status-failed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-semibold text-status-failed">
                {escalatedErrors.length} Escalated Error{escalatedErrors.length > 1 ? 's' : ''} — Requires Attention
              </span>
            </div>
            <div className="space-y-2">
              {escalatedErrors.map((err) => (
                <div
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className="flex items-center gap-3 p-2 rounded bg-dark-primary/50 cursor-pointer hover:bg-dark-primary transition-colors"
                >
                  <span className="text-xs text-status-failed font-mono">{err.errorType}</span>
                  <span className="text-xs text-text-muted flex-1 truncate">{err.message}</span>
                  <span className="text-[10px] text-text-muted">{formatTime(err.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedPanel>
      )}

      {/* Recovery Statistics */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Recovery Statistics</h2>
          <div className="grid grid-cols-1 tablet:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary">{totalCount}</p>
              <p className="text-xs text-text-muted">Total Errors</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-status-completed">{recoveredCount}</p>
              <p className="text-xs text-text-muted">Auto-Recovered</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-status-failed">{escalatedCount}</p>
              <p className="text-xs text-text-muted">Escalated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-status-warning">{pendingCount}</p>
              <p className="text-xs text-text-muted">Pending</p>
            </div>
          </div>

          {/* Recovery Rate Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Recovery Distribution</span>
              <span className="text-text-secondary">{recoveryRate}% auto-recovered</span>
            </div>
            <div className="w-full h-3 bg-dark-tertiary rounded-full overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${recoveryRate}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="h-full bg-status-completed"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((pendingCount / totalCount) * 100)}%` }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="h-full bg-status-warning"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${escalationRate}%` }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="h-full bg-status-failed"
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-status-completed" />
                <span className="text-text-muted">Recovered ({recoveryRate}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-status-warning" />
                <span className="text-text-muted">Pending ({Math.round((pendingCount / totalCount) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-status-failed" />
                <span className="text-text-muted">Escalated ({escalationRate}%)</span>
              </div>
            </div>
          </div>
        </div>
      </AnimatedPanel>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-6">
        {/* Error List */}
        <div className={`${selectedError ? 'desktop:col-span-2' : 'desktop:col-span-3'}`}>
          <AnimatedPanel variant="slideUp" delay={0.15}>
            <div className="space-y-2">
              {MOCK_ERRORS.map((error, i) => {
                const statusInfo = STATUS_MAP[error.recoveryStatus];
                return (
                  <motion.div
                    key={error.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedError(error)}
                    className={`
                      glass-panel p-4 cursor-pointer transition-all duration-fast
                      hover:border-accent-primary/30
                      ${selectedError?.id === error.id ? 'border-accent-primary/50' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-text-primary">{error.errorType}</span>
                          <span className="text-[10px] text-text-muted bg-dark-tertiary px-1.5 py-0.5 rounded">
                            {error.component}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary truncate">{error.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-text-muted">
                            Attempts: {error.attempts}/{error.maxAttempts}
                          </span>
                          <span className="text-[10px] text-text-muted">{error.strategy}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={statusInfo.badgeStatus} label={statusInfo.label} size="sm" />
                        <span className="text-[10px] text-text-muted">{formatTime(error.timestamp)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatedPanel>
        </div>

        {/* Error Detail Panel */}
        <AnimatePresence>
          {selectedError && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-panel p-5 h-fit sticky top-4"
            >
              <div className="flex items-center justify-between mb-4">
                <StatusBadge
                  status={STATUS_MAP[selectedError.recoveryStatus].badgeStatus}
                  label={STATUS_MAP[selectedError.recoveryStatus].label}
                />
                <button
                  onClick={() => setSelectedError(null)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h3 className="text-sm font-bold text-text-primary mb-1">{selectedError.errorType}</h3>
              <p className="text-xs text-text-secondary mb-4">{selectedError.message}</p>

              <div className="space-y-4">
                {/* Stack Trace */}
                <div>
                  <p className="text-[10px] text-text-muted mb-1">Stack Trace</p>
                  <pre className="text-[10px] font-mono text-text-secondary bg-dark-primary/80 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {selectedError.stackTrace}
                  </pre>
                </div>

                {/* Recovery Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Strategy</p>
                    <p className="text-xs text-text-primary">{selectedError.strategy}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Attempts</p>
                    <p className="text-xs text-text-primary">{selectedError.attempts} / {selectedError.maxAttempts}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Component</p>
                    <p className="text-xs text-text-primary">{selectedError.component}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Timestamp</p>
                    <p className="text-xs text-text-primary">{selectedError.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-text-muted">Recovery Progress</span>
                    <span className="text-text-secondary">{selectedError.attempts}/{selectedError.maxAttempts}</span>
                  </div>
                  <div className="w-full h-2 bg-dark-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-normal ${
                        selectedError.recoveryStatus === 'recovered'
                          ? 'bg-status-completed'
                          : selectedError.recoveryStatus === 'escalated'
                          ? 'bg-status-failed'
                          : 'bg-status-warning'
                      }`}
                      style={{ width: `${(selectedError.attempts / selectedError.maxAttempts) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
