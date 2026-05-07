import { defineStore } from 'pinia'
import { request } from '@/utils/request'

// BFF 返回类型
interface AgentRaw {
  id: string
  name: string
  model: string
  pid: number
  state: string
  uptime: string
  uptimeSeconds: number
  backlogCount: number
  isMain: boolean
}

interface ApiResponse {
  agents: AgentRaw[]
}

// 展示类型
export interface AgentInfo {
  id: string
  name: string
  model: string
  pid: number
  state: 'running' | 'stopped' | 'error'
  uptime: string
  uptimeSeconds: number
  backlogCount: number
  isMain: boolean
}

interface AgentsState {
  agents: AgentInfo[]
  loading: boolean
  error: string | null
}

export const useAgentsStore = defineStore('agents', {
  state: (): AgentsState => ({
    agents: [],
    loading: false,
    error: null,
  }),

  actions: {
    async refresh() {
      this.loading = true
      this.error = null
      try {
        const res = await request<ApiResponse>({ url: '/agents' })
        this.agents = res.agents.map((a) => ({
          id: a.id,
          name: a.name,
          model: a.model,
          pid: a.pid,
          state: a.state === 'running'
            ? 'running'
            : a.state === 'stopped'
              ? 'stopped'
              : 'error',
          uptime: a.uptime,
          uptimeSeconds: a.uptimeSeconds,
          backlogCount: a.backlogCount ?? 0,
          isMain: a.isMain ?? false,
        }))
      } catch (err: any) {
        this.error = err?.message || '加载失败'
      } finally {
        this.loading = false
      }
    },
  },
})
