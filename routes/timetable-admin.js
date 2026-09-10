const express = require('express')
const router = express.Router()

const Timetable = require('../models/Timetable')
const ExamSchedule = require('../models/ExamSchedule')
const TimetableDocument = require('../models/TimetableDocument')
const { protect } = require('../middleware/auth')
const { uploadField } = require('../middleware/upload')

function requireHOD(req, res, next) {
  if (req.user.role !== 'hod') {
    return res.status(403).json({ success: false, error: 'Only an HOD can manage timetable publishing' })
  }
  next()
}

function ownDepartment(req, deptCode) {
  return deptCode === req.user.deptCode
}

function validTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

router.use(protect, requireHOD)

router.get('/overview', async (req, res) => {
  try {
    const [classes, exams, documents] = await Promise.all([
      Timetable.find({ deptCode: req.user.deptCode }).sort({ level: 1, dayOfWeek: 1, startTime: 1 }),
      ExamSchedule.find({ deptCode: req.user.deptCode }).sort({ examDate: 1, startTime: 1 }),
      TimetableDocument.find({ deptCode: req.user.deptCode }).sort({ updatedAt: -1 })
    ])
    res.json({ success: true, data: { classes, exams, documents } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to load timetable management data' })
  }
})

router.post('/classes', async (req, res) => {
  try {
    const { facultyCode, level, courseCode, courseTitle, dayOfWeek, startTime, endTime, venue, lecturerName } = req.body
    if (!facultyCode || !level || !courseCode || !courseTitle || !dayOfWeek || !startTime || !endTime || !venue) {
      return res.status(400).json({ success: false, error: 'All class fields except lecturerName are required' })
    }
    if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) {
      return res.status(400).json({ success: false, error: 'Invalid class time range' })
    }
    const entry = await Timetable.create({
      deptCode: req.user.deptCode,
      facultyCode,
      level,
      courseCode,
      courseTitle,
      dayOfWeek,
      startTime,
      endTime,
      venue,
      lecturerName: lecturerName || '',
      createdBy: req.user._id
    })
    res.status(201).json({ success: true, data: entry })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to add class' })
  }
})

router.patch('/classes/:id', async (req, res) => {
  try {
    const entry = await Timetable.findOne({ _id: req.params.id, deptCode: req.user.deptCode })
    if (!entry) return res.status(404).json({ success: false, error: 'Class not found in your department' })
    const allowed = ['facultyCode', 'level', 'courseCode', 'courseTitle', 'dayOfWeek', 'startTime', 'endTime', 'venue', 'lecturerName']
    for (const key of allowed) if (req.body[key] !== undefined) entry[key] = req.body[key]
    if (!validTime(entry.startTime) || !validTime(entry.endTime) || entry.startTime >= entry.endTime) {
      return res.status(400).json({ success: false, error: 'Invalid class time range' })
    }
    await entry.save()
    res.json({ success: true, data: entry })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to update class' })
  }
})

router.delete('/classes/:id', async (req, res) => {
  try {
    const result = await Timetable.deleteOne({ _id: req.params.id, deptCode: req.user.deptCode })
    if (!result.deletedCount) return res.status(404).json({ success: false, error: 'Class not found in your department' })
    res.json({ success: true, message: 'Class removed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to remove class' })
  }
})

router.post('/exams', async (req, res) => {
  try {
    const { facultyCode, level, courseCode, courseTitle, examDate, startTime, endTime, venue } = req.body
    if (!facultyCode || !level || !courseCode || !courseTitle || !examDate || !startTime || !endTime || !venue) {
      return res.status(400).json({ success: false, error: 'All exam fields are required' })
    }
    if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) {
      return res.status(400).json({ success: false, error: 'Invalid exam time range' })
    }
    const date = new Date(examDate)
    if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, error: 'Invalid exam date' })
    const exam = await ExamSchedule.create({
      deptCode: req.user.deptCode,
      facultyCode,
      level,
      courseCode,
      courseTitle,
      examDate: date,
      startTime,
      endTime,
      venue,
      createdBy: req.user._id
    })
    res.status(201).json({ success: true, data: exam })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to schedule exam' })
  }
})

router.delete('/exams/:id', async (req, res) => {
  try {
    const result = await ExamSchedule.deleteOne({ _id: req.params.id, deptCode: req.user.deptCode })
    if (!result.deletedCount) return res.status(404).json({ success: false, error: 'Exam not found in your department' })
    res.json({ success: true, message: 'Exam removed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to remove exam' })
  }
})

router.post('/document', uploadField('file', 'fuask-connect/timetables'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'A PDF file is required' })
    if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ success: false, error: 'Only PDF timetable documents are allowed' })
    const { level } = req.body
    if (!level) return res.status(400).json({ success: false, error: 'level is required' })
    const doc = await TimetableDocument.findOneAndUpdate(
      { deptCode: req.user.deptCode, level },
      {
        deptCode: req.user.deptCode,
        facultyCode: req.user.facultyCode,
        level,
        fileUrl: req.file.path,
        uploadedBy: req.user._id
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.json({ success: true, data: doc })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to upload timetable document' })
  }
})

module.exports = router
