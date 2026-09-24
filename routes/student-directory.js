const express = require('express')
const router = express.Router()

const User = require('../models/User')
const { getEnrollmentYearForLevel } = require('../utils/academicSession')
const { protect } = require('../middleware/auth')

const STAFF_ROLES = ['hod', 'dean', 'super_admin']

function canViewDirectory(req, res, next) {
  if (!STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to access the student directory' })
  }
  next()
}

function buildScope(user) {
  if (user.role === 'hod') return { deptCode: user.deptCode }
  if (user.role === 'dean') return { facultyCode: user.facultyCode }
  return {}
}

router.get('/:id', protect, canViewDirectory, async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      ...buildScope(req.user)
    }).select('displayName matricNumber department faculty facultyCode deptCode level enrollmentYear programDuration accountStatus isVerified createdAt lastActive')

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in your administrative scope' })
    }

    res.json({
      success: true,
      data: {
        id: student._id,
        displayName: student.displayName,
        matricNumber: student.matricNumber,
        department: student.department,
        faculty: student.faculty,
        facultyCode: student.facultyCode,
        deptCode: student.deptCode,
        level: student.level,
        enrollmentYear: student.enrollmentYear,
        programDuration: student.programDuration,
        accountStatus: student.accountStatus,
        isVerified: student.isVerified,
        createdAt: student.createdAt,
        lastActive: student.lastActive
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load student record' })
  }
})

router.get('/', protect, canViewDirectory, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const status = String(req.query.status || '').trim()
    const level = String(req.query.level || '').trim()

    if (level && !['100', '200', '300', '400', '500', '600'].includes(level)) {
      return res.status(400).json({ success: false, error: 'Invalid level filter' })
    }

    if (q.length > 80) {
      return res.status(400).json({ success: false, error: 'Search query is too long' })
    }

    const filter = {
      ...buildScope(req.user),
      role: 'student'
    }

    if (status) {
      if (!['active', 'withdrawn', 'expelled', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid account status filter' })
      }
      filter.accountStatus = status
    }

    if (level) {
      const enrollmentYear = getEnrollmentYearForLevel(level)
      if (enrollmentYear === null) {
        return res.status(400).json({ success: false, error: 'Invalid level filter' })
      }
      filter.enrollmentYear = enrollmentYear
    }

    if (q.length >= 2) {
      const escaped = q.replace(/[.*+?^\$\{\}()|[\\]\\]/g, '\\$&')
      const pattern = new RegExp(escaped, 'i')
      filter.$or = [
        { displayName: pattern },
        { matricNumber: pattern },
        { department: pattern },
        { deptCode: pattern }
      ]
    }

    const students = await User.find(filter)
      .select('displayName matricNumber department faculty facultyCode deptCode level enrollmentYear accountStatus isVerified createdAt')
      .sort({ displayName: 1 })
      .limit(100)

    const data = students.map(student => ({
      id: student._id,
      displayName: student.displayName,
      matricNumber: student.matricNumber,
      department: student.department,
      faculty: student.faculty,
      deptCode: student.deptCode,
      level: student.level,
      enrollmentYear: student.enrollmentYear,
      accountStatus: student.accountStatus,
      isVerified: student.isVerified,
      createdAt: student.createdAt
    }))

    res.json({ success: true, data, meta: { count: data.length, scope: req.user.role } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load student directory' })
  }
})

module.exports = router
