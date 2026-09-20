const mongoose = require('mongoose')

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  audience: {
    type: String,
    enum: ['all', 'faculty', 'department', 'level'],
    default: 'all'
  },
  facultyCode: { type: String, default: null, trim: true },
  deptCode: { type: String, default: null, trim: true },
  level: { type: String, default: null, trim: true },
  published: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true })

announcementSchema.index({ published: 1, createdAt: -1 })
announcementSchema.index({ audience: 1, facultyCode: 1, deptCode: 1, level: 1 })

module.exports = mongoose.model('Announcement', announcementSchema)
