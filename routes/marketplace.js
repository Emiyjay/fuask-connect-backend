const express = require('express')
const router = express.Router()

const Business = require('../models/Business')
const { uploadField } = require('../middleware/upload')
const { protect } = require('../middleware/auth')
const { recordAudit } = require('../utils/audit')

function canVerifyBusiness(req, res, next) {
  if (!['dpr', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to verify businesses' })
  }
  next()
}

function canManagePromotion(req, res, next) {
  if (!['dpr', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to manage marketplace promotion' })
  }
  next()
}

router.post('/businesses', protect, ...uploadField('image', 'fuask-connect/businesses'), async (req, res) => {
  try {
    const { name, description, category, location, contactPhone, contactWhatsapp } = req.body

    if (!name || !description || !location || !contactPhone) {
      return res.status(400).json({ success: false, error: 'name, description, location, and contactPhone are required' })
    }

    const business = await Business.create({
      submittedBy: req.user._id,
      name: String(name).trim(),
      description: String(description).trim(),
      category: category ? String(category).trim() : 'other',
      location: String(location).trim(),
      contactPhone: String(contactPhone).trim(),
      contactWhatsapp: contactWhatsapp ? String(contactWhatsapp).trim() : null,
      imageUrl: req.file ? req.file.path : null
    })

    res.status(201).json({
      success: true,
      message: 'Business submitted. It will appear once verified by admin.',
      data: business
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to submit business' })
  }
})

router.get('/businesses', protect, async (req, res) => {
  try {
    const { category } = req.query
    const now = new Date()
    const filter = { status: 'approved' }
    if (category) filter.category = category

    const businesses = await Business.find(filter)
      .sort({ promotionTier: -1, featuredUntil: -1, createdAt: -1 })

    const data = businesses.map((business) => {
      const item = business.toObject()
      item.isFeatured = item.promotionTier === 'featured' && business.featuredUntil && business.featuredUntil > now
      if (!item.isFeatured) item.promotionTier = 'free'
      return item
    })

    res.status(200).json({ success: true, count: data.length, data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch businesses' })
  }
})

router.get('/businesses/admin/pending', protect, canVerifyBusiness, async (req, res) => {
  try {
    const pending = await Business.find({ status: 'pending' })
      .populate('submittedBy', 'displayName email department')
      .sort({ createdAt: -1 })

    res.status(200).json({ success: true, count: pending.length, data: pending })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch pending businesses' })
  }
})

router.patch('/businesses/:id/verify', protect, canVerifyBusiness, async (req, res) => {
  try {
    const { decision, rejectionReason } = req.body
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'decision must be "approved" or "rejected"' })
    }

    const business = await Business.findById(req.params.id)
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' })
    }

    business.status = decision
    business.verifiedBy = req.user._id
    business.verifiedAt = decision === 'approved' ? new Date() : null
    business.rejectionReason = decision === 'rejected' ? (rejectionReason || 'Not specified') : null
    await business.save()

    await recordAudit({ actor: req.user._id, action: 'business.verification.updated', targetType: 'Business', targetId: business._id, metadata: { decision, status: business.status } })

    res.status(200).json({ success: true, message: 'Business ' + decision, data: business })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to verify business' })
  }
})

router.patch('/businesses/:id/feature', protect, canManagePromotion, async (req, res) => {
  try {
    const { enabled, days } = req.body

    const business = await Business.findById(req.params.id)
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' })
    }
    if (business.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Only approved businesses can be featured' })
    }

    if (enabled === true) {
      const duration = Number(days)
      if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
        return res.status(400).json({ success: false, error: 'days must be an integer from 1 to 30' })
      }
      business.promotionTier = 'featured'
      business.featuredUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
    } else {
      business.promotionTier = 'free'
      business.featuredUntil = null
    }

    await business.save()

    await recordAudit({ actor: req.user._id, action: 'business.promotion.updated', targetType: 'Business', targetId: business._id, metadata: { promotionTier: business.promotionTier, featuredUntil: business.featuredUntil } })

    res.status(200).json({
      success: true,
      message: business.promotionTier === 'featured' ? 'Business featured' : 'Business promotion removed',
      data: business
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to update marketplace promotion' })
  }
})

router.get('/businesses/:id', protect, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' })
    }

    const isOwner = business.submittedBy.toString() === req.user._id.toString()
    const isAdmin = ['dpr', 'super_admin'].includes(req.user.role)

    if (business.status !== 'approved' && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'This business has not been verified yet' })
    }

    const item = business.toObject()
    item.isFeatured = business.promotionTier === 'featured' && business.featuredUntil && business.featuredUntil > new Date()

    res.status(200).json({ success: true, data: item })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch business' })
  }
})

module.exports = router
