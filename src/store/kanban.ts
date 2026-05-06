import { defineStore } from 'pinia'
import { request } from '@/utils/request'

// ── 类型定义 ─────────────────────────────────────────────────────────────────

export interface TaskItem {
  id: string
  title: string
  body?: string
  priority: string   // 'P0' | 'P1' | 'P2'
  project: string    // 短项目名（展示用）
  projectPath: string // 完整 workspace_path（BFF 查询用）
  assignee: string
  assigneeZh: string  // 中文名（展示用）
  status: 'backlog' | 'in_progress' | 'done' | 'completed' | 'archived'
  phase?: string
  createdAt?: number
  completedAt?: number
}

export interface KanbanStats {
  backlog: number
  in_progress: number
  done: number
}

interface KanbanState {
  allTasks: TaskItem[]       // 原始全量任务（未筛选），供 picker 选项使用
  backlog: TaskItem[]
  inProgress: TaskItem[]
  done: TaskItem[]
  filter: {
    project: string      // 当前选中的短项目名
    assignee: string
    priority: string
  }
  stats: KanbanStats
  loading: boolean
  error: string | null
}

// ── 常量：负责人中英对照 ────────────────────────────────────────────────────

const ASSIGNEE_ZH: Record<string, string> = {
  'yinyue':      '银月',
  'xingruyin':   '辛如音',
  'ziling':      '紫灵',
  'siyue':       '思月',
}

function translateAssignee(en: string): string {
  if (!en) return ''
  // 支持逗号分隔多负责人：'yinyue,xingruyin' → '银月, 辛如音'
  return en.split(',').map(s => ASSIGNEE_ZH[s.trim()] || s.trim()).join(', ')
}

// ── 辅助：将 workspace_path 提取短项目名 ────────────────────────────────────

function shortProject(path: string): string {
  if (!path) return ''
  const parts = path.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || path
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useKanbanStore = defineStore('kanban', {
  state: (): KanbanState => ({
    allTasks: [],
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
     * 从 BFF 拉取任务列表（不传 project filter，BFF 按 assignee/priority 筛选）
     * project 筛选在本地进行（用 shortProject 比对）
     */
    async fetchTasks() {
      this.loading = true
      this.error = null

      try {
        const params: Record<string, string> = {}
        // 不传 project，BFF 返回全量数据（避免 shortName 与 fullPath 不匹配的问题）
        if (this.filter.assignee) params.assignee = this.filter.assignee
        if (this.filter.priority) params.priority = this.filter.priority

        const res = await request<{ total: number; data: any[] }>({
          url: '/kanban/tasks',
          data: params,
        })

        const allTasks: TaskItem[] = (res.data || []).map((t: any) => {
          const fullPath = t.project || t.workspace_path || ''
          const shortName = shortProject(fullPath)
          return {
            id: t.id,
            title: t.title,
            body: t.body || '',
            priority: priorityLabel(t.priority),
            project: shortName,
            projectPath: fullPath,
            assignee: t.assignee || '',
            assigneeZh: translateAssignee(t.assignee || ''),
            status: t.status,
            phase: t.phase || t.workflow_template_id || '',
            createdAt: t.created_at,
            completedAt: t.completed_at,
          }
        })

        // 保存全量（未筛选），供 picker 选项使用
        this.allTasks = allTasks

        // 本地 project 筛选
        const filtered = this.filter.project
          ? allTasks.filter(t => t.project === this.filter.project)
          : allTasks

        // 按 ID 升序排列
        const sortById = (arr: TaskItem[]) =>
          [...arr].sort((a, b) => a.id.localeCompare(b.id))

        // 按状态分列
        this.backlog    = sortById(filtered.filter(t => t.status === 'backlog'))
        this.inProgress = sortById(filtered.filter(t => t.status === 'in_progress'))
        this.done       = sortById(filtered.filter(t => t.status === 'done' || t.status === 'completed'))
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
          backlog:    res.backlog    || 0,
          in_progress: res.in_progress || 0,
          done:       (res.done || 0) + (res.completed || 0),
        }
      } catch (err: any) {
        console.error('[kanban] fetchStats failed:', err)
      }
    },

    /**
     * 切换任务状态（拖拽后调用 BFF）
     */
    async moveTask(taskId: string, toStatus: 'backlog' | 'in_progress' | 'done') {
      const task = this.findTask(taskId)
      if (!task) return

      // 乐观更新：从旧列移除
      this.backlog    = this.backlog.filter(t => t.id !== taskId)
      this.inProgress = this.inProgress.filter(t => t.id !== taskId)
      this.done       = this.done.filter(t => t.id !== taskId)

      // 放入新列
      task.status = toStatus
      if (toStatus === 'backlog')     this.backlog.unshift(task)
      else if (toStatus === 'in_progress') this.inProgress.unshift(task)
      else                             this.done.unshift(task)

      // 同步 BFF
      try {
        await request({
          url: `/kanban/tasks/${taskId}/status`,
          method: 'PUT',
          data: { status: toStatus },
        })
      } catch (err: any) {
        console.error('[kanban] moveTask failed:', err)
        await this.fetchTasks()
      }
    },

    /**
     * 设置筛选条件并重新拉取
     */
    async setFilter(filter: { project?: string; assignee?: string; priority?: string }) {
      if (filter.project   !== undefined) this.filter.project   = filter.project
      if (filter.assignee  !== undefined) this.filter.assignee  = filter.assignee
      if (filter.priority  !== undefined) this.filter.priority  = filter.priority
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
        this.backlog.find(t => t.id === taskId)    ||
        this.inProgress.find(t => t.id === taskId) ||
        this.done.find(t => t.id === taskId)
      )
    },
  },
})

// ── 模块内部工具（与 store 逻辑分开，避免循环引用问题） ──────────────────────

function priorityLabel(p: number | string): string {
  if (typeof p === 'string' && p.startsWith('P')) return p
  const n = typeof p === 'number' ? p : parseInt(p as string, 10)
  if (n <= 1) return 'P0'
  if (n === 2) return 'P1'
  return 'P2'
}
