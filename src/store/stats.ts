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

// ── 费用计算常量 ─────────────────────────────────────────────────────────────

const PRICE_RMB_PER_M_TOKEN = 0.15 // 元 / 百万 tokens

// 各模型单价（元 / 百万 tokens）
const MODEL_PRICES: Record<string, number> = {
  'deepseek-sensenova': 0.15,
  'minimax-main': 0.15,
  'deepseek-backup': 1.0,
  // 空字符串模型
  '': 0,
}

/**
 * 计算单个模型的费用（元）
 */
function calcModelCost(tokens: number, model: string): number {
  const price = MODEL_PRICES[model] ?? 0.15
  return (tokens / 1_000_000) * price
}

// ── 日期范围辅助 ─────────────────────────────────────────────────────────────

function getDateRange(range: 'today' | 'week' | 'month'): { startDate: string; endDate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
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
  state: (): {
    totalTokens: number
    totalPromptTokens: number
    totalCompletionTokens: number
    totalCost: number      // 总费用（元，含所有模型）
    backupCost: number     // deepseek-backup 费用（元）
    totalCostRMB: number   // 全部模型按 0.15元/M 计算的总费用
    dailyStats: DailyStats[]
    modelStats: ModelStats[]
    modelList: string[]
    timeRange: 'today' | 'week' | 'month'
    selectedModel: string
    loading: boolean
    error: string | null
  } => ({
    totalTokens: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCost: 0,
    backupCost: 0,
    totalCostRMB: 0,
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
          request<StatsSummary>({ url: `/tokens/summary`, data: { startDate, endDate } }),
          request<{ data: DailyStats[] }>({ url: `/tokens/daily`, data: { startDate, endDate } }),
          request<{ models: string[] }>({ url: `/tokens/models` }),
        ])

        // 基础数据
        this.totalTokens = summaryRes.totalTokens
        this.totalPromptTokens = summaryRes.totalPromptTokens
        this.totalCompletionTokens = summaryRes.totalCompletionTokens
        this.totalCost = summaryRes.totalCost
        this.modelStats = summaryRes.modelDistribution || []
        this.dailyStats = dailyRes?.data || []
        this.modelList = (modelsRes?.models || []).filter(Boolean)

        // 计算费用（元）
        this.totalCostRMB = (this.totalTokens / 1_000_000) * PRICE_RMB_PER_M_TOKEN
        this.backupCost = calcModelCost(
          this.modelStats.find(m => m.model === 'deepseek-backup')?.tokens || 0,
          'deepseek-backup'
        )
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
      // TODO: 按模型筛选统计
    },
  },
})
