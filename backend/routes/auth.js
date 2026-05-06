/**
 * 认证路由
 */

const express = require('express')
const router = express.Router()
const config = require('../config')

// ── 登录 ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { key: string }
 * 返回: { success, token, message }
 */
router.post('/login', (req, res) => {
  const { key } = req.body || {}

  if (!key) {
    return res.status(400).json({ success: false, message: '密钥不能为空' })
  }

  if (key !== config.auth.dashboardKey) {
    return res.status(401).json({ success: false, message: '密钥错误' })
  }

  // 简单 token（后续可升级为 JWT）
  const token = Buffer.from(`${key}:${Date.now()}`).toString('base64')

  res.json({
    success: true,
    token,
    message: '登录成功',
  })
})

// ── Token 验证 ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/verify
 * Header: Authorization: Bearer <token>
 * 返回: { valid: boolean }
 */
router.post('/verify', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return res.json({ valid: false })
  }

  // 简单验证：token Base64 解码后第一个冒号前的值等于配置的 key
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const storedKey = decoded.split(':')[0]
    res.json({ valid: storedKey === config.auth.dashboardKey })
  } catch {
    res.json({ valid: false })
  }
})

module.exports = router
