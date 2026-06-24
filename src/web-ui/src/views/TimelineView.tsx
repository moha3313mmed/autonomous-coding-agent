import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';

type NodeType = 'commit' | 'checkpoint';

interface TimelineNode {
  id: string;
  type: NodeType;
  message: string;
  timestamp: Date;
  branch: string;
  author: string;
  hash: string;
  filesChanged?: string[];
  reasoning?: string;
  canRollback?: boolean;
}

const BRANCH_COLORS: Record<string, string> = {
  main: '#3b82f6',
  'feature/auth': '#10b981',
  'feature/ui': '#eab308',
  'fix/memory-leak': '#ef4444',
};

const MOCK_TIMELINE: TimelineNode[] = [
  { id: '1', type: 'checkpoint', message: 'Pre-deployment checkpoint: v2.4.0', timestamp: new Date(Date.now() - 900000), branch: 'main', author: 'System', hash: 'a1b2c3d', filesChanged: ['package.json', 'CHANGELOG.md'], reasoning: 'Automated checkpoint before production deployment of v2.4.0 release.', canRollback: true },
  { id: '2', type: 'commit', message: 'feat: add real-time notification system', timestamp: new Date(Date.now() - 1800000), branch: 'main', author: 'Agent-1', hash: 'e4f5g6h', filesChanged: ['src/notifications/index.ts', 'src/notifications/websocket.ts', 'src/notifications/types.ts'], reasoning: 'User requested real-time notifications for task completion events.' },
  { id: '3', type: 'commit', message: 'refactor: optimize database query batching', timestamp: new Date(Date.now() - 3600000), branch: 'main', author: 'Agent-3', hash: 'i7j8k9l', filesChanged: ['src/db/query-builder.ts', 'src/db/batch.ts'], reasoning: 'Performance monitor detected N+1 query pattern in task listing endpoint.' },
  { id: '4', type: 'commit', message: 'feat: implement OAuth2 PKCE flow', timestamp: new Date(Date.now() - 5400000), branch: 'feature/auth', author: 'Agent-2', hash: 'm0n1o2p', filesChanged: ['src/auth/oauth.ts', 'src/auth/pkce.ts', 'src/auth/callback.ts', 'src/auth/types.ts'], reasoning: 'Security requirement: implement PKCE for public client OAuth2 flows.' },
  { id: '5', type: 'checkpoint', message: 'Checkpoint: before auth refactor', timestamp: new Date(Date.now() - 7200000), branch: 'feature/auth', author: 'System', hash: 'q3r4s5t', reasoning: 'Manual checkpoint created before major authentication module restructure.', canRollback: true },
  { id: '6', type: 'commit', message: 'fix: resolve WebSocket memory leak', timestamp: new Date(Date.now() - 10800000), branch: 'fix/memory-leak', author: 'Agent-1', hash: 'u6v7w8x', filesChanged: ['src/ws/manager.ts', 'src/ws/connection-pool.ts'], reasoning: 'Recovery manager detected increasing memory usage from unclosed WebSocket connections.' },
  { id: '7', type: 'commit', message: 'style: update dashboard component styling', timestamp: new Date(Date.now() - 14400000), branch: 'feature/ui', author: 'Agent-4', hash: 'y9z0a1b', filesChanged: ['src/web-ui/src/views/DashboardView.tsx', 'src/web-ui/src/index.css'], reasoning: 'User feedback requested improved visual hierarchy and dark theme consistency.' },
  { id: '8', type: 'commit', message: 'test: add integration tests for payment flow', timestamp: new Date(Date.now() - 18000000), branch: 'main', author: 'Agent-2', hash: 'c2d3e4f', filesChanged: ['tests/integration/payment.test.ts', 'tests/fixtures/payment.ts'], reasoning: 'Quality assurer flagged missing integration test coverage for payment module.' },
  { id: '9', type: 'checkpoint', message: 'Daily automated checkpoint', timestamp: new Date(Date.now() - 86400000), branch: 'main', author: 'System', hash: 'g5h6i7j', reasoning: 'Scheduled daily checkpoint for recovery purposes.', canRollback: true },
];

export function TimelineView() {
  const { t } = useTranslation('common');
  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getBranchColor = (branch: string): string => {
    return BRANCH_COLORS[branch] || '#6b7280';
  };

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.timeline')}</h1>
          <div className="flex items-center gap-4">
            {/* Branch Legend */}
            <div className="flex items-center gap-3">
              {Object.entries(BRANCH_COLORS).map(([branch, color]) => (
                <div key={branch} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-text-muted font-mono">{branch}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AnimatedPanel>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className={`${selectedNode ? 'desktop:col-span-2' : 'desktop:col-span-3'}`}>
          <AnimatedPanel variant="slideUp" delay={0.1}>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute start-6 top-0 bottom-0 w-px bg-dark-tertiary" />

              <div className="space-y-1">
                {MOCK_TIMELINE.map((node, i) => {
                  const branchColor = getBranchColor(node.branch);
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedNode(node)}
                      className={`
                        relative flex items-start gap-4 p-3 ps-14 rounded-lg cursor-pointer
                        transition-all duration-fast
                        hover:bg-dark-secondary/80
                        ${isSelected ? 'bg-dark-secondary border border-accent-primary/30' : 'border border-transparent'}
                      `}
                    >
                      {/* Node Icon */}
                      <div className="absolute start-3.5 top-4">
                        {node.type === 'commit' ? (
                          <div
                            className="w-5 h-5 rounded-full border-2 bg-dark-primary"
                            style={{ borderColor: branchColor }}
                          />
                        ) : (
                          <div
                            className="w-5 h-5 rotate-45 border-2 bg-dark-primary"
                            style={{ borderColor: branchColor }}
                          />
                        )}
                      </div>

                      {/* Branch color line */}
                      <div
                        className="absolute start-[23px] top-9 bottom-0 w-0.5 rounded-full"
                        style={{ backgroundColor: branchColor, opacity: 0.3 }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary font-medium truncate">{node.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className="px-1.5 py-0.5 text-[10px] rounded font-mono"
                                style={{ backgroundColor: `${branchColor}15`, color: branchColor }}
                              >
                                {node.branch}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono">{node.hash}</span>
                              <span className="text-[10px] text-text-muted">{node.author}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {node.canRollback && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRollbackConfirm(rollbackConfirm === node.id ? null : node.id);
                                }}
                                className={`
                                  px-2 py-1 rounded text-[10px] font-medium transition-all duration-fast
                                  ${
                                    rollbackConfirm === node.id
                                      ? 'bg-status-failed text-white'
                                      : 'bg-dark-tertiary text-text-muted hover:text-status-warning hover:bg-status-warning/10'
                                  }
                                `}
                              >
                                {rollbackConfirm === node.id ? 'Confirm Rollback' : 'Rollback'}
                              </button>
                            )}
                            <span className="text-xs text-text-muted whitespace-nowrap">{formatTime(node.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </AnimatedPanel>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-panel p-5 h-fit sticky top-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {selectedNode.type === 'commit' ? (
                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: getBranchColor(selectedNode.branch) }} />
                  ) : (
                    <div className="w-4 h-4 rotate-45 border-2" style={{ borderColor: getBranchColor(selectedNode.branch) }} />
                  )}
                  <span className="text-xs font-medium text-text-secondary capitalize">{selectedNode.type}</span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h3 className="text-sm font-semibold text-text-primary mb-3">{selectedNode.message}</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Branch</p>
                    <p className="text-xs text-text-primary font-mono">{selectedNode.branch}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Hash</p>
                    <p className="text-xs text-text-primary font-mono">{selectedNode.hash}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Author</p>
                    <p className="text-xs text-text-primary">{selectedNode.author}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-text-muted">Time</p>
                    <p className="text-xs text-text-primary">{formatTime(selectedNode.timestamp)}</p>
                  </div>
                </div>

                {selectedNode.reasoning && (
                  <div>
                    <p className="text-[10px] text-text-muted mb-1">Reasoning Context</p>
                    <p className="text-xs text-text-secondary leading-relaxed bg-dark-primary/50 rounded-lg p-3">
                      {selectedNode.reasoning}
                    </p>
                  </div>
                )}

                {selectedNode.filesChanged && selectedNode.filesChanged.length > 0 && (
                  <div>
                    <p className="text-[10px] text-text-muted mb-2">Files Changed ({selectedNode.filesChanged.length})</p>
                    <div className="space-y-1">
                      {selectedNode.filesChanged.map((file) => (
                        <div key={file} className="flex items-center gap-2 px-2.5 py-1.5 bg-dark-primary/50 rounded">
                          <svg className="w-3 h-3 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-[10px] font-mono text-text-secondary truncate">{file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.canRollback && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-4 py-2.5 rounded-lg text-xs font-medium bg-status-warning/10 text-status-warning border border-status-warning/20 hover:bg-status-warning/20 transition-all duration-fast"
                  >
                    Rollback to this checkpoint
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
