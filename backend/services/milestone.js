/**
 * 里程碑数据聚合服务
 * 从 kanban.db 的 milestones 表 + tasks.milestone_id 关联查询，按项目+里程碑聚合
 */

const sqlite = require('./sqlite')

// ── 常量 ─────────────────────────────────────────────────────────────────────

const ASSIGNEE_ZH = {
  xingruyin: '辛如音',
  ziling: '紫灵',
  yinyue: '银月',
  siyue: '思月',
}

const PRIORITY_MAP = { 1: 'P0', 2: 'P1', 3: 'P2', 0: 'P0' }

const DONE_STATUSES = new Set(['done', 'completed'])

// ── 主聚合逻辑 ───────────────────────────────────────────────────────────────

/**
 * 获取里程碑聚合数据
 * 使用 milestones 表 + tasks.milestone_id 关联，替代标题正则解析
 * @returns {{ name, total, done, progress, iconBg, iconText, milestones }[]}
 */
function getMilestones() {
  // JOIN milestones 表获取里程碑名称和排序，LEFT JOIN 保留未关联任务
  const rows = sqlite.query(`
    SELECT
      t.id, t.title, t.status, t.priority, t.assignee,
      t.project_name, t.workspace_path,
      t.milestone_id, t.milestone_sort,
      m.name AS milestone_name,
      m.sort_order AS milestone_order
    FROM tasks t
    LEFT JOIN milestones m ON t.milestone_id = m.id
    WHERE t.project_name IS NOT NULL AND t.project_name != ''
    ORDER BY
      COALESCE(m.sort_order, 999),
      COALESCE(t.milestone_sort, 0),
      CASE t.status
        WHEN 'in_progress' THEN 0 WHEN 'in-progress' THEN 0
        WHEN 'backlog' THEN 1
        WHEN 'done' THEN 2 WHEN 'completed' THEN 2
        ELSE 3
      END,
      CASE t.priority WHEN 1 THEN 0 WHEN 2 THEN 1 ELSE 2 END,
      t.created_at DESC
  `)

  // ── Step 1: 按 project_name 分组 ─────────────────────────────────────────
  const projectMap = new Map()

  for (const row of rows) {
    const pn = row.project_name
    if (!projectMap.has(pn)) {
      projectMap.set(pn, { name: pn, tasks: [] })
    }
    projectMap.get(pn).tasks.push({
      ...row,
      status: row.status === 'in-progress' ? 'in_progress' : row.status,
    })
  }

  // ── Step 2: 按 milestone_id 分组 ────────────────────────────────────────
  const projects = []

  for (const [projectName, proj] of projectMap) {
    // 按 milestone_id 分组（NULL 的归入「未分组」）
    const milestoneMap = new Map() // milestone_id → { id, name, tasks[], sort }
    const ungrouped = []

    for (const task of proj.tasks) {
      const msId = task.milestone_id
      if (!msId) {
        ungrouped.push(task)
        continue
      }

      if (!milestoneMap.has(msId)) {
        milestoneMap.set(msId, {
          id: msId,
          name: task.milestone_name || msId,
          sort: task.milestone_order != null ? task.milestone_order : 999,
          tasks: [],
        })
      }
      milestoneMap.get(msId).tasks.push(task)
    }

    // ── Step 3: 构建里程碑数组 ────────────────────────────────────────────
    const milestones = []

    const sorted = Array.from(milestoneMap.values()).sort((a, b) => a.sort - b.sort)

    for (const ms of sorted) {
      const total = ms.tasks.length
      const done = ms.tasks.filter(t => DONE_STATUSES.has(t.status)).length
      const progress = total > 0 ? Math.round((done / total) * 100) : 0

      milestones.push({
        name: ms.name,
        total,
        done,
        progress,
        tasks: ms.tasks.map(t => formatTask(t)),
      })
    }

    // 未分组任务（无 milestone_id 或不在 milestones 表中）
    if (ungrouped.length > 0) {
      const total = ungrouped.length
      const done = ungrouped.filter(t => DONE_STATUSES.has(t.status)).length
      milestones.push({
        name: '未分组',
        total,
        done,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        tasks: ungrouped.map(t => formatTask(t)),
      })
    }

    // ── Step 4: 项目汇总 ────────────────────────────────────────────────────
    const projTotal = proj.tasks.length
    const projDone = proj.tasks.filter(t => DONE_STATUSES.has(t.status)).length

    projects.push({
      name: projectName,
      total: projTotal,
      done: projDone,
      progress: projTotal > 0 ? Math.round((projDone / projTotal) * 100) : 0,
      iconText: projectName.charAt(0).toUpperCase(),
      iconBg: getProjectIconBg(projectName),
      milestones,
    })
  }

  projects.sort((a, b) => b.total - a.total)

  return projects
}

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

function formatTask(t) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: PRIORITY_MAP[t.priority] || `P${t.priority}`,
    assignee: ASSIGNEE_ZH[t.assignee] || t.assignee || '',
    progress: DONE_STATUSES.has(t.status) ? 100 : (t.status === 'in_progress' ? 50 : 0),
  }
}

const PROJECT_ICON_BG = {
  'hermes多功能看板': 'rgba(113,112,255,0.1)',
  'hermes-agent': 'rgba(16,185,129,0.1)',
  '基于任务驱动的看板机制研究': 'rgba(245,158,11,0.1)',
}

function getProjectIconBg(name) {
  return PROJECT_ICON_BG[name] || 'rgba(113,112,255,0.1)'
}

/**
 * 获取单个里程碑详情
 */
function getMilestoneById(id) {
  const ms = sqlite.query(
    'SELECT id, project_name, name, description, assignee, target_date, sort_order FROM milestones WHERE id = ?',
    [id]
  )
  if (!ms[0]) return null

  const tasks = sqlite.query(`
    SELECT id, title, status, priority, assignee
    FROM tasks WHERE milestone_id = ?
    ORDER BY milestone_sort, created_at DESC
  `, [id])

  return {
    ...ms[0],
    total: tasks.length,
    done: tasks.filter(t => DONE_STATUSES.has(t.status)).length,
    progress: tasks.length > 0 ? Math.round((tasks.filter(t => DONE_STATUSES.has(t.status)).length / tasks.length) * 100) : 0,
    tasks: tasks.map(t => formatTask(t)),
  }
}

/**
 * 获取项目列表（含进度统计）
 */
function getProjects() {
  const rows = sqlite.query(`
    SELECT
      project_name,
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('done', 'completed') THEN 1 ELSE 0 END) AS done
    FROM tasks
    WHERE project_name IS NOT NULL AND project_name != ''
    GROUP BY project_name
    ORDER BY total DESC
  `)

  return rows.map(r => ({
    name: r.project_name,
    total: r.total,
    done: r.done,
    progress: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
    iconText: r.project_name.charAt(0).toUpperCase(),
    iconBg: getProjectIconBg(r.project_name),
  }))
}

module.exports = { getMilestones, getMilestoneById, getProjects }