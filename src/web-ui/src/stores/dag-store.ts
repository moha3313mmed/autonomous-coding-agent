import { create } from 'zustand';

export interface DAGNodeState {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'recovering';
  assignedAgent?: string;
  estimatedDuration: number;
  actualDuration?: number;
  position: { x: number; y: number };
}

export interface DAGEdgeState {
  id: string;
  source: string;
  target: string;
  isCriticalPath: boolean;
}

export interface ParallelismMetrics {
  wallClockTime: number;
  cumulativeAgentTime: number;
  parallelismRatio: number;
}

interface DAGSlice {
  nodes: Map<string, DAGNodeState>;
  edges: DAGEdgeState[];
  criticalPath: string[];
  selectedNodeId: string | null;
  parallelismMetrics: ParallelismMetrics | null;
  updateNodeStatus: (id: string, status: DAGNodeState['status']) => void;
  setDAG: (nodes: DAGNodeState[], edges: DAGEdgeState[]) => void;
  selectNode: (id: string | null) => void;
  setCriticalPath: (path: string[]) => void;
}

export const useDAGStore = create<DAGSlice>((set) => ({
  nodes: new Map(),
  edges: [],
  criticalPath: [],
  selectedNodeId: null,
  parallelismMetrics: null,

  updateNodeStatus: (id: string, status: DAGNodeState['status']) =>
    set((state) => {
      const newNodes = new Map(state.nodes);
      const node = newNodes.get(id);
      if (!node) return state;
      newNodes.set(id, { ...node, status });
      return { nodes: newNodes };
    }),

  setDAG: (nodes: DAGNodeState[], edges: DAGEdgeState[]) =>
    set(() => {
      const nodeMap = new Map<string, DAGNodeState>();
      for (const node of nodes) {
        nodeMap.set(node.id, node);
      }

      // Compute parallelism metrics
      const completedNodes = nodes.filter((n) => n.status === 'completed' && n.actualDuration != null);
      let parallelismMetrics: ParallelismMetrics | null = null;
      if (completedNodes.length > 0) {
        const cumulativeAgentTime = completedNodes.reduce((sum, n) => sum + (n.actualDuration || 0), 0);
        const wallClockTime = Math.max(...completedNodes.map((n) => n.actualDuration || 0), 1);
        parallelismMetrics = {
          wallClockTime,
          cumulativeAgentTime,
          parallelismRatio: cumulativeAgentTime / wallClockTime,
        };
      }

      return { nodes: nodeMap, edges, parallelismMetrics };
    }),

  selectNode: (id: string | null) =>
    set({ selectedNodeId: id }),

  setCriticalPath: (path: string[]) =>
    set({ criticalPath: path }),
}));
