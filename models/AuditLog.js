const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  targetType: { type: String, required: true, trim: true, maxlength: 40 },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: null, maxlength: 64 }
}, { timestamps: true })

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ actor: 1, createdAt: -1 })
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)
