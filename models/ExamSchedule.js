const mongoose = require('mongoose')

const examScheduleSchema = new mongoose.Schema({
  deptCode: { type: String, required: true },
  facultyCode: { type: String, required: true },
  level: { type: String, required: true },
  courseCode: { type: String, required: true, trim: true, uppercase: true },
  courseTitle: { type: String, required: true, trim: true },
  examDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  venue: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true })

examScheduleSchema.index({ deptCode: 1, level: 1, examDate: 1 })

module.exports = mongoose.model('ExamSchedule', examScheduleSchema)
