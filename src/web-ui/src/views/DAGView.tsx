import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  type Node,
  type Edge,
  type NodeProps,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  getBezierPath,
  type EdgeProps,
} from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { useDAGStore, type DAGNodeState } from '../stores/dag-store';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AnimatedPanel } from '../components/ui/AnimatedPanel';
import 'reactflow/dist/style.css';

// --- Status Utilities ---

type NodeStatus = DAGNodeState['status'];

const statusConfig: Record<NodeStatus, { color: string; borderColor: string; bgColor: string; icon: string }> = {
  pending: {
    color: 'text-text-muted',
    borderColor: 'border-dark-tertiary',
    bgColor: 'bg-dark-tertiary/40',
    icon: '\u25CB',
  },
  running: {
    color: 'text-status-running',
    borderColor: 'border-status-running',
    bgColor: 'bg-status-running/10',
    icon: '\u25B6',
  },
  completed: {
    color: 'text-status-completed',
    borderColor: 'border-status-completed',
    bgColor: 'bg-status-completed/10',
    icon: '\u2713',
  },
  failed: {
    color: 'text-status-failed',
    borderColor: 'border-status-failed',
    bgColor: 'bg-status-failed/10',
    icon: '\u2717',
  },
  recovering: {
    color: 'text-status-warning',
    borderColor: 'border-status-warning',
    bgColor: 'bg-status-warning/10',
    icon: '\u21BB',
  },
};

function getStatusBadgeType(status: NodeStatus): 'running' | 'completed' | 'failed' | 'warning' | 'pending' {
  switch (status) {
    case 'running': return 'running';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'recovering': return 'warning';
    default: return 'pending';
  }
}

// --- Custom DAG Node ---

interface DAGNodeData {
  label: string;
  status: NodeStatus;
  assignedAgent?: string;
  description: string;
  estimatedDuration: number;
  actualDuration?: number;
  isCriticalPath: boolean;
}

function DAGNode({ data, selected }: NodeProps<DAGNodeData>) {
  const config = statusConfig[data.status];

  return (
    <div
      className={`
        relative rounded-xl border-2 px-4 py-3 min-w-[180px] max-w-[220px]
        ${config.borderColor} ${config.bgColor}
        backdrop-blur-sm transition-all duration-normal
        ${selected ? 'ring-2 ring-accent-primary/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : ''}
        ${data.status === 'running' ? 'animate-[runningPulse_2s_ease-in-out_infinite]' : ''}
        ${data.isCriticalPath ? 'shadow-[0_0_12px_rgba(59,130,246,0.15)]' : ''}
      `}
    >
      {/* Animated border for running status */}
      {data.status === 'running' && (
        <div className="absolute inset-0 rounded-xl border-2 border-status-running/40 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
      )}

      {/* Handle: Input */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-dark-tertiary !border-2 !border-accent-primary/50 !-top-1.5"
      />

      {/* Node Content */}
      <div className="flex items-start gap-2.5">
        <span className={`text-lg ${config.color} mt-0.5`}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{data.label}</p>
          {data.assignedAgent && (
            <p className="text-[10px] text-text-muted mt-0.5 truncate">
              {'\u2192'} {data.assignedAgent}
            </p>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-2">
        <StatusBadge status={getStatusBadgeType(data.status)} size="sm" pulse={data.status === 'running'} />
      </div>

      {/* Handle: Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-dark-tertiary !border-2 !border-accent-primary/50 !-bottom-1.5"
      />
    </div>
  );
}

// --- Custom DAG Edge ---

function DAGEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
}: EdgeProps<{ isCriticalPath: boolean }>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isCritical = data?.isCriticalPath ?? false;

  return (
    <g>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isCritical ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)'}
        strokeWidth={isCritical ? 2.5 : 1.5}
        strokeDasharray={isCritical ? '8 4' : 'none'}
        className={isCritical ? 'animate-[dashFlow_1.5s_linear_infinite]' : ''}
        style={style}
      />
      {/* Arrow marker */}
      <path
        d={edgePath}
        fill="none"
        stroke={isCritical ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)'}
        strokeWidth={isCritical ? 2.5 : 1.5}
        markerEnd="url(#arrowhead)"
        style={{ ...style, opacity: 0.6 }}
      />
    </g>
  );
}

// --- Node Detail Panel ---

interface NodeDetailPanelProps {
  node: DAGNodeState;
  onClose: () => void;
}

function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const config = statusConfig[node.status];

  return (
    <AnimatedPanel variant="slideLeft" className="w-80 h-full border-s border-dark-tertiary bg-dark-secondary/95 backdrop-blur-md overflow-y-auto">
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-primary truncate">{node.label}</h3>
            <p className="text-xs text-text-muted mt-1">Node ID: {node.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-dark-tertiary"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Status */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Status</p>
          <StatusBadge status={getStatusBadgeType(node.status)} size="md" pulse={node.status === 'running'} />
        </div>

        {/* Description */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Description</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {node.description || 'No description available'}
          </p>
        </div>

        {/* Assigned Agent */}
        {node.assignedAgent && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Assigned Agent</p>
            <div className="flex items-center gap-2 glass-panel p-2.5 rounded-lg">
              <span className="text-accent-primary">{'\u2B21'}</span>
              <span className="text-sm text-text-primary">{node.assignedAgent}</span>
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Estimated</p>
            <p className="text-sm font-mono text-text-primary">
              {node.estimatedDuration > 0 ? `${node.estimatedDuration}s` : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Actual</p>
            <p className={`text-sm font-mono ${node.actualDuration != null ? 'text-text-primary' : 'text-text-muted'}`}>
              {node.actualDuration != null ? `${node.actualDuration}s` : '\u2014'}
            </p>
          </div>
        </div>

        {/* Duration comparison bar */}
        {node.estimatedDuration > 0 && node.actualDuration != null && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Duration Comparison</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted w-12">Est.</span>
                <div className="flex-1 h-2 bg-dark-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-primary/50 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted w-12">Act.</span>
                <div className="flex-1 h-2 bg-dark-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      node.actualDuration <= node.estimatedDuration ? 'bg-status-completed' : 'bg-status-failed'
                    }`}
                    style={{
                      width: `${Math.min(100, (node.actualDuration / node.estimatedDuration) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Output preview placeholder */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Output Preview</p>
          <div className="glass-panel p-3 rounded-lg font-mono text-xs text-text-muted">
            {node.status === 'completed' ? (
              <span className="text-status-completed">Task completed successfully</span>
            ) : node.status === 'failed' ? (
              <span className="text-status-failed">Task execution failed</span>
            ) : node.status === 'running' ? (
              <span className="text-status-running animate-pulse">Executing...</span>
            ) : (
              <span>Awaiting execution</span>
            )}
          </div>
        </div>
      </div>
    </AnimatedPanel>
  );
}

// --- Parallelism Metrics Display ---

function ParallelismMetricsDisplay() {
  const parallelismMetrics = useDAGStore((s) => s.parallelismMetrics);

  if (!parallelismMetrics) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 start-4 z-10 glass-panel p-3 rounded-lg"
    >
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Parallelism Metrics</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-text-muted">Wall Clock</p>
          <p className="text-sm font-mono font-semibold text-text-primary">
            {parallelismMetrics.wallClockTime}s
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Cumulative</p>
          <p className="text-sm font-mono font-semibold text-text-primary">
            {parallelismMetrics.cumulativeAgentTime}s
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Ratio</p>
          <p className="text-sm font-mono font-semibold text-accent-primary">
            {parallelismMetrics.parallelismRatio.toFixed(1)}x
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// --- Controls Panel ---

function DAGControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="absolute top-4 end-4 z-10 flex flex-col gap-1.5">
      <button
        onClick={() => zoomIn()}
        className="glass-panel w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-primary/30 transition-all rounded-lg text-sm"
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={() => zoomOut()}
        className="glass-panel w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-primary/30 transition-all rounded-lg text-sm"
        title="Zoom Out"
      >
        -
      </button>
      <button
        onClick={() => fitView({ padding: 0.2 })}
        className="glass-panel w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-primary/30 transition-all rounded-lg text-sm"
        title="Fit to View"
      >
        {'\u2922'}
      </button>
    </div>
  );
}

// --- Node Types & Edge Types ---

const nodeTypes: NodeTypes = {
  dagNode: DAGNode,
};

const edgeTypes: EdgeTypes = {
  dagEdge: DAGEdge,
};

// --- Inner DAG Flow (needs ReactFlowProvider) ---

function DAGFlowInner() {
  const { t } = useTranslation('common');
  const nodes = useDAGStore((s) => s.nodes);
  const edges = useDAGStore((s) => s.edges);
  const criticalPath = useDAGStore((s) => s.criticalPath);
  const selectedNodeId = useDAGStore((s) => s.selectedNodeId);
  const selectNode = useDAGStore((s) => s.selectNode);

  // Convert store nodes to ReactFlow nodes
  const flowNodes: Node<DAGNodeData>[] = useMemo(() => {
    return Array.from(nodes.values()).map((node) => ({
      id: node.id,
      type: 'dagNode',
      position: node.position,
      data: {
        label: node.label,
        status: node.status,
        assignedAgent: node.assignedAgent,
        description: node.description,
        estimatedDuration: node.estimatedDuration,
        actualDuration: node.actualDuration,
        isCriticalPath: criticalPath.includes(node.id),
      },
      selected: node.id === selectedNodeId,
    }));
  }, [nodes, criticalPath, selectedNodeId]);

  // Convert store edges to ReactFlow edges
  const flowEdges: Edge[] = useMemo(() => {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'dagEdge',
      data: { isCriticalPath: edge.isCriticalPath || criticalPath.includes(edge.source) && criticalPath.includes(edge.target) },
    }));
  }, [edges, criticalPath]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;

  const isEmpty = nodes.size === 0;

  return (
    <div className="space-y-0 h-full flex flex-col">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between px-1 pb-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('navigation.dag')}</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {isEmpty ? 'No DAG data available' : `${nodes.size} nodes \u2022 ${edges.length} edges`}
          </p>
        </div>

        {/* Critical Path toggle */}
        {criticalPath.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-accent-primary rounded-full" />
            <span className="text-xs text-text-muted">Critical Path</span>
          </div>
        )}
      </motion.div>

      {/* DAG Canvas */}
      <div className="flex-1 min-h-[500px] relative rounded-xl overflow-hidden border border-dark-tertiary bg-dark-primary">
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-5xl block mb-4 opacity-30">{'\u25C8'}</span>
              <p className="text-text-secondary text-sm">No DAG visualization available</p>
              <p className="text-text-muted text-xs mt-1">Submit a task to generate a dependency graph</p>
            </div>
          </div>
        ) : (
          <>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              className="!bg-transparent"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="var(--color-bg-tertiary)"
              />

              {/* SVG Defs for edge arrows */}
              <svg>
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--color-bg-tertiary)" />
                  </marker>
                </defs>
              </svg>
            </ReactFlow>

            {/* Custom Controls */}
            <DAGControls />

            {/* Parallelism Metrics */}
            <ParallelismMetricsDisplay />
          </>
        )}

        {/* Node Detail Panel (slides in from end) */}
        <AnimatePresence>
          {selectedNode && (
            <div className="absolute inset-y-0 end-0 z-20">
              <NodeDetailPanel node={selectedNode} onClose={() => selectNode(null)} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Main Export (wrapped in ReactFlowProvider) ---

export function DAGView() {
  return (
    <ReactFlowProvider>
      <DAGFlowInner />
    </ReactFlowProvider>
  );
}
