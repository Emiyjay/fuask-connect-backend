const mongoose = require('mongoose')

const businessSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, default: 'other', trim: true },
  location: { type: String, required: true, trim: true },
  contactPhone: { type: String, required: true, trim: true },
  contactWhatsapp: { type: String, default: null, trim: true },
  imageUrl: { type: String, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

module.exports = mongoose.model('Business', businessSchema)
