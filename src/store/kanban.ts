import { defineStore } from 'pinia'
import { request } from '@/utils/request'

// ── 类型定义 ─────────────────────────────────────────────────────────────────

export interface TaskItem {
  id: string
  title: string
  body?: string
  priority: string   // 'P0' | 'P1' | 'P2' (前端展示用)
  project: string
  assignee: string
  status: 'backlog' | 'in_progress' | 'done' | 'completed' | 'archived'
  phase?: string
  createdAt?: number   // unix timestamp
  completedAt?: number
}

export interface KanbanStats {
  backlog: number
  in_progress: number
  done: number
}

interface KanbanState {
  backlog: TaskItem[]
  inProgress: TaskItem[]
  done: TaskItem[]
  filter: {
    project: string
    assignee: string
    priority: string
  }
  stats: KanbanStats
  loading: boolean
  error: string | null
}

// ── 辅助：将 BFF 返回的 priority 数字转为 P0/P1/P2 ───────────────────────────

function priorityLabel(p: number | string): string {
  if (typeof p === 'string' && p.startsWith('P')) return p
  const n = typeof p === 'number' ? p : parseInt(p as string, 10)
  if (n <= 1) return 'P0'
  if (n === 2) return 'P1'
  return 'P2'
}

// ── 辅助：将 workspace_path 提取短项目名 ─────────────────────────────────────

function shortProject(path: string): string {
  if (!path) return ''
  // 取路径最后一段目录名
  const parts = path.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || path
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useKanbanStore = defineStore('kanban', {
  state: (): KanbanState => ({
    backlog: [],
    inProgress: [],
    done: [],
    filter: {
      project: '',
      assignee: '',
      priority: '',
    },
    stats: { backlog: 0, in_progress: 0, done: 0 },
    loading: false,
    error: null,
  }),

  actions: {
    /**
     * 从 BFF 拉取任务列表，按状态分列
     */
    async fetchTasks() {
      this.loading = true
      this.error = null

      try {
        const params: Record<string, string> = {}
        if (this.filter.project) params.project = this.filter.project
        if (this.filter.assignee) params.assignee = this.filter.assignee
        if (this.filter.priority) params.priority = this.filter.priority

        const res = await request<{ total: number; data: any[] }>({
          url: '/kanban/tasks',
          data: params,
        })

        const tasks: TaskItem[] = (res.data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          body: t.body || '',
          priority: priorityLabel(t.priority),
          project: shortProject(t.project || t.workspace_path || ''),
          assignee: t.assignee || '',
          status: t.status,
          phase: t.phase || t.workflow_template_id || '',
          createdAt: t.created_at,
          completedAt: t.completed_at,
        }))

        // 按状态分列
        this.backlog = tasks.filter(t => t.status === 'backlog')
        this.inProgress = tasks.filter(t => t.status === 'in_progress')
        this.done = tasks.filter(t => t.status === 'done' || t.status === 'completed')
      } catch (err: any) {
        console.error('[kanban] fetchTasks failed:', err)
        this.error = err?.message || '加载失败'
      } finally {
        this.loading = false
      }
    },

    /**
     * 从 BFF 拉取看板统计
     */
    async fetchStats() {
      try {
        const res = await request<Record<string, number>>({
          url: '/kanban/stats',
        })
        this.stats = {
          backlog: res.backlog || 0,
          in_progress: res.in_progress || 0,
          done: (res.done || 0) + (res.completed || 0),
        }
      } catch (err: any) {
        console.error('[kanban] fetchStats failed:', err)
      }
    },

    /**
     * 切换任务状态（拖拽后调用 BFF）
     */
    async moveTask(taskId: string, toStatus: 'backlog' | 'in_progress' | 'done') {
      // 先本地乐观更新
      const task = this.findTask(taskId)
      if (!task) return

      // 从旧列移除
      this.backlog = this.backlog.filter(t => t.id !== taskId)
      this.inProgress = this.inProgress.filter(t => t.id !== taskId)
      this.done = this.done.filter(t => t.id !== taskId)

      // 放入新列
      task.status = toStatus
      if (toStatus === 'backlog') this.backlog.unshift(task)
      else if (toStatus === 'in_progress') this.inProgress.unshift(task)
      else this.done.unshift(task)

      // 调用 BFF 同步后端
      try {
        await request({
          url: `/kanban/tasks/${taskId}/status`,
          method: 'PUT',
          data: { status: toStatus },
        })
      } catch (err: any) {
        console.error('[kanban] moveTask failed:', err)
        // 失败时刷新整列
        await this.fetchTasks()
      }
    },

    /**
     * 设置筛选条件并重新拉取
     */
    async setFilter(filter: { project?: string; assignee?: string; priority?: string }) {
      if (filter.project !== undefined) this.filter.project = filter.project
      if (filter.assignee !== undefined) this.filter.assignee = filter.assignee
      if (filter.priority !== undefined) this.filter.priority = filter.priority
      await this.fetchTasks()
    },

    /**
     * 清除所有筛选
     */
    async clearFilter() {
      this.filter = { project: '', assignee: '', priority: '' }
      await this.fetchTasks()
    },

    /**
     * 刷新（任务 + 统计）
     */
    async refresh() {
      await Promise.all([this.fetchTasks(), this.fetchStats()])
    },

    /**
     * 在内存中查找任务
     */
    findTask(taskId: string): TaskItem | undefined {
      return (
        this.backlog.find(t => t.id === taskId) ||
        this.inProgress.find(t => t.id === taskId) ||
        this.done.find(t => t.id === taskId)
      )
    },
  },
})
