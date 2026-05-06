import { defineStore } from 'pinia'
import { request } from '@/utils/request'

// ── 类型定义 ─────────────────────────────────────────────────────────────────

export interface TrendItem {
  label: string
  tokens: number
  promptTokens: number
  completionTokens: number
}

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

// ── 日期范围辅助（北京时间）──────────────────────────────────────────────────

/** 格式化日期为 YYYY-MM-DD（北京时间） */
function fmtBJ(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}

function getDateRange(range: 'today' | 'week' | 'month'): { startDate: string; endDate: string } {
  const today = new Date()
  const todayBJ = fmtBJ(today)   // 北京时间今天

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

  return { startDate: fmtBJ(start), endDate: todayBJ }
}

/** 根据时间范围返回趋势图的粒度 */
function getGranularity(range: 'today' | 'week' | 'month'): string {
  switch (range) {
    case 'today': return '2hour'
    case 'week':  return 'daily'
    case 'month': return 'weekly'
  }
}

/** 趋势标签格式化（仅在前端美化显示） */
function formatTrendLabel(label: string, range: 'today' | 'week' | 'month'): string {
  if (range === 'today') {
    // "00:00" → "00-02", "02:00" → "02-04", ...
    const hour = label.split(':')[0]
    return `${hour.padStart(2, '0')}-${String(parseInt(hour, 10) + 2).padStart(2, '0')}`
  }
  if (range === 'month') {
    // "2026-W18" → "W18"
    return label.replace(/^\d{4}-W/, 'W')
  }
  // daily: "2026-05-06" → "05-06"
  return label.slice(5)
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useStatsStore = defineStore('stats', {
  state: (): {
    totalTokens: number
    totalPromptTokens: number
    totalCompletionTokens: number
    totalCost: number      // 总费用（$，来自 LiteLLM）
    backupCost: number     // deepseek-backup 费用（元）
    totalCostRMB: number   // 全部模型按 0.15元/M 计算的总费用
    totalChange: number    // 增幅：当前 vs 上一周期（百分比）
    trendStats: TrendItem[] // 趋势数据（不同粒度）
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
    totalChange: 0,
    trendStats: [],
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
      const granularity = getGranularity(this.timeRange)

      // 计算上一周期的日期范围（长度相同，往前推）
      const rangeLen = this.timeRange === 'today' ? 1 : this.timeRange === 'week' ? 7 : 30
      const prevStart = new Date(getDateRange(this.timeRange).startDate)
      prevStart.setDate(prevStart.getDate() - rangeLen)
      const prevEnd = new Date(getDateRange(this.timeRange).startDate)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStartDate = fmtBJ(prevStart)
      const prevEndDate = fmtBJ(prevEnd)

      try {
        // 并行请求：当前周期 summary + trend + models + 上一周期 summary
        const trendParams: Record<string, string> = { startDate, endDate, granularity }
        if (this.selectedModel) trendParams.model = this.selectedModel

        const [summaryRes, trendRes, modelsRes, prevSummaryRes] = await Promise.all([
          request<StatsSummary>({ url: `/tokens/summary`, data: { startDate, endDate } }),
          request<{ data: TrendItem[] }>({ url: `/tokens/trend`, data: trendParams }),
          request<{ models: string[] }>({ url: `/tokens/models` }),
          request<StatsSummary>({ url: `/tokens/summary`, data: { startDate: prevStartDate, endDate: prevEndDate } }),
        ])

        // 基础数据
        this.totalTokens = summaryRes.totalTokens
        this.totalPromptTokens = summaryRes.totalPromptTokens
        this.totalCompletionTokens = summaryRes.totalCompletionTokens
        this.totalCost = summaryRes.totalCost
        this.modelStats = summaryRes.modelDistribution || []
        this.trendStats = (trendRes?.data || []).map(d => ({
          ...d,
          label: formatTrendLabel(d.label, this.timeRange),
        }))
        this.modelList = (modelsRes?.models || []).filter(Boolean)

        // 增幅：当前 vs 上一周期
        const prevTokens = prevSummaryRes?.totalTokens || 0
        if (prevTokens > 0) {
          this.totalChange = Math.round(((this.totalTokens - prevTokens) / prevTokens) * 100)
        } else {
          this.totalChange = 0
        }

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
      this.fetchStats()
    },
  },
})
