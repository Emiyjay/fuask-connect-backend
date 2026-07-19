const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ciphertext: { type: String, required: true },
  nonce: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, { timestamps: true })

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 })

module.exports = mongoose.model('Message', messageSchema)