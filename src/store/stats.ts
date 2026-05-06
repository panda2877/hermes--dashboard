import { defineStore } from 'pinia'
import { request } from '@/utils/request'

// ── 类型定义 ─────────────────────────────────────────────────────────────────

export interface DailyStats {
  date: string
  tokens: number
  promptTokens: number
  completionTokens: number
}

export interface ModelStats {
  model: string
  tokens: number
  percentage: number
}

export interface StatsSummary {
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCost: number
  modelDistribution: ModelStats[]
}

interface StatsState {
  // 数据
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCost: number
  dailyStats: DailyStats[]
  modelStats: ModelStats[]
  modelList: string[]
  // 筛选状态
  timeRange: 'today' | 'week' | 'month'
  selectedModel: string
  // 加载状态
  loading: boolean
  error: string | null
}

// ── 日期范围辅助 ─────────────────────────────────────────────────────────────

function getDateRange(range: 'today' | 'week' | 'month'): { startDate: string; endDate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD
  const today = new Date()
  const endDate = fmt(today)

  const start = new Date(today)
  switch (range) {
    case 'today':
      start.setDate(today.getDate())
      break
    case 'week':
      start.setDate(today.getDate() - 6)
      break
    case 'month':
      start.setDate(today.getDate() - 29)
      break
  }

  return { startDate: fmt(start), endDate }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useStatsStore = defineStore('stats', {
  state: (): StatsState => ({
    totalTokens: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCost: 0,
    dailyStats: [],
    modelStats: [],
    modelList: [],
    timeRange: 'week',
    selectedModel: '',
    loading: false,
    error: null,
  }),

  actions: {
    /**
     * 从 BFF 获取统计数据
     */
    async fetchStats(range?: 'today' | 'week' | 'month') {
      if (range) this.timeRange = range
      this.loading = true
      this.error = null

      const { startDate, endDate } = getDateRange(this.timeRange)

      try {
        // 并行请求 summary + daily + models
        const [summaryRes, dailyRes, modelsRes] = await Promise.all([
          request<StatsSummary>({
            url: `/tokens/summary`,
            data: { startDate, endDate },
          }),
          request<{ data: DailyStats[] }>({
            url: `/tokens/daily`,
            data: { startDate, endDate },
          }),
          request<{ models: string[] }>({
            url: `/tokens/models`,
          }),
        ])

        // 更新状态
        this.totalTokens = summaryRes.totalTokens
        this.totalPromptTokens = summaryRes.totalPromptTokens
        this.totalCompletionTokens = summaryRes.totalCompletionTokens
        this.totalCost = summaryRes.totalCost
        this.modelStats = summaryRes.modelDistribution
        this.dailyStats = dailyRes.data
        this.modelList = modelsRes.models.filter(Boolean) // 过滤空字符串
      } catch (err: any) {
        console.error('[stats] fetchStats failed:', err)
        this.error = err?.message || '加载失败'
      } finally {
        this.loading = false
      }
    },

    /**
     * 刷新当前范围数据
     */
    async refresh() {
      await this.fetchStats()
    },

    setTimeRange(range: 'today' | 'week' | 'month') {
      this.timeRange = range
      this.fetchStats()
    },

    setSelectedModel(model: string) {
      this.selectedModel = model
      // TODO: 按模型筛选统计（需要后端支持 model 参数）
    },
  },
})
