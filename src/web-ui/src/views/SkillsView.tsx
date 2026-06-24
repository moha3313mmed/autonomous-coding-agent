import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';

type SortField = 'confidence' | 'usage' | 'date' | 'successRate';
type Category = 'all' | 'code' | 'testing' | 'refactor' | 'docs' | 'debug';

interface Skill {
  id: string;
  name: string;
  category: Category;
  language: string;
  confidence: number;
  usageCount: number;
  successRate: number;
  lastUsed: Date;
  description: string;
  needsRefinement: boolean;
}

const MOCK_SKILLS: Skill[] = [
  { id: '1', name: 'React Component Generation', category: 'code', language: 'TypeScript', confidence: 92, usageCount: 1247, successRate: 94, lastUsed: new Date(Date.now() - 3600000), description: 'Generates React functional components with hooks, props interfaces, and proper TypeScript typing.', needsRefinement: false },
  { id: '2', name: 'Unit Test Creation', category: 'testing', language: 'TypeScript', confidence: 85, usageCount: 892, successRate: 87, lastUsed: new Date(Date.now() - 7200000), description: 'Creates comprehensive unit tests using Vitest with mocking, assertions, and edge case coverage.', needsRefinement: false },
  { id: '3', name: 'SQL Query Optimization', category: 'refactor', language: 'SQL', confidence: 67, usageCount: 234, successRate: 71, lastUsed: new Date(Date.now() - 86400000), description: 'Analyzes and optimizes SQL queries for better performance with index suggestions.', needsRefinement: true },
  { id: '4', name: 'API Documentation', category: 'docs', language: 'Markdown', confidence: 95, usageCount: 567, successRate: 98, lastUsed: new Date(Date.now() - 1800000), description: 'Generates comprehensive API documentation with examples, parameter descriptions, and response schemas.', needsRefinement: false },
  { id: '5', name: 'Error Stack Analysis', category: 'debug', language: 'Multi', confidence: 78, usageCount: 445, successRate: 80, lastUsed: new Date(Date.now() - 14400000), description: 'Analyzes error stack traces and suggests root causes with potential fixes.', needsRefinement: false },
  { id: '6', name: 'Python Data Pipeline', category: 'code', language: 'Python', confidence: 88, usageCount: 623, successRate: 90, lastUsed: new Date(Date.now() - 28800000), description: 'Builds data processing pipelines with pandas, validation, and error handling.', needsRefinement: false },
  { id: '7', name: 'CSS Layout Debugging', category: 'debug', language: 'CSS', confidence: 42, usageCount: 89, successRate: 55, lastUsed: new Date(Date.now() - 172800000), description: 'Identifies and fixes CSS layout issues including flexbox and grid problems.', needsRefinement: true },
  { id: '8', name: 'Integration Test Patterns', category: 'testing', language: 'TypeScript', confidence: 73, usageCount: 312, successRate: 76, lastUsed: new Date(Date.now() - 43200000), description: 'Creates integration tests with proper setup/teardown, database seeding, and API mocking.', needsRefinement: true },
  { id: '9', name: 'Rust Memory Safety', category: 'code', language: 'Rust', confidence: 58, usageCount: 156, successRate: 62, lastUsed: new Date(Date.now() - 259200000), description: 'Helps with ownership, borrowing, and lifetime annotations in Rust code.', needsRefinement: true },
  { id: '10', name: 'GraphQL Schema Design', category: 'code', language: 'GraphQL', confidence: 81, usageCount: 278, successRate: 84, lastUsed: new Date(Date.now() - 57600000), description: 'Designs GraphQL schemas with proper types, resolvers, and mutation patterns.', needsRefinement: false },
];

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: 'bg-text-muted' },
  { key: 'code', label: 'Code Gen', color: 'bg-accent-primary' },
  { key: 'testing', label: 'Testing', color: 'bg-accent-secondary' },
  { key: 'refactor', label: 'Refactor', color: 'bg-status-warning' },
  { key: 'docs', label: 'Docs', color: 'bg-status-completed' },
  { key: 'debug', label: 'Debug', color: 'bg-status-failed' },
];

function getConfidenceColor(confidence: number): { bar: string; text: string; bg: string } {
  if (confidence < 50) return { bar: 'bg-status-failed', text: 'text-status-failed', bg: 'bg-status-failed/10' };
  if (confidence <= 80) return { bar: 'bg-status-warning', text: 'text-status-warning', bg: 'bg-status-warning/10' };
  return { bar: 'bg-status-completed', text: 'text-status-completed', bg: 'bg-status-completed/10' };
}

function getCategoryColor(category: Category): string {
  const found = CATEGORIES.find((c) => c.key === category);
  return found?.color ?? 'bg-text-muted';
}

export function SkillsView() {
  const { t } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const filteredSkills = useMemo(() => {
    let skills = MOCK_SKILLS.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.language.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    skills.sort((a, b) => {
      switch (sortField) {
        case 'confidence': return b.confidence - a.confidence;
        case 'usage': return b.usageCount - a.usageCount;
        case 'date': return b.lastUsed.getTime() - a.lastUsed.getTime();
        case 'successRate': return b.successRate - a.successRate;
        default: return 0;
      }
    });

    return skills;
  }, [search, sortField, selectedCategory]);

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.skills')}</h1>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..."
                className="ps-9 pe-3 py-2 bg-dark-tertiary border border-dark-tertiary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 w-48 transition-all duration-fast"
              />
            </div>
            {/* Sort */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-2 bg-dark-tertiary border border-dark-tertiary rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
            >
              <option value="confidence">Confidence</option>
              <option value="usage">Usage</option>
              <option value="date">Recent</option>
              <option value="successRate">Success Rate</option>
            </select>
          </div>
        </div>
      </AnimatedPanel>

      {/* Category Filters */}
      <AnimatedPanel variant="slideUp" delay={0.1}>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-fast
                ${
                  selectedCategory === cat.key
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                    : 'bg-dark-tertiary text-text-secondary hover:text-text-primary border border-transparent hover:border-dark-tertiary'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${cat.color}`} />
              {cat.label}
            </button>
          ))}
        </div>
      </AnimatedPanel>

      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-6">
        {/* Skills Grid */}
        <div className={`${selectedSkill ? 'desktop:col-span-2' : 'desktop:col-span-3'}`}>
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-2 gap-3">
            <AnimatePresence>
              {filteredSkills.map((skill, i) => {
                const conf = getConfidenceColor(skill.confidence);
                return (
                  <motion.div
                    key={skill.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedSkill(skill)}
                    className={`
                      glass-panel p-4 cursor-pointer transition-all duration-fast
                      hover:border-accent-primary/30 hover:shadow-lg hover:shadow-accent-primary/5
                      ${selectedSkill?.id === skill.id ? 'border-accent-primary/50 shadow-lg shadow-accent-primary/10' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-text-primary truncate">{skill.name}</h3>
                          {skill.needsRefinement && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-status-warning/10 text-status-warning border border-status-warning/20 rounded-full">
                              Refine
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getCategoryColor(skill.category)}/10 text-text-secondary`}>
                            {skill.language}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Confidence Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-text-muted">Confidence</span>
                        <span className={`text-xs font-bold ${conf.text}`}>{skill.confidence}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-dark-tertiary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${skill.confidence}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                          className={`h-full rounded-full ${conf.bar}`}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span>{skill.usageCount.toLocaleString()} uses</span>
                      <span>{skill.successRate}% success</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredSkills.length === 0 && (
            <div className="glass-panel p-12 text-center">
              <p className="text-text-muted">No skills match your search criteria</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedSkill && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-panel p-5 h-fit sticky top-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">{selectedSkill.name}</h3>
                <button
                  onClick={() => setSelectedSkill(null)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">{selectedSkill.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-dark-primary/50 rounded-lg p-3">
                    <p className="text-[10px] text-text-muted mb-0.5">Category</p>
                    <p className="text-sm text-text-primary capitalize">{selectedSkill.category}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-3">
                    <p className="text-[10px] text-text-muted mb-0.5">Language</p>
                    <p className="text-sm text-text-primary">{selectedSkill.language}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-3">
                    <p className="text-[10px] text-text-muted mb-0.5">Total Usage</p>
                    <p className="text-sm text-text-primary font-mono">{selectedSkill.usageCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-dark-primary/50 rounded-lg p-3">
                    <p className="text-[10px] text-text-muted mb-0.5">Success Rate</p>
                    <p className={`text-sm font-mono font-bold ${getConfidenceColor(selectedSkill.successRate).text}`}>
                      {selectedSkill.successRate}%
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-text-muted mb-2">Confidence Level</p>
                  <div className="w-full h-3 bg-dark-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getConfidenceColor(selectedSkill.confidence).bar} transition-all duration-normal`}
                      style={{ width: `${selectedSkill.confidence}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${getConfidenceColor(selectedSkill.confidence).text}`}>
                    {selectedSkill.confidence}% confident
                  </p>
                </div>

                {selectedSkill.needsRefinement && (
                  <div className="bg-status-warning/5 border border-status-warning/20 rounded-lg p-3">
                    <p className="text-xs text-status-warning font-medium">Flagged for Refinement</p>
                    <p className="text-[10px] text-text-muted mt-1">
                      This skill has below-target metrics and may benefit from additional training data.
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-text-muted">
                  Last used: {selectedSkill.lastUsed.toLocaleDateString()} at{' '}
                  {selectedSkill.lastUsed.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
