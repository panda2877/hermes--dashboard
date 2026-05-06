import { defineStore } from 'pinia'

export interface AgentInfo {
  id: string
  name: string
  model: string
  status: 'online' | 'offline' | 'error'
  totalTasks: number
  uptime: string
  concurrency: number
}

interface AgentsState {
  agents: AgentInfo[]
}

export const useAgentsStore = defineStore('agents', {
  state: (): AgentsState => ({
    agents: [
      { id: 'xingruyin', name: '幸如音', model: 'DeepSeek-V3', status: 'online', totalTasks: 47, uptime: '12h 34m', concurrency: 3 },
      { id: 'ziling', name: '紫灵', model: 'Claude-3.5-Sonnet', status: 'online', totalTasks: 32, uptime: '8h 21m', concurrency: 2 },
      { id: 'siyue', name: '思月', model: 'GPT-4o', status: 'online', totalTasks: 28, uptime: '6h 15m', concurrency: 2 },
      { id: 'mo', name: '墨', model: 'DeepSeek-R1', status: 'offline', totalTasks: 15, uptime: '0h 0m', concurrency: 0 },
    ],
  }),
  actions: {
    refresh() {
      // TODO: 对接后端 API 刷新 Agent 状态
    },
  },
})