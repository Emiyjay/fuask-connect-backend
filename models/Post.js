const mongoose = require('mongoose')

const postSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  media: [{
    url: { type: String, required: true },
    type: { type: String, default: null }
  }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPinned: { type: Boolean, default: false }
}, { timestamps: true })

postSchema.index({ groupId: 1, isPinned: -1, createdAt: -1 })

module.exports = mongoose.model('Post', postSchema)
