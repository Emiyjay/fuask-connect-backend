const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true }
}, { timestamps: true })

commentSchema.index({ postId: 1, createdAt: 1 })

module.exports = mongoose.model('Comment', commentSchema)
