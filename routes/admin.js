const express = require('express')
const router = express.Router()

const User = require('../models/User')
const Business = require('../models/Business')
const Timetable = require('../models/Timetable')
const Announcement = require('../models/Announcement')
const { protect } = require('../middleware/auth')
const { syncStaffGroups } = require('../utils/groupSync')
const { recordAudit } = require('../utils/audit')


function canManageStatus(req, res, next) {
  if (!['hod', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to perform this action' })
  }
  next()
}

function onlySuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: 'Only super_admin can promote roles' })
  }
  next()
}

router.get('/audit', protect, async (req, res) => {
  try {
    if (!['hod', 'dpr', 'dean', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to view audit logs' })
    }
    const AuditLog = require('../models/AuditLog')
    const filter = req.user.role === 'hod' ? { 'metadata.deptCode': req.user.deptCode } : {}
    const logs = await AuditLog.find(filter)
      .populate('actor', 'displayName role department')
      .sort({ createdAt: -1 })
      .limit(100)
    res.json({ success: true, data: logs })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load audit logs' })
  }
})

router.get('/overview', protect, async (req, res) => {
  try {
    if (!['hod', 'dpr', 'dean', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized to view administrative statistics' })
    }

    const base = req.user.role === 'hod' ? { deptCode: req.user.deptCode } : {}
    const [users, activeUsers, businesses, pendingBusinesses, timetableEntries, announcements] = await Promise.all([
      User.countDocuments({ ...base }),
      User.countDocuments({ ...base, accountStatus: 'active' }),
      Business.countDocuments(),
      Business.countDocuments({ status: 'pending' }),
      Timetable.countDocuments(base),
      Announcement.countDocuments(req.user.role === 'hod' ? { deptCode: req.user.deptCode } : {})
    ])

    res.json({
      success: true,
      data: {
        users,
        activeUsers,
        businesses,
        pendingBusinesses,
        timetableEntries,
        announcements
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load administrative overview' })
  }
})

router.patch('/users/:id/status', protect, canManageStatus, async (req, res) => {
  try {
    const { accountStatus } = req.body
    const allowedStatuses = ['active', 'withdrawn', 'expelled', 'suspended']

    if (!allowedStatuses.includes(accountStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' })
    }

    const targetUser = await User.findById(req.params.id)
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    if (req.user.role === 'hod' && targetUser.deptCode !== req.user.deptCode) {
      return res.status(403).json({ success: false, error: 'You can only manage students in your own department' })
    }

    targetUser.accountStatus = accountStatus
    targetUser.tokenVersion += 1
    await targetUser.save()

    await recordAudit({ actor: req.user._id, action: 'user.status.updated', targetType: 'User', targetId: targetUser._id, metadata: { accountStatus, deptCode: targetUser.deptCode } })

    res.status(200).json({
      success: true,
      message: `Status updated to "${accountStatus}"`,
      data: { id: targetUser._id, displayName: targetUser.displayName, accountStatus: targetUser.accountStatus }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to update status' })
  }
})

// SECURITY: this is the ONLY way a staff account can gain hod/dean/dpr/sug/super_admin authority
router.patch('/users/:id/promote', protect, onlySuperAdmin, async (req, res) => {
  try {
    const { role } = req.body
    const allowedRoles = ['lecturer', 'hod', 'dean', 'sug', 'dpr', 'super_admin']

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' })
    }

    const targetUser = await User.findById(req.params.id)
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    if (targetUser.role === 'student') {
      return res.status(400).json({ success: false, error: 'Students cannot be promoted directly � they must register as staff first' })
    }

    targetUser.role = role
    targetUser.tokenVersion += 1
    await targetUser.save()

    await syncStaffGroups(targetUser)

    await recordAudit({ actor: req.user._id, action: 'user.role.updated', targetType: 'User', targetId: targetUser._id, metadata: { role, deptCode: targetUser.deptCode } })

    res.status(200).json({
      success: true,
      message: `${targetUser.displayName} is now ${role}`,
      data: { id: targetUser._id, displayName: targetUser.displayName, role: targetUser.role }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to promote user' })
  }
})

module.exports = router
