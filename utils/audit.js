const AuditLog = require('../models/AuditLog')

async function recordAudit({ actor, action, targetType, targetId = null, metadata = {}, ipAddress = null }) {
  try {
    await AuditLog.create({ actor, action, targetType, targetId, metadata, ipAddress })
  } catch (error) {
    console.error('AUDIT_LOG_ERROR', error)
  }
}

module.exports = { recordAudit }
