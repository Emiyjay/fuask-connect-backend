const mongoose = require('mongoose')

const groupSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['school', 'faculty', 'department', 'cohort', 'sug', 'club', 'assignment', 'study', 'course'],
    Required: true
  },
  name: { type: String, required: true, trim: true },
  facultyCode: { type: String, default: null },
  deptCode: { type: String, default: null },
  enrollmentYear: { type: Number, default: null },
  courseCode: { type: String, default: null },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  parentGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  description: { type: String, default: '' },
  isPublic: { type: Boolean, default: false }
}, { timestamps: true })

groupSchema.index(
  { deptCode: 1, enrollmentYear: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'cohort' } }
)

module.exports = mongoose.model('Group', groupSchema)

