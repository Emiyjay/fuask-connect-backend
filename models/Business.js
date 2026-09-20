const mongoose = require('mongoose')

const businessSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  category: { type: String, default: 'other', trim: true, maxlength: 40 },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  contactPhone: { type: String, required: true, trim: true, maxlength: 30 },
  contactWhatsapp: { type: String, default: null, trim: true, maxlength: 30 },
  imageUrl: { type: String, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  promotionTier: { type: String, enum: ['free', 'featured'], default: 'free' },
  featuredUntil: { type: Date, default: null }
}, { timestamps: true })

businessSchema.index({ status: 1, promotionTier: 1, featuredUntil: 1, createdAt: -1 })
businessSchema.index({ category: 1, status: 1 })

module.exports = mongoose.model('Business', businessSchema)
