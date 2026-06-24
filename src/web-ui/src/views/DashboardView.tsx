import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAgentsStore, type AgentState } from '../stores/agents-store';
import { useHealthStore, type SystemStatus, type HealthTimelineEntry } from '../stores/health-store';
import { useTasksStore } from '../stores/tasks-store';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ResourceGauge } from '../components/ui/ResourceGauge';

// --- Helper Components ---

function HeartbeatIndicator({ lastHeartbeat }: { lastHeartbeat: number }) {
  const elapsed = Date.now() - lastHeartbeat;
  const isStale = elapsed > 30_000;

  return (
    <span className="relative inline-flex items-center">
      <span
        className={`
          w-2.5 h-2.5 rounded-full
          ${isStale ? 'bg-status-warning' : 'bg-status-completed'}
        `}
      />
      {!isStale && (
        <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-status-completed animate-ping opacity-40" />
      )}
    </span>
  );
}

function AgentTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    orchestrator: '\u2B21',
    worker: '\u2699',
    planner: '\u2B22',
    reviewer: '\u2B23',
    coder: '\u27A4',
    analyst: '\u25C8',
  };
  return (
    <span className="text-lg text-accent-primary">
      {icons[type.toLowerCase()] ?? '\u25CF'}
    </span>
  );
}

function getStatusBadgeType(status: string): 'running' | 'completed' | 'failed' | 'warning' | 'pending' {
  switch (status) {
    case 'running':
    case 'active':
      return 'running';
    case 'completed':
    case 'done':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    case 'warning':
    case 'degraded':
      return 'warning';
    default:
      return 'pending';
  }
}

// --- Summary Card ---

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function SummaryCard({ label, value, icon, accent = 'accent-primary', trend }: SummaryCardProps) {
  return (
    <div className="glass-panel p-4 relative overflow-hidden group hover:border-accent-primary/30 transition-colors duration-normal">
      {/* Glow effect */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-normal bg-gradient-to-br from-${accent}/5 to-transparent pointer-events-none`} />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wide font-medium">{label}</span>
          <span className="text-2xl font-bold text-text-primary font-mono">{value}</span>
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>

      {trend && (
        <div className="mt-2 relative z-10">
          <span className={`text-xs font-medium ${
            trend === 'up' ? 'text-status-completed' :
            trend === 'down' ? 'text-status-failed' :
            'text-text-muted'
          }`}>
            {trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192'} vs last hour
          </span>
        </div>
      )}
    </div>
  );
}

// --- Agent Card ---

function AgentCard({ agent, index }: { agent: AgentState; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      className="glass-panel p-4 hover:border-accent-primary/30 transition-all duration-normal cursor-pointer group"
    >
      {/* Header: Icon + Name + Heartbeat */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-dark-tertiary flex items-center justify-center group-hover:bg-accent-primary/10 transition-colors duration-normal">
            <AgentTypeIcon type={agent.type} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary truncate max-w-[120px]">
              {agent.id}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider">
              {agent.specialization || agent.type}
            </span>
          </div>
        </div>
        <HeartbeatIndicator lastHeartbeat={agent.lastHeartbeat} />
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        <StatusBadge
          status={getStatusBadgeType(agent.status)}
          label={agent.status}
          size="sm"
          pulse={agent.status === 'running' || agent.status === 'active'}
        />
      </div>

      {/* Assigned Task */}
      {agent.assignedTaskName && (
        <div className="mb-3">
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">Task</p>
          <p className="text-xs text-text-secondary truncate">{agent.assignedTaskName}</p>
        </div>
      )}

      {/* Resource Gauge */}
      <ResourceGauge
        value={agent.resourceUtilization}
        label="Resource"
        size="sm"
        showPercentage
      />
    </motion.div>
  );
}

// --- Health Mini Timeline ---

function HealthMiniTimeline({ entries }: { entries: HealthTimelineEntry[] }) {
  const recentEntries = entries.slice(-12);

  const statusColor: Record<SystemStatus, string> = {
    healthy: 'bg-status-completed',
    degraded: 'bg-status-warning',
    critical: 'bg-status-failed',
  };

  if (recentEntries.length === 0) {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-6 rounded-sm bg-dark-tertiary/50"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-8">
      {recentEntries.map((entry, i) => (
        <motion.div
          key={`${entry.timestamp}-${i}`}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3, delay: i * 0.03 }}
          className={`flex-1 rounded-sm origin-bottom ${statusColor[entry.status]}`}
          style={{ height: entry.status === 'healthy' ? '100%' : entry.status === 'degraded' ? '66%' : '33%' }}
          title={`${entry.status} - ${new Date(entry.timestamp).toLocaleTimeString()}`}
        />
      ))}
    </div>
  );
}

// --- System Health Card ---

function SystemHealthCard() {
  const { systemStatus, resourceGauges, healthTimeline } = useHealthStore();

  const statusLabel: Record<SystemStatus, string> = {
    healthy: 'All Systems Operational',
    degraded: 'Degraded Performance',
    critical: 'Critical Issues Detected',
  };

  const statusGlow: Record<SystemStatus, string> = {
    healthy: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]',
    degraded: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]',
    critical: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  };

  return (
    <div className={`glass-panel p-5 ${statusGlow[systemStatus]} transition-shadow duration-normal`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">System Health</h3>
        <StatusBadge
          status={systemStatus === 'healthy' ? 'completed' : systemStatus === 'degraded' ? 'warning' : 'failed'}
          label={statusLabel[systemStatus]}
          size="sm"
          pulse={systemStatus !== 'healthy'}
        />
      </div>

      {/* Resource Gauges */}
      <div className="space-y-3 mb-4">
        <ResourceGauge
          value={Math.round((resourceGauges.cpu.value / resourceGauges.cpu.max) * 100)}
          label={resourceGauges.cpu.name}
          size="sm"
        />
        <ResourceGauge
          value={Math.round((resourceGauges.memory.value / resourceGauges.memory.max) * 100)}
          label={resourceGauges.memory.name}
          size="sm"
        />
        <ResourceGauge
          value={Math.round((resourceGauges.network.value / resourceGauges.network.max) * 100)}
          label={resourceGauges.network.name}
          size="sm"
        />
      </div>

      {/* Health Timeline */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Health Timeline</p>
        <HealthMiniTimeline entries={healthTimeline} />
      </div>
    </div>
  );
}

// --- Main Dashboard View ---

export function DashboardView() {
  const { t } = useTranslation('common');
  const agents = useAgentsStore((s) => s.agents);
  const tasks = useTasksStore((s) => s.tasks);
  const { systemStatus } = useHealthStore();

  // Compute summary metrics
  const metrics = useMemo(() => {
    const agentList = Array.from(agents.values());
    const taskList = Array.from(tasks.values());

    const activeTasks = taskList.filter((t) => t.status === 'running' || t.status === 'submitted').length;
    const failedTasks = taskList.filter((t) => t.status === 'failed').length;
    const completedTasks = taskList.filter((t) => t.status === 'completed').length;
    const totalTasks = taskList.length;
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
    const activeAgents = agentList.filter((a) => a.status === 'running' || a.status === 'active').length;
    const totalAgents = agentList.length;

    return {
      activeTasks,
      failedTasks,
      successRate,
      activeAgents,
      totalAgents,
      totalTasks,
    };
  }, [agents, tasks]);

  const agentList = useMemo(() => Array.from(agents.values()).slice(0, 10), [agents]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-2xl font-bold text-text-primary">{t('navigation.dashboard')}</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            systemStatus === 'healthy' ? 'bg-status-completed' :
            systemStatus === 'degraded' ? 'bg-status-warning' :
            'bg-status-failed'
          }`} />
          <span className="text-sm text-text-muted">
            {systemStatus === 'healthy' ? 'All systems operational' :
             systemStatus === 'degraded' ? 'Degraded performance' :
             'Critical issues'}
          </span>
        </div>
      </motion.div>

      {/* Summary Cards Row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-5 gap-4"
      >
        <SummaryCard
          label="Active Tasks"
          value={metrics.activeTasks}
          icon={'\u26A1'}
          trend="neutral"
        />
        <SummaryCard
          label="Agent Swarm"
          value={`${metrics.activeAgents}/${metrics.totalAgents}`}
          icon={'\u2B21'}
          trend={metrics.activeAgents > 0 ? 'up' : 'neutral'}
        />
        <SummaryCard
          label="Recent Errors"
          value={metrics.failedTasks}
          icon={'\u26A0'}
          accent="status-failed"
          trend={metrics.failedTasks > 0 ? 'down' : 'neutral'}
        />
        <SummaryCard
          label="Success Rate"
          value={`${metrics.successRate}%`}
          icon={'\u2713'}
          accent="status-completed"
          trend={metrics.successRate >= 90 ? 'up' : 'down'}
        />
        <SummaryCard
          label="System Health"
          value={systemStatus === 'healthy' ? 'OK' : systemStatus === 'degraded' ? 'WARN' : 'CRIT'}
          icon={'\u2665'}
          accent={systemStatus === 'healthy' ? 'status-completed' : 'status-warning'}
        />
      </motion.div>

      {/* Main Content: Agent Grid + Health Panel */}
      <div className="grid grid-cols-1 desktop:grid-cols-3 gap-6">
        {/* Agent Grid (2/3 width on desktop) */}
        <div className="desktop:col-span-2">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Agent Swarm</h2>
              <span className="text-xs text-text-muted font-mono">
                {agentList.length} agent{agentList.length !== 1 ? 's' : ''}
              </span>
            </div>

            {agentList.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3 opacity-40">{'\u2B21'}</span>
                <p className="text-text-secondary text-sm">No agents are currently active</p>
                <p className="text-text-muted text-xs mt-1">Agents will appear here when tasks are submitted</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
                {agentList.map((agent, index) => (
                  <AgentCard key={agent.id} agent={agent} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Health Overview (1/3 width on desktop) */}
        <div className="space-y-4">
          <SystemHealthCard />

          {/* Quick Stats */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Total Tasks</span>
                <span className="text-xs font-mono text-text-primary">{metrics.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Active Agents</span>
                <span className="text-xs font-mono text-text-primary">{metrics.activeAgents}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Failed Tasks</span>
                <span className="text-xs font-mono text-status-failed">{metrics.failedTasks}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
