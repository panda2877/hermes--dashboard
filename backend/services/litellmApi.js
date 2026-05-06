/**
 * LiteLLM HTTP API 代理服务
 * 用于 /spend/logs 等需要直调 LiteLLM 的接口
 */

const config = require('../config')

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

module.exports = {
  litellmRequest,
  getSpendLogs,
  getModelList,
}
