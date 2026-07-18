const mongoose = require('mongoose')

const groupMembershipSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['member', 'admin', 'oversight'],
    default: 'member'
  }
}, { timestamps: true })

groupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true })

module.exports = mongoose.model('GroupMembership', groupMembershipSchema)
