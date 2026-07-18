const mongoose = require('mongoose')

const materialSchema = new mongoose.Schema({
  uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  courseCode: { type: String, default: null, uppercase: true, trim: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, default: null },
  department: { type: String, default: null },
  isPrivate: { type: Boolean, default: true }
}, { timestamps: true })

module.exports = mongoose.model('Material', materialSchema)
