import { Router } from 'express'
import { sql } from '../../db'

const router = Router()

// GET /api/admin/analytics/overview - Dashboard stats
router.get('/overview', async (req, res) => {
  try {
    const [users, campaigns, emails, contacts] = await Promise.all([
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM users`,
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM campaigns`,
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM send_logs`,
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM contacts`
    ])

    // Recent signups (last 7 days)
    const recentSignups = await sql<{date: string, count: string}[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM users 
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    res.json({
      totalUsers: parseInt(users[0].count),
      totalCampaigns: parseInt(campaigns[0].count),
      totalEmailsSent: parseInt(emails[0].count),
      totalContacts: parseInt(contacts[0].count),
      recentSignups: recentSignups.map(r => ({ date: r.date, count: parseInt(r.count) }))
    })
  } catch (error) {
    console.error('Analytics overview error:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// GET /api/admin/analytics/users - User metrics over time
router.get('/users', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365)

    const signups = await sql<{date: string, count: string}[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM users 
      WHERE created_at > NOW() - INTERVAL '1 day' * ${days}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `

    // Active users (users who sent at least one campaign in period)
    const activeUsers = await sql<{count: string}[]>`
      SELECT COUNT(DISTINCT c.user_id) as count 
      FROM campaigns c
      WHERE c.created_at > NOW() - INTERVAL '1 day' * ${days}
    `

    res.json({
      signups: signups.map(r => ({ date: r.date, count: parseInt(r.count) })),
      activeUsers: parseInt(activeUsers[0].count)
    })
  } catch (error) {
    console.error('User analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch user analytics' })
  }
})

// GET /api/admin/analytics/emails - Email metrics
router.get('/emails', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365)

    const emailsByDay = await sql<{date: string, count: string}[]>`
      SELECT DATE(sl.sent_at) as date, COUNT(*) as count 
      FROM send_logs sl
      WHERE sl.sent_at > NOW() - INTERVAL '1 day' * ${days}
      GROUP BY DATE(sl.sent_at)
      ORDER BY date ASC
    `

    const statusCounts = await sql<{status: string, count: string}[]>`
      SELECT status, COUNT(*) as count 
      FROM send_logs 
      WHERE sent_at > NOW() - INTERVAL '1 day' * ${days}
      GROUP BY status
    `

    // Bounce count
    const bounces = await sql<{count: string}[]>`
      SELECT COUNT(*) as count FROM bounces 
      WHERE created_at > NOW() - INTERVAL '1 day' * ${days}
    `

    res.json({
      emailsByDay: emailsByDay.map(r => ({ date: r.date, count: parseInt(r.count) })),
      statusBreakdown: statusCounts.reduce((acc, r) => {
        acc[r.status] = parseInt(r.count)
        return acc
      }, {} as Record<string, number>),
      bounces: parseInt(bounces[0].count)
    })
  } catch (error) {
    console.error('Email analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch email analytics' })
  }
})

// GET /api/admin/analytics/storage - Storage metrics
router.get('/storage', async (req, res) => {
  try {
    // Media storage by user
    const mediaByUser = await sql<{user_id: string, name: string, total_size: string}[]>`
      SELECT u.id as user_id, u.name, COALESCE(SUM(m.size_bytes), 0) as total_size
      FROM users u
      LEFT JOIN media m ON m.user_id = u.id AND m.deleted_at IS NULL
      GROUP BY u.id, u.name
      ORDER BY total_size DESC
      LIMIT 10
    `

    // Attachments storage
    const attachmentsSize = await sql<{total_size: string}[]>`
      SELECT COALESCE(SUM(size_bytes), 0) as total_size FROM attachments
    `

    // Total media
    const mediaSize = await sql<{total_size: string}[]>`
      SELECT COALESCE(SUM(size_bytes), 0) as total_size FROM media WHERE deleted_at IS NULL
    `

    res.json({
      topUsersByStorage: mediaByUser.map(r => ({
        userId: r.user_id,
        name: r.name,
        bytes: parseInt(r.total_size)
      })),
      totalMediaBytes: parseInt(mediaSize[0].total_size),
      totalAttachmentsBytes: parseInt(attachmentsSize[0].total_size)
    })
  } catch (error) {
    console.error('Storage analytics error:', error)
    res.status(500).json({ error: 'Failed to fetch storage analytics' })
  }
})

export default router
