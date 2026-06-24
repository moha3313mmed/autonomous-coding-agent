import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';

type FeedbackAction = 'pending' | 'accepted' | 'rejected';

interface PendingOutput {
  id: string;
  title: string;
  category: string;
  timestamp: Date;
  action: FeedbackAction;
  before?: string;
  after?: string;
}

interface CategoryAcceptance {
  category: string;
  rate: number;
  trend: 'up' | 'down' | 'stable';
  totalReviewed: number;
}

const MOCK_OUTPUTS: PendingOutput[] = [
  {
    id: '1',
    title: 'Generated authentication middleware',
    category: 'Code Generation',
    timestamp: new Date(Date.now() - 120000),
    action: 'pending',
    before: `export function authMiddleware(req, res, next) {\n  const token = req.headers.authorization;\n  if (!token) return res.status(401).send('Unauthorized');\n  next();\n}`,
    after: `export function authMiddleware(req: Request, res: Response, next: NextFunction): void {\n  const token = req.headers.authorization?.replace('Bearer ', '');\n  if (!token) {\n    res.status(401).json({ error: 'Missing authentication token' });\n    return;\n  }\n  try {\n    const decoded = verifyToken(token);\n    req.user = decoded;\n    next();\n  } catch (err) {\n    res.status(403).json({ error: 'Invalid token' });\n  }\n}`,
  },
  {
    id: '2',
    title: 'Refactored database connection pooling',
    category: 'Refactoring',
    timestamp: new Date(Date.now() - 300000),
    action: 'pending',
    before: `const pool = new Pool({ max: 10 });\nexport const query = (text, params) => pool.query(text, params);`,
    after: `const pool = new Pool({\n  max: 20,\n  idleTimeoutMillis: 30000,\n  connectionTimeoutMillis: 5000,\n});\n\nexport async function query<T>(text: string, params?: unknown[]): Promise<T[]> {\n  const client = await pool.connect();\n  try {\n    const result = await client.query(text, params);\n    return result.rows as T[];\n  } finally {\n    client.release();\n  }\n}`,
  },
  {
    id: '3',
    title: 'Generated unit test for UserService',
    category: 'Testing',
    timestamp: new Date(Date.now() - 600000),
    action: 'pending',
    before: null,
    after: `describe('UserService', () => {\n  it('should create a user with valid data', async () => {\n    const user = await userService.create({\n      email: 'test@example.com',\n      name: 'Test User',\n    });\n    expect(user.id).toBeDefined();\n    expect(user.email).toBe('test@example.com');\n  });\n});`,
  },
  {
    id: '4',
    title: 'Updated API documentation',
    category: 'Documentation',
    timestamp: new Date(Date.now() - 900000),
    action: 'accepted',
  },
  {
    id: '5',
    title: 'Optimized image compression pipeline',
    category: 'Performance',
    timestamp: new Date(Date.now() - 1200000),
    action: 'rejected',
  },
];

const MOCK_ACCEPTANCE: CategoryAcceptance[] = [
  { category: 'Code Generation', rate: 82, trend: 'up', totalReviewed: 156 },
  { category: 'Refactoring', rate: 91, trend: 'stable', totalReviewed: 89 },
  { category: 'Testing', rate: 67, trend: 'down', totalReviewed: 123 },
  { category: 'Documentation', rate: 95, trend: 'up', totalReviewed: 45 },
  { category: 'Performance', rate: 58, trend: 'down', totalReviewed: 34 },
];

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return (
      <svg className="w-3 h-3 text-status-completed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (trend === 'down') {
    return (
      <svg className="w-3 h-3 text-status-failed" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  );
}

export function FeedbackView() {
  const { t } = useTranslation('common');
  const [outputs, setOutputs] = useState(MOCK_OUTPUTS);
  const [selectedOutput, setSelectedOutput] = useState<PendingOutput | null>(null);

  const pendingOutputs = outputs.filter((o) => o.action === 'pending');
  const lowRateCategories = MOCK_ACCEPTANCE.filter((c) => c.rate < 70);

  const handleAction = (id: string, action: FeedbackAction) => {
    setOutputs((prev) => prev.map((o) => (o.id === id ? { ...o, action } : o)));
    if (selectedOutput?.id === id) setSelectedOutput(null);
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <h1 className="text-2xl font-bold text-text-primary">{t('navigation.feedback')}</h1>
      </AnimatedPanel>

      {/* Low Acceptance Rate Alert */}
      {lowRateCategories.length > 0 && (
        <AnimatedPanel variant="slideDown" delay={0.05}>
          <div className="border border-status-warning/30 bg-status-warning/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-status-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold text-status-warning">Improvement Needed</span>
            </div>
            <p className="text-xs text-text-secondary">
              {lowRateCategories.map((c) => c.category).join(', ')} {lowRateCategories.length === 1 ? 'has' : 'have'} acceptance rate below 70%. Consider reviewing skill training data for these categories.
            </p>
          </div>
        </AnimatedPanel>
      )}

      {/* Acceptance Rate by Category */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="glass-panel p-5">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Acceptance Rate by Category</h2>
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-5 gap-3">
            {MOCK_ACCEPTANCE.map((cat, i) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`
                  bg-dark-primary/50 rounded-lg p-3 border
                  ${cat.rate < 70 ? 'border-status-warning/20' : 'border-transparent'}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-text-muted truncate">{cat.category}</span>
                  <TrendIcon trend={cat.trend} />
                </div>
                <div className="flex items-end gap-1">
                  <span className={`text-xl font-bold ${
                    cat.rate >= 80 ? 'text-status-completed' : cat.rate >= 70 ? 'text-status-warning' : 'text-status-failed'
                  }`}>
                    {cat.rate}%
                  </span>
                </div>
                <div className="w-full h-1 bg-dark-tertiary rounded-full overflow-hidden mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.rate}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className={`h-full rounded-full ${
                      cat.rate >= 80 ? 'bg-status-completed' : cat.rate >= 70 ? 'bg-status-warning' : 'bg-status-failed'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-1">{cat.totalReviewed} reviewed</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedPanel>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-6">
        {/* Pending Outputs */}
        <div className={`${selectedOutput ? 'desktop:col-span-2' : 'desktop:col-span-3'}`}>
          <AnimatedPanel variant="slideUp" delay={0.15}>
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-text-secondary">
                  Pending Review ({pendingOutputs.length})
                </h2>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {outputs.map((output, i) => (
                    <motion.div
                      key={output.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => output.action === 'pending' && setSelectedOutput(output)}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg transition-all duration-fast
                        ${output.action === 'pending'
                          ? 'bg-dark-primary/50 hover:bg-dark-primary cursor-pointer border border-transparent hover:border-dark-tertiary'
                          : 'bg-dark-primary/30 opacity-60'}
                        ${selectedOutput?.id === output.id ? 'border-accent-primary/40' : ''}
                      `}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{output.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-text-muted bg-dark-tertiary px-1.5 py-0.5 rounded">
                            {output.category}
                          </span>
                          <span className="text-[10px] text-text-muted">{formatTime(output.timestamp)}</span>
                        </div>
                      </div>

                      {output.action === 'pending' ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); handleAction(output.id, 'accepted'); }}
                            className="w-8 h-8 rounded-lg bg-status-completed/10 text-status-completed hover:bg-status-completed/20 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); handleAction(output.id, 'rejected'); }}
                            className="w-8 h-8 rounded-lg bg-status-failed/10 text-status-failed hover:bg-status-failed/20 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </motion.button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          output.action === 'accepted'
                            ? 'bg-status-completed/10 text-status-completed'
                            : 'bg-status-failed/10 text-status-failed'
                        }`}>
                          {output.action === 'accepted' ? 'Accepted' : 'Rejected'}
                        </span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </AnimatedPanel>
        </div>

        {/* Diff View / Detail Panel */}
        <AnimatePresence>
          {selectedOutput && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-panel p-5 h-fit sticky top-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">Diff View</h3>
                <button
                  onClick={() => setSelectedOutput(null)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-text-secondary mb-4">{selectedOutput.title}</p>

              {selectedOutput.before && (
                <div className="mb-3">
                  <p className="text-[10px] text-status-failed font-medium mb-1 flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-status-failed/20 flex items-center justify-center text-[8px]">-</span>
                    Before
                  </p>
                  <pre className="text-[10px] font-mono text-text-secondary bg-status-failed/5 border border-status-failed/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {selectedOutput.before}
                  </pre>
                </div>
              )}

              {selectedOutput.after && (
                <div>
                  <p className="text-[10px] text-status-completed font-medium mb-1 flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-status-completed/20 flex items-center justify-center text-[8px]">+</span>
                    After
                  </p>
                  <pre className="text-[10px] font-mono text-text-secondary bg-status-completed/5 border border-status-completed/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {selectedOutput.after}
                  </pre>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAction(selectedOutput.id, 'accepted')}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-status-completed/10 text-status-completed border border-status-completed/20 hover:bg-status-completed/20 transition-all"
                >
                  Accept
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAction(selectedOutput.id, 'rejected')}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-status-failed/10 text-status-failed border border-status-failed/20 hover:bg-status-failed/20 transition-all"
                >
                  Reject
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
