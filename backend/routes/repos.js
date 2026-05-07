/**
 * Git 仓库状态路由
 *
 * GET /api/repos        — 返回所有仓库列表（从内存缓存读取，零等待）
 * GET /api/repos/:id    — 返回单个仓库详情
 */

const express = require('express')
const gitRepo = require('../services/gitRepo')

const router = express.Router()

// ── GET /api/repos ───────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const repos = gitRepo.getRepos()
  res.json({
    repos,
    total: repos.length,
    updatedAt: gitRepo.getLastSyncAt(),
  })
})

// ── GET /api/repos/:id ───────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
  const repo = gitRepo.getRepoById(req.params.id)
  if (!repo) {
    return res.status(404).json({ error: '仓库不存在' })
  }
  res.json({ repo })
})

module.exports = router