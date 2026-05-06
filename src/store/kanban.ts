import { defineStore } from 'pinia'

export interface TaskItem {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2'
  project: string
  assignee: string
  status: 'backlog' | 'in_progress' | 'done'
  phase?: string
}

interface KanbanState {
  columns: {
    backlog: TaskItem[]
    inProgress: TaskItem[]
    done: TaskItem[]
  }
  filter: {
    project: string
    assignee: string
  }
}

export const useKanbanStore = defineStore('kanban', {
  state: (): KanbanState => ({
    columns: {
      backlog: [
        { id: 'TSK-001', title: '用户权限系统重构', priority: 'P0', project: 'hermes多功能看板', assignee: '思月', status: 'backlog', phase: 'M2' },
        { id: 'TSK-002', title: 'LiteLLM 数据接入', priority: 'P1', project: 'hermes多功能看板', assignee: '如音', status: 'backlog', phase: 'M2' },
        { id: 'TSK-003', title: '微信小程序适配', priority: 'P2', project: 'hermes多功能看板', assignee: '紫灵', status: 'backlog', phase: 'M1.3' },
        { id: 'TSK-004', title: '通知推送模块', priority: 'P1', project: 'hermes多功能看板', assignee: '思月', status: 'backlog', phase: 'M3' },
      ],
      inProgress: [
        { id: 'TSK-005', title: '纯前端环境部署', priority: 'P1', project: 'hermes多功能看板', assignee: '如音', status: 'in_progress', phase: 'M1.3' },
      ],
      done: [
        { id: 'TSK-006', title: 'UI 选型与原型设计', priority: 'P0', project: 'hermes多功能看板', assignee: '紫灵', status: 'done', phase: 'M1.1' },
        { id: 'TSK-007', title: '技术方案评审', priority: 'P1', project: 'hermes多功能看板', assignee: '如音', status: 'done', phase: 'M1.2' },
      ],
    },
    filter: {
      project: '',
      assignee: '',
    },
  }),
  actions: {
    moveTask(taskId: string, toStatus: 'backlog' | 'in_progress' | 'done') {
      const task = this.findTask(taskId)
      if (!task) return

      // Remove from current column
      for (const col of ['backlog', 'inProgress', 'done'] as const) {
        this.columns[col] = this.columns[col].filter(t => t.id !== taskId)
      }

      // Add to target column
      const targetKey = toStatus === 'backlog' ? 'backlog' : toStatus === 'in_progress' ? 'inProgress' : 'done'
      task.status = toStatus
      this.columns[targetKey].unshift(task)
    },
    findTask(taskId: string): TaskItem | undefined {
      for (const col of ['backlog', 'inProgress', 'done'] as const) {
        const found = this.columns[col].find(t => t.id === taskId)
        if (found) return found
      }
      return undefined
    },
    setFilter(project: string, assignee: string) {
      this.filter.project = project
      this.filter.assignee = assignee
    },
  },
})