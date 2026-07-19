const mongoose = require('mongoose')

const timetableDocumentSchema = new mongoose.Schema({
  deptCode: { type: String, required: true },
  facultyCode: { type: String, required: true },
  level: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true })

// one current document per department + level — new uploads replace, not stack up
timetableDocumentSchema.index({ deptCode: 1, level: 1 }, { unique: true })

module.exports = mongoose.model('TimetableDocument', timetableDocumentSchema)
