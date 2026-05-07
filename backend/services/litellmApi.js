/**
 * LiteLLM HTTP API 代理服务
 * 用于 /spend/logs 等需要直调 LiteLLM 的接口
 */

const fs = require('fs')
const path = require('path')
const config = require('../config')

// ── 模型健康状态持久化缓存（后台每2分钟同步一次）───────────────────────────────

const HEALTH_CACHE_FILE = path.join(__dirname, '..', 'data', 'model-health.json')

let modelHealthStatus = {}      // { [model_group]: 'healthy' | 'unhealthy' }
let healthSyncTime = 0         // 上次同步时间戳
const SYNC_INTERVAL_MS = 120_000 // 2 分钟

// 确保 data 目录存在
function ensureDataDir() {
  const dir = path.dirname(HEALTH_CACHE_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// 从文件加载缓存（启动时 + 读取时兜底）
function loadHealthFromFile() {
  try {
    if (fs.existsSync(HEALTH_CACHE_FILE)) {
      const raw = fs.readFileSync(HEALTH_CACHE_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      return parsed.status || {}
    }
  } catch (e) {
    console.warn('[litellmApi] Failed to load health cache file:', e.message)
  }
  return {}
}

// 写入文件（同步到磁盘）
function saveHealthToFile(status) {
  try {
    ensureDataDir()
    fs.writeFileSync(HEALTH_CACHE_FILE, JSON.stringify({
      status,
      updatedAt: new Date().toISOString(),
    }, null, 2))
  } catch (e) {
    console.warn('[litellmApi] Failed to save health cache file:', e.message)
  }
}

// 真正从 LiteLLM 拉取健康状态
async function fetchModelHealthFromLiteLLM() {
  const [healthRes, modelInfoRes] = await Promise.all([
    litellmRequest('/health'),
    litellmRequest('/model/info'),
  ])

  // Build model_id → model_name lookup from /model/info
  const modelIdToName = {}
  for (const m of modelInfoRes.data || []) {
    const id = m.model_info?.id
    if (id) modelIdToName[id] = m.model_name
  }

  // Build status map from /health
  const statusMap = {}
  for (const ep of healthRes.healthy_endpoints || []) {
    const name = modelIdToName[ep.model_id]
    if (name) statusMap[name] = 'healthy'
  }
  for (const ep of healthRes.unhealthy_endpoints || []) {
    const name = modelIdToName[ep.model_id]
    if (name) statusMap[name] = 'unhealthy'
  }

  return statusMap
}

// 启动后台同步任务（BFF 启动后自动运行）
async function startHealthSync() {
  // 1. 启动时立即同步一次（从文件兜底或拉取）
  const initial = loadHealthFromFile()
  if (Object.keys(initial).length > 0) {
    modelHealthStatus = initial
    console.log(`[litellmApi] Loaded health from cache (${Object.keys(modelHealthStatus).length} models)`)
  }

  // 2. 立即拉取一次最新状态
  try {
    modelHealthStatus = await fetchModelHealthFromLiteLLM()
    saveHealthToFile(modelHealthStatus)
    healthSyncTime = Date.now()
    console.log(`[litellmApi] Initial health sync done (${Object.keys(modelHealthStatus).length} models)`)
  } catch (err) {
    console.warn('[litellmApi] Initial health sync failed:', err.message)
  }

  // 3. 每 2 分钟后台同步
  setInterval(async () => {
    try {
      const latest = await fetchModelHealthFromLiteLLM()
      modelHealthStatus = latest
      saveHealthToFile(modelHealthStatus)
      healthSyncTime = Date.now()
      console.log(`[litellmApi] Background health sync OK (${Object.keys(modelHealthStatus).length} models)`)
    } catch (err) {
      console.warn('[litellmApi] Background health sync failed:', err.message)
    }
  }, SYNC_INTERVAL_MS)
}

/**
 * 发起授权请求到 LiteLLM
 * @param {string} path    - /spend/logs 等路径
 * @param {object} params  - query 参数
 */
async function litellmRequest(path, params = {}) {
  const url = new URL(`${config.litellm.apiUrl}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.litellm.apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LiteLLM API error ${res.status}: ${text}`)
  }

  return res.json()
}

/**
 * 获取调用日志明细
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @param {number} limit     - 每页数量
 * @param {number} offset    - 偏移
 */
async function getSpendLogs(startDate, endDate, limit = 500, offset = 0) {
  return litellmRequest('/spend/logs', {
    start_date: startDate,
    end_date: endDate,
    limit,
    offset,
  })
}

/**
 * 获取模型列表（从 LiteLLM config 读取）
 */
async function getModelList() {
  return litellmRequest('/model/info')
}

/**
 * 获取模型健康状态（直接从内存读取，零等待）
 * @returns {Object} { [model_group]: 'healthy' | 'unhealthy' }
 */
function getModelHealth() {
  return modelHealthStatus
}

module.exports = {
  litellmRequest,
  getSpendLogs,
  getModelList,
  getModelHealth,
  startHealthSync,
}
