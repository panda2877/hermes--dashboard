import { defineStore } from 'pinia'

interface DailyStats {
  date: string
  tokens: number
  promptTokens: number
  completionTokens: number
}

interface ModelStats {
  model: string
  tokens: number
  percentage: number
}

interface StatsState {
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCost: number
  dailyStats: DailyStats[]
  modelStats: ModelStats[]
  timeRange: 'today' | 'week' | 'month'
  selectedModel: string
}

export const useStatsStore = defineStore('stats', {
  state: (): StatsState => ({
    totalTokens: 1847291,
    totalPromptTokens: 823456,
    totalCompletionTokens: 1023835,
    totalCost: 12.47,
    dailyStats: [
      { date: '05-01', tokens: 32000, promptTokens: 14000, completionTokens: 18000 },
      { date: '05-02', tokens: 28000, promptTokens: 12000, completionTokens: 16000 },
      { date: '05-03', tokens: 45000, promptTokens: 20000, completionTokens: 25000 },
      { date: '05-04', tokens: 38000, promptTokens: 17000, completionTokens: 21000 },
      { date: '05-05', tokens: 52000, promptTokens: 24000, completionTokens: 28000 },
      { date: '05-06', tokens: 41000, promptTokens: 19000, completionTokens: 22000 },
    ],
    modelStats: [
      { model: 'GPT-4o', tokens: 680000, percentage: 36.8 },
      { model: 'Claude-3.5', tokens: 520000, percentage: 28.2 },
      { model: 'DeepSeek-V3', tokens: 380000, percentage: 20.6 },
      { model: 'Gemini-Pro', tokens: 267291, percentage: 14.5 },
    ],
    timeRange: 'week',
    selectedModel: '',
  }),
  actions: {
    setTimeRange(range: 'today' | 'week' | 'month') {
      this.timeRange = range
    },
    setSelectedModel(model: string) {
      this.selectedModel = model
    },
  },
})