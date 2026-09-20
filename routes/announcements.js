const express = require('express')
const router = express.Router()

const Announcement = require('../models/Announcement')
const { recordAudit } = require('../utils/audit')
const { protect } = require('../middleware/auth')

const STAFF_ROLES = ['hod', 'dean', 'dpr', 'super_admin']

function canPublish(req, res, next) {
  if (!STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to publish announcements' })
  }
  next()
}

function audienceFilter(user) {
  const now = new Date()
  return {
    published: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } }
    ],
    $and: [{
      $or: [
        { audience: 'all' },
        { audience: 'faculty', facultyCode: user.facultyCode },
        { audience: 'department', deptCode: user.deptCode },
        { audience: 'level', deptCode: user.deptCode, level: String(user.level || '') }
      ]
    }]
  }
}

router.get('/', protect, async (req, res) => {
  try {
    const announcements = await Announcement.find(audienceFilter(req.user))
      .populate('createdBy', 'displayName role')
      .sort({ createdAt: -1 })
      .limit(30)

    res.json({ success: true, data: announcements })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load announcements' })
  }
})

router.get('/manage', protect, canPublish, async (req, res) => {
  try {
    const filter = req.user.role === 'hod'
      ? { deptCode: req.user.deptCode }
      : {}

    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'displayName role')
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({ success: true, data: announcements })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load announcement management data' })
  }
})

router.post('/', protect, canPublish, async (req, res) => {
  try {
    const { title, body, audience = 'all', facultyCode, deptCode, level, expiresAt } = req.body

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required' })
    }

    if (!['all', 'faculty', 'department', 'level'].includes(audience)) {
      return res.status(400).json({ success: false, error: 'Invalid audience' })
    }

    const targetDept = audience === 'department' || audience === 'level'
      ? (req.user.role === 'hod' ? req.user.deptCode : deptCode)
      : null

    if ((audience === 'department' || audience === 'level') && !targetDept) {
      return res.status(400).json({ success: false, error: 'deptCode is required for this audience' })
    }

    if (req.user.role === 'hod' && targetDept !== req.user.deptCode) {
      return res.status(403).json({ success: false, error: 'HOD announcements are limited to their department' })
    }

    const parsedExpiry = expiresAt ? new Date(expiresAt) : null
    if (parsedExpiry && Number.isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid expiry date' })
    }

    const announcement = await Announcement.create({
      title,
      body,
      audience,
      facultyCode: audience === 'faculty' ? facultyCode : null,
      deptCode: targetDept,
      level: audience === 'level' ? String(level || '') : null,
      expiresAt: parsedExpiry,
      createdBy: req.user._id
    })

    await recordAudit({ actor: req.user._id, action: 'announcement.created', targetType: 'Announcement', targetId: announcement._id, metadata: { audience, deptCode: announcement.deptCode, facultyCode: announcement.facultyCode } })

    res.status(201).json({ success: true, data: announcement })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to publish announcement' })
  }
})

router.delete('/:id', protect, canPublish, async (req, res) => {
  try {
    const filter = { _id: req.params.id }
    if (req.user.role === 'hod') filter.deptCode = req.user.deptCode

    const deleted = await Announcement.findOneAndDelete(filter)
    if (!deleted) return res.status(404).json({ success: false, error: 'Announcement not found' })

    await recordAudit({ actor: req.user._id, action: 'announcement.deleted', targetType: 'Announcement', targetId: deleted._id, metadata: { deptCode: deleted.deptCode } })

    res.json({ success: true, message: 'Announcement removed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to remove announcement' })
  }
})

module.exports = router
