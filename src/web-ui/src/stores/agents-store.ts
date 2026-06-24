import { create } from 'zustand';

export interface AgentState {
  id: string;
  type: string;
  specialization: string;
  status: string;
  assignedTaskName: string;
  resourceUtilization: number;
  lastHeartbeat: number;
  startTime: number;
}

interface AgentsSlice {
  agents: Map<string, AgentState>;
  selectedAgentId: string | null;
  updateAgent: (id: string, update: Partial<AgentState>) => void;
  removeAgent: (id: string) => void;
  selectAgent: (id: string | null) => void;
  hydrateAgents: (agents: AgentState[]) => void;
}

export const useAgentsStore = create<AgentsSlice>((set) => ({
  agents: new Map(),
  selectedAgentId: null,

  updateAgent: (id: string, update: Partial<AgentState>) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      const existing = newAgents.get(id);
      if (existing) {
        newAgents.set(id, { ...existing, ...update });
      } else {
        newAgents.set(id, {
          id,
          type: '',
          specialization: '',
          status: 'idle',
          assignedTaskName: '',
          resourceUtilization: 0,
          lastHeartbeat: Date.now(),
          startTime: Date.now(),
          ...update,
        } as AgentState);
      }
      return { agents: newAgents };
    }),

  removeAgent: (id: string) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.delete(id);
      return {
        agents: newAgents,
        selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
      };
    }),

  selectAgent: (id: string | null) =>
    set({ selectedAgentId: id }),

  hydrateAgents: (agents: AgentState[]) =>
    set(() => {
      const agentMap = new Map<string, AgentState>();
      for (const agent of agents) {
        agentMap.set(agent.id, agent);
      }
      return { agents: agentMap };
    }),
}));
