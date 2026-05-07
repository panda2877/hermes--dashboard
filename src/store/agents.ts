import { defineStore } from 'pinia'
import { request } from '@/utils/request'

// BFF 返回类型
interface AgentRaw {
  id: string
  name: string
  model: string
  pid: number
  state: string
  workStatus: string | null
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
  state: 'running' | 'stopped'
  workStatus: 'working' | 'idle' | 'disconnected' | null
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
        this.agents = res.agents.map((a) => {
          // 工作状态计算：
          //   - gateway 没运行 → disconnected（断线）
          //   - gateway 运行中 + workStatus='working' → 工作中
          //   - gateway 运行中 + workStatus='idle' → 空闲
          //   - gateway 运行中 + workStatus=null → idle（兜底）
          let workStatus: AgentInfo['workStatus'] = 'disconnected'
          if (a.state === 'running') {
            workStatus = a.workStatus === 'working' ? 'working' : 'idle'
          }

          return {
            id: a.id,
            name: a.name,
            model: a.model,
            pid: a.pid,
            state: a.state === 'running' ? 'running' : 'stopped',
            workStatus,
            uptime: a.uptime,
            uptimeSeconds: a.uptimeSeconds,
            backlogCount: a.backlogCount ?? 0,
            isMain: a.isMain ?? false,
          }
        })
      } catch (err: any) {
        this.error = err?.message || '加载失败'
      } finally {
        this.loading = false
      }
    },
  },
})
