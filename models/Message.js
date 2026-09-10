const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // ciphertext is encrypted for the receiver; senderCiphertext lets the sender
  // decrypt their own history without giving the server plaintext.
  ciphertext: { type: String, required: true },
  nonce: { type: String, required: true },
  senderCiphertext: { type: String, default: null },
  senderNonce: { type: String, default: null },
  isRead: { type: Boolean, default: false }
}, { timestamps: true })

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 })
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 })

module.exports = mongoose.model('Message', messageSchema)
