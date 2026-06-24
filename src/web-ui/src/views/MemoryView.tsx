import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';

type Namespace = 'project' | 'patterns' | 'preferences' | 'decisions' | 'lessons';
type DecayStatus = 'active' | 'decaying' | 'near-archival';

interface MemoryEntry {
  id: string;
  namespace: Namespace;
  content: string;
  preview: string;
  relevanceScore: number;
  decayStatus: DecayStatus;
  createdAt: Date;
  accessedAt: Date;
  tags: string[];
}

const NAMESPACE_CONFIG: Record<Namespace, { label: string; icon: string; count: number }> = {
  project: { label: 'Project', icon: '📁', count: 47 },
  patterns: { label: 'Patterns', icon: '🔄', count: 123 },
  preferences: { label: 'Preferences', icon: '⚙️', count: 34 },
  decisions: { label: 'Decisions', icon: '🎯', count: 89 },
  lessons: { label: 'Lessons', icon: '💡', count: 56 },
};

const MOCK_ENTRIES: MemoryEntry[] = [
  { id: '1', namespace: 'project', content: 'The project uses a monorepo structure with turborepo for build orchestration. Each package has its own tsconfig and vitest setup. The main API server is in packages/api with Express.js and Prisma ORM.', preview: 'Monorepo structure with turborepo...', relevanceScore: 95, decayStatus: 'active', createdAt: new Date(Date.now() - 86400000), accessedAt: new Date(Date.now() - 3600000), tags: ['architecture', 'tooling'] },
  { id: '2', namespace: 'patterns', content: 'When generating React components, always use functional components with explicit return types. Prefer named exports over default exports. Use the useCallback hook for event handlers passed as props.', preview: 'React component patterns - functional...', relevanceScore: 88, decayStatus: 'active', createdAt: new Date(Date.now() - 172800000), accessedAt: new Date(Date.now() - 7200000), tags: ['react', 'best-practices'] },
  { id: '3', namespace: 'decisions', content: 'Decision: Use Zustand over Redux for state management. Reasoning: Less boilerplate, better TypeScript inference, simpler testing. The team prefers atomic stores over a single large store.', preview: 'Zustand over Redux decision...', relevanceScore: 82, decayStatus: 'active', createdAt: new Date(Date.now() - 604800000), accessedAt: new Date(Date.now() - 14400000), tags: ['state-management', 'architecture'] },
  { id: '4', namespace: 'preferences', content: 'User prefers 2-space indentation, single quotes for strings, and trailing commas. ESLint configured with strict TypeScript rules. Prettier integration active.', preview: 'Code style: 2-space, single quotes...', relevanceScore: 76, decayStatus: 'decaying', createdAt: new Date(Date.now() - 1209600000), accessedAt: new Date(Date.now() - 259200000), tags: ['code-style', 'formatting'] },
  { id: '5', namespace: 'lessons', content: 'Learned that the test database needs to be reset between integration test suites. Using beforeAll with a dedicated test seed script prevents flaky tests caused by leftover state.', preview: 'Test DB reset between suites...', relevanceScore: 71, decayStatus: 'decaying', createdAt: new Date(Date.now() - 2592000000), accessedAt: new Date(Date.now() - 432000000), tags: ['testing', 'database'] },
  { id: '6', namespace: 'patterns', content: 'Error handling pattern: wrap async route handlers in a withErrorHandler HOF that catches exceptions and formats them into standard API error responses with appropriate status codes.', preview: 'Async error handling pattern...', relevanceScore: 85, decayStatus: 'active', createdAt: new Date(Date.now() - 345600000), accessedAt: new Date(Date.now() - 28800000), tags: ['error-handling', 'api'] },
  { id: '7', namespace: 'project', content: 'CI/CD pipeline runs on GitHub Actions with three stages: lint/typecheck, unit tests (parallel), and integration tests. Deployment to staging is automatic on merge to main.', preview: 'GitHub Actions CI/CD pipeline...', relevanceScore: 68, decayStatus: 'decaying', createdAt: new Date(Date.now() - 1728000000), accessedAt: new Date(Date.now() - 604800000), tags: ['ci-cd', 'devops'] },
  { id: '8', namespace: 'lessons', content: 'The WebSocket reconnection logic must include exponential backoff with jitter. Without jitter, multiple clients reconnecting simultaneously can overwhelm the server (thundering herd problem).', preview: 'WebSocket reconnection with jitter...', relevanceScore: 44, decayStatus: 'near-archival', createdAt: new Date(Date.now() - 5184000000), accessedAt: new Date(Date.now() - 2592000000), tags: ['websocket', 'reliability'] },
  { id: '9', namespace: 'decisions', content: 'Decision: Implement optimistic updates for all CRUD operations in the UI. Rollback on server error with toast notification. This significantly improves perceived performance.', preview: 'Optimistic updates for CRUD ops...', relevanceScore: 79, decayStatus: 'active', createdAt: new Date(Date.now() - 432000000), accessedAt: new Date(Date.now() - 57600000), tags: ['ux', 'performance'] },
  { id: '10', namespace: 'preferences', content: 'API responses should follow the JSON:API specification format with proper pagination links. Error responses include error code, message, and optional details field.', preview: 'JSON:API response format...', relevanceScore: 38, decayStatus: 'near-archival', createdAt: new Date(Date.now() - 6048000000), accessedAt: new Date(Date.now() - 3456000000), tags: ['api', 'standards'] },
];

function getDecayDot(status: DecayStatus): { color: string; label: string } {
  switch (status) {
    case 'active': return { color: 'bg-status-completed', label: 'Active' };
    case 'decaying': return { color: 'bg-status-warning', label: 'Decaying' };
    case 'near-archival': return { color: 'bg-status-failed', label: 'Near Archival' };
  }
}

export function MemoryView() {
  const { t } = useTranslation('common');
  const [activeNamespace, setActiveNamespace] = useState<Namespace>('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const filteredEntries = useMemo(() => {
    return MOCK_ENTRIES.filter((entry) => {
      const matchesNamespace = entry.namespace === activeNamespace;
      const matchesSearch = !searchQuery || 
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesNamespace && matchesSearch;
    });
  }, [activeNamespace, searchQuery]);

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize);

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.memory')}</h1>
          <div className="relative">
            <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Semantic search..."
              className="ps-9 pe-3 py-2 bg-dark-tertiary border border-dark-tertiary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 w-56 transition-all duration-fast"
            />
          </div>
        </div>
      </AnimatedPanel>

      {/* Namespace Tabs */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(NAMESPACE_CONFIG) as [Namespace, typeof NAMESPACE_CONFIG[Namespace]][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => { setActiveNamespace(key); setCurrentPage(1); setSelectedEntry(null); }}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-fast
                ${
                  activeNamespace === key
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30 shadow-md shadow-accent-primary/10'
                    : 'bg-dark-tertiary text-text-secondary hover:text-text-primary border border-transparent'
                }
              `}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
              <span className={`
                px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${activeNamespace === key ? 'bg-accent-primary/30 text-accent-primary' : 'bg-dark-primary text-text-muted'}
              `}>
                {config.count}
              </span>
            </button>
          ))}
        </div>
      </AnimatedPanel>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-6">
        {/* Entry List */}
        <div className={`${selectedEntry ? 'desktop:col-span-2' : 'desktop:col-span-3'}`}>
          <AnimatedPanel variant="slideUp" delay={0.15}>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {paginatedEntries.map((entry, i) => {
                  const decay = getDecayDot(entry.decayStatus);
                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedEntry(entry)}
                      className={`
                        glass-panel p-4 cursor-pointer transition-all duration-fast
                        hover:border-accent-primary/30
                        ${selectedEntry?.id === entry.id ? 'border-accent-primary/50' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Decay indicator */}
                        <div className="pt-1.5 shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${decay.color} ${entry.decayStatus === 'active' ? 'animate-pulse-slow' : ''}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary line-clamp-2 mb-2">{entry.preview}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.tags.map((tag) => (
                              <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-dark-tertiary text-text-muted rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <div className="flex items-center gap-1 mb-1">
                            <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-xs font-mono text-text-muted">{entry.relevanceScore}</span>
                          </div>
                          <span className={`text-[10px] ${decay.color.replace('bg-', 'text-')}`}>{decay.label}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {paginatedEntries.length === 0 && (
                <div className="glass-panel p-12 text-center">
                  <p className="text-text-muted">No entries found in this namespace</p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs bg-dark-tertiary text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-text-muted">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs bg-dark-tertiary text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </AnimatedPanel>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedEntry && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-panel p-5 h-fit sticky top-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getDecayDot(selectedEntry.decayStatus).color}`} />
                  <span className="text-xs font-medium text-text-secondary capitalize">{selectedEntry.namespace}</span>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-text-primary leading-relaxed mb-4">{selectedEntry.content}</p>

              <div className="space-y-3 border-t border-dark-tertiary pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Relevance Score</span>
                  <span className="text-sm font-bold text-accent-primary">{selectedEntry.relevanceScore}/100</span>
                </div>
                <div className="w-full h-1.5 bg-dark-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-all duration-normal"
                    style={{ width: `${selectedEntry.relevanceScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Status</span>
                  <span className={`text-xs font-medium ${getDecayDot(selectedEntry.decayStatus).color.replace('bg-', 'text-')}`}>
                    {getDecayDot(selectedEntry.decayStatus).label}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Created</span>
                  <span className="text-xs text-text-secondary">{selectedEntry.createdAt.toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Last Accessed</span>
                  <span className="text-xs text-text-secondary">{selectedEntry.accessedAt.toLocaleDateString()}</span>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] text-text-muted mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedEntry.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[10px] bg-accent-primary/10 text-accent-primary rounded-full">
                        {tag}
                      </span>
                    ))}
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
