const mongoose = require('mongoose')

const timetableSchema = new mongoose.Schema({
  deptCode: { type: String, required: true },
  facultyCode: { type: String, required: true },
  level: { type: String, required: true }, // e.g. "100L" — matches computed level, not stored per-student
  courseCode: { type: String, required: true, trim: true, uppercase: true },
  courseTitle: { type: String, required: true, trim: true },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  startTime: { type: String, required: true }, // "09:00" 24hr format
  endTime: { type: String, required: true },
  venue: { type: String, required: true, trim: true },
  lecturerName: { type: String, default: '', trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true })

timetableSchema.index({ deptCode: 1, level: 1, dayOfWeek: 1 })

module.exports = mongoose.model('Timetable', timetableSchema)
