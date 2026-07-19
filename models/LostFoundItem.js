const mongoose = require('mongoose')

const lostFoundSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['lost', 'found'], required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, default: 'other', trim: true },
  location: { type: String, required: true, trim: true },
  imageUrl: { type: String, default: null },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' }
}, { timestamps: true })

module.exports = mongoose.model('LostFoundItem', lostFoundSchema)
