import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ResourceGauge } from '../components/ui/ResourceGauge';

type AgentStatus = 'running' | 'completed' | 'failed' | 'pending';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  lastHeartbeat: Date;
  cpu: number;
  memory: number;
  tasksCompleted: number;
  tasksInProgress: number;
  uptime: string;
  currentTask?: string;
  skills: string[];
}

const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Orchestrator Prime',
    role: 'Task Decomposition & Routing',
    status: 'running',
    lastHeartbeat: new Date(Date.now() - 2000),
    cpu: 45,
    memory: 62,
    tasksCompleted: 1847,
    tasksInProgress: 3,
    uptime: '14h 23m',
    currentTask: 'Decomposing: "Build authentication module"',
    skills: ['task-decomposition', 'routing', 'scheduling'],
  },
  {
    id: 'agent-2',
    name: 'Code Weaver',
    role: 'Code Generation & Refactoring',
    status: 'running',
    lastHeartbeat: new Date(Date.now() - 1000),
    cpu: 78,
    memory: 71,
    tasksCompleted: 2341,
    tasksInProgress: 2,
    uptime: '14h 23m',
    currentTask: 'Generating: React auth context provider',
    skills: ['typescript', 'react', 'node.js', 'python'],
  },
  {
    id: 'agent-3',
    name: 'Test Sentinel',
    role: 'Test Generation & Validation',
    status: 'running',
    lastHeartbeat: new Date(Date.now() - 3000),
    cpu: 34,
    memory: 45,
    tasksCompleted: 892,
    tasksInProgress: 1,
    uptime: '14h 23m',
    currentTask: 'Writing unit tests for UserService',
    skills: ['vitest', 'jest', 'cypress', 'playwright'],
  },
  {
    id: 'agent-4',
    name: 'Doc Scribe',
    role: 'Documentation & Explanation',
    status: 'pending',
    lastHeartbeat: new Date(Date.now() - 5000),
    cpu: 12,
    memory: 28,
    tasksCompleted: 567,
    tasksInProgress: 0,
    uptime: '14h 23m',
    skills: ['markdown', 'openapi', 'jsdoc'],
  },
  {
    id: 'agent-5',
    name: 'Quality Guardian',
    role: 'Code Review & Quality Analysis',
    status: 'running',
    lastHeartbeat: new Date(Date.now() - 1500),
    cpu: 56,
    memory: 53,
    tasksCompleted: 1123,
    tasksInProgress: 4,
    uptime: '14h 23m',
    currentTask: 'Reviewing: database query optimization PR',
    skills: ['eslint', 'type-checking', 'security-audit', 'complexity-analysis'],
  },
  {
    id: 'agent-6',
    name: 'Recovery Warden',
    role: 'Error Recovery & Self-Healing',
    status: 'completed',
    lastHeartbeat: new Date(Date.now() - 8000),
    cpu: 8,
    memory: 35,
    tasksCompleted: 234,
    tasksInProgress: 0,
    uptime: '14h 23m',
    skills: ['error-analysis', 'rollback', 'circuit-breaker'],
  },
];

function HeartbeatIndicator({ lastHeartbeat, status }: { lastHeartbeat: Date; status: AgentStatus }) {
  const secondsAgo = Math.floor((Date.now() - lastHeartbeat.getTime()) / 1000);
  const isHealthy = secondsAgo < 10 && status === 'running';
  const isWarning = secondsAgo >= 10 && secondsAgo < 30;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`relative w-3 h-3`}>
        <div
          className={`absolute inset-0 rounded-full ${
            isHealthy ? 'bg-status-completed' : isWarning ? 'bg-status-warning' : 'bg-status-pending'
          }`}
        />
        {isHealthy && (
          <div className="absolute inset-0 rounded-full bg-status-completed animate-ping opacity-30" />
        )}
      </div>
      <span className="text-[10px] text-text-muted font-mono">
        {secondsAgo}s
      </span>
    </div>
  );
}

export function AgentsView() {
  const { t } = useTranslation('common');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const runningCount = MOCK_AGENTS.filter((a) => a.status === 'running').length;
  const totalTasks = MOCK_AGENTS.reduce((sum, a) => sum + a.tasksInProgress, 0);

  return (
    <div className="space-y-6">
      <AnimatedPanel variant="slideUp" duration={0.4}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.agents')}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-completed animate-pulse" />
              <span className="text-xs text-text-secondary">
                {runningCount} active, {totalTasks} tasks in progress
              </span>
            </div>
          </div>
        </div>
      </AnimatedPanel>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
        {MOCK_AGENTS.map((agent, i) => {
          const isExpanded = expandedAgent === agent.id;

          return (
            <motion.div
              key={agent.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
              className={`
                glass-panel p-5 cursor-pointer transition-all duration-fast
                hover:border-accent-primary/30 hover:shadow-lg hover:shadow-accent-primary/5
                ${isExpanded ? 'border-accent-primary/50 shadow-lg shadow-accent-primary/10 tablet:col-span-2 desktop:col-span-1' : ''}
              `}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-lg
                    ${agent.status === 'running' ? 'bg-accent-primary/10 shadow-md shadow-accent-primary/10' : 'bg-dark-tertiary'}
                  `}>
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{agent.name}</h3>
                    <p className="text-[10px] text-text-muted">{agent.role}</p>
                  </div>
                </div>
                <HeartbeatIndicator lastHeartbeat={agent.lastHeartbeat} status={agent.status} />
              </div>

              {/* Status */}
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={agent.status} size="sm" pulse={agent.status === 'running'} />
                <span className="text-[10px] text-text-muted">
                  {agent.tasksCompleted.toLocaleString()} completed
                </span>
              </div>

              {/* Resource Gauges */}
              <div className="space-y-2 mb-3">
                <ResourceGauge value={agent.cpu} label="CPU" size="sm" />
                <ResourceGauge value={agent.memory} label="Memory" size="sm" />
              </div>

              {/* Current Task */}
              {agent.currentTask && (
                <div className="p-2 rounded bg-dark-primary/50 border border-dark-tertiary/50 mb-3">
                  <p className="text-[10px] text-text-muted mb-0.5">Current Task</p>
                  <p className="text-xs text-accent-primary truncate">{agent.currentTask}</p>
                </div>
              )}

              {/* Expanded Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-dark-tertiary pt-3 mt-3 space-y-3">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded bg-dark-primary/50">
                          <p className="text-lg font-bold text-text-primary">{agent.tasksInProgress}</p>
                          <p className="text-[10px] text-text-muted">In Progress</p>
                        </div>
                        <div className="text-center p-2 rounded bg-dark-primary/50">
                          <p className="text-lg font-bold text-text-primary">{agent.tasksCompleted.toLocaleString()}</p>
                          <p className="text-[10px] text-text-muted">Completed</p>
                        </div>
                        <div className="text-center p-2 rounded bg-dark-primary/50">
                          <p className="text-lg font-bold text-text-primary">{agent.uptime}</p>
                          <p className="text-[10px] text-text-muted">Uptime</p>
                        </div>
                      </div>

                      {/* Skills */}
                      <div>
                        <p className="text-[10px] text-text-muted mb-1.5">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.skills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 text-[10px] bg-accent-primary/10 text-accent-primary rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-dark-tertiary text-text-secondary hover:text-text-primary transition-colors">
                          View Logs
                        </button>
                        <button className="flex-1 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-dark-tertiary text-text-secondary hover:text-text-primary transition-colors">
                          Restart
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expand indicator */}
              <div className="flex justify-center mt-2">
                <motion.svg
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="w-4 h-4 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
