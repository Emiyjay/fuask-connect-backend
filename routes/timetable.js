const express = require('express')
const router = express.Router()

const Timetable = require('../models/Timetable')
const ExamSchedule = require('../models/ExamSchedule')
const TimetableDocument = require('../models/TimetableDocument')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { uploadField } = require('../middleware/upload')
const { sendPushToMany } = require('../utils/sendPush')
const { getEnrollmentYearForLevel } = require('../utils/academicSession')
const { getDepartmentByCode, isValidDepartmentFacultyPair } = require('../utils/validateMatric')
const mongoose = require('mongoose')

function isOwnDeptHOD(req, res, next) {
  if (req.user.role !== 'hod') {
    return res.status(403).json({ success: false, error: 'Only an HOD can manage the timetable' })
  }
  if (req.body.deptCode && req.body.deptCode !== req.user.deptCode) {
    return res.status(403).json({ success: false, error: 'You can only manage your own department\'s timetable' })
  }
  next()
}

function canViewDepartment(req, deptCode) {
  const department = getDepartmentByCode(deptCode)
  if (!department) return false
  if (['super_admin', 'dpr'].includes(req.user.role)) return true
  if (req.user.role === 'hod') return req.user.deptCode === department.deptCode
  if (req.user.role === 'dean') return req.user.facultyCode === department.facultyCode
  if (req.user.role === 'student') return req.user.deptCode === department.deptCode
  return false
}

function getExamUrgency(examDate) {
  const now = new Date()
  const diffDays = Math.ceil((new Date(examDate) - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'past'
  if (diffDays <= 1) return 'red'
  if (diffDays <= 7) return 'yellow'
  return 'green'
}

async function notifyLevelStudents(deptCode, level, title, body) {
  const targetEnrollmentYear = getEnrollmentYearForLevel(level)
  if (!targetEnrollmentYear) return
  const students = await User.find({ deptCode, enrollmentYear: targetEnrollmentYear, role: 'student' }).select('fcmToken')
  sendPushToMany(students.map(s => s.fcmToken), title, body)
}

router.get('/mine', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(400).json({ success: false, error: 'This endpoint is for students. Staff should use /timetable/department/:deptCode' })
    }
    if (!req.user.level) {
      return res.status(400).json({ success: false, error: 'Unable to determine your current level' })
    }

    const classes = await Timetable.find({ deptCode: req.user.deptCode, level: req.user.level })
      .sort({ dayOfWeek: 1, startTime: 1 })

    res.status(200).json({ success: true, count: classes.length, data: classes })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch timetable' })
  }
})

router.get('/department/:deptCode', protect, async (req, res) => {
  try {
    if (!canViewDepartment(req, req.params.deptCode)) {
      return res.status(403).json({ success: false, error: 'You are not authorized to view this department timetable' })
    }
    const department = getDepartmentByCode(req.params.deptCode)
    const classes = await Timetable.find({ deptCode: department.deptCode })
      .sort({ level: 1, dayOfWeek: 1, startTime: 1 })

    res.status(200).json({ success: true, count: classes.length, data: classes })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch department timetable' })
  }
})

router.post('/', protect, isOwnDeptHOD, async (req, res) => {
  try {
    const { deptCode, facultyCode, level, courseCode, courseTitle, dayOfWeek, startTime, endTime, venue, lecturerName } = req.body

    if (!deptCode || !facultyCode || !level || !courseCode || !courseTitle || !dayOfWeek || !startTime || !endTime || !venue) {
      return res.status(400).json({ success: false, error: 'All timetable fields except lecturerName are required' })
    }

    const department = getDepartmentByCode(deptCode)
    if (!department) {
      return res.status(400).json({ success: false, error: 'Unknown department code' })
    }
    if (!isValidDepartmentFacultyPair(department.deptCode, facultyCode)) {
      return res.status(400).json({ success: false, error: 'Department and faculty code do not match' })
    }

    const entry = await Timetable.create({
      deptCode: department.deptCode,
      facultyCode: department.facultyCode,
      level, courseCode, courseTitle, dayOfWeek, startTime, endTime, venue,
      lecturerName: lecturerName || '',
      createdBy: req.user._id
    })

    notifyLevelStudents(department.deptCode, level, 'Timetable updated', `${courseCode} added — ${dayOfWeek} ${startTime}, ${venue}`)

    res.status(201).json({ success: true, message: 'Class added to timetable', data: entry })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to add class' })
  }
})

router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid timetable ID' })
    }

    const entry = await Timetable.findById(req.params.id)
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Timetable entry not found' })
    }
    if (req.user.role !== 'hod' || entry.deptCode !== req.user.deptCode) {
      return res.status(403).json({ success: false, error: 'You can only remove classes from your own department' })
    }

    await Timetable.deleteOne({ _id: entry._id })
    res.status(200).json({ success: true, message: 'Class removed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to remove class' })
  }
})

router.post('/document', protect, ...uploadField('file', 'fuask-connect/timetables'), async (req, res) => {
  try {
    if (req.user.role !== 'hod') {
      return res.status(403).json({ success: false, error: 'Only an HOD can upload the official timetable document' })
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded' })
    }
    const { level } = req.body
    if (!level) {
      return res.status(400).json({ success: false, error: 'level is required (e.g. "100L")' })
    }

    const doc = await TimetableDocument.findOneAndUpdate(
      { deptCode: req.user.deptCode, level },
      {
        deptCode: req.user.deptCode,
        facultyCode: req.user.facultyCode,
        level,
        fileUrl: req.file.path,
        uploadedBy: req.user._id
      },
      { upsert: true, new: true }
    )

    res.status(200).json({ success: true, message: 'Official timetable document updated', data: doc })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to upload document' })
  }
})

router.get('/document/mine', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(400).json({ success: false, error: 'This endpoint is for students' })
    }
    if (!req.user.level) {
      return res.status(400).json({ success: false, error: 'Unable to determine your current level' })
    }

    const doc = await TimetableDocument.findOne({ deptCode: req.user.deptCode, level: req.user.level })
    if (!doc) {
      return res.status(404).json({ success: false, error: 'No official timetable document has been uploaded yet for your department and level' })
    }

    res.status(200).json({ success: true, data: doc })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch document' })
  }
})

router.get('/exams/mine', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(400).json({ success: false, error: 'This endpoint is for students' })
    }
    if (!req.user.level) {
      return res.status(400).json({ success: false, error: 'Unable to determine your current level' })
    }

    const exams = await ExamSchedule.find({ deptCode: req.user.deptCode, level: req.user.level })
      .sort({ examDate: 1 })

    const data = exams.map(e => ({
      id: e._id,
      courseCode: e.courseCode,
      courseTitle: e.courseTitle,
      examDate: e.examDate,
      startTime: e.startTime,
      endTime: e.endTime,
      venue: e.venue,
      urgency: getExamUrgency(e.examDate)
    }))

    res.status(200).json({ success: true, count: data.length, data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch exam schedule' })
  }
})

router.post('/exams', protect, isOwnDeptHOD, async (req, res) => {
  try {
    const { deptCode, facultyCode, level, courseCode, courseTitle, examDate, startTime, endTime, venue } = req.body

    if (!deptCode || !facultyCode || !level || !courseCode || !courseTitle || !examDate || !startTime || !endTime || !venue) {
      return res.status(400).json({ success: false, error: 'All exam schedule fields are required' })
    }

    const department = getDepartmentByCode(deptCode)
    if (!department) {
      return res.status(400).json({ success: false, error: 'Unknown department code' })
    }
    if (!isValidDepartmentFacultyPair(department.deptCode, facultyCode)) {
      return res.status(400).json({ success: false, error: 'Department and faculty code do not match' })
    }

    const exam = await ExamSchedule.create({
      deptCode: department.deptCode,
      facultyCode: department.facultyCode,
      level, courseCode, courseTitle,
      examDate: new Date(examDate), startTime, endTime, venue,
      createdBy: req.user._id
    })

    notifyLevelStudents(department.deptCode, level, 'New exam scheduled', `${courseCode} exam on ${new Date(examDate).toDateString()}`)

    res.status(201).json({ success: true, message: 'Exam scheduled', data: exam })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to schedule exam' })
  }
})

router.delete('/exams/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid exam ID' })
    }

    const exam = await ExamSchedule.findById(req.params.id)
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' })
    }
    if (req.user.role !== 'hod' || exam.deptCode !== req.user.deptCode) {
      return res.status(403).json({ success: false, error: 'You can only remove exams from your own department' })
    }

    await ExamSchedule.deleteOne({ _id: exam._id })
    res.status(200).json({ success: true, message: 'Exam removed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to remove exam' })
  }
})

module.exports = router
