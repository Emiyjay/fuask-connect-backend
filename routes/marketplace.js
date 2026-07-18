const express = require('express')
const router = express.Router()

const Business = require('../models/Business')
const { uploadField } = require('../middleware/upload')
const { protect } = require('../middleware/auth')

function canVerifyBusiness(req, res, next) {
  if (!['dpr', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to verify businesses' })
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
      name,
      description,
      category: category || 'other',
      location,
      contactPhone,
      contactWhatsapp: contactWhatsapp || null,
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
    const filter = { status: 'approved' }
    if (category) filter.category = category

    const businesses = await Business.find(filter).sort({ createdAt: -1 })

    res.status(200).json({ success: true, count: businesses.length, data: businesses })
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
    business.rejectionReason = decision === 'rejected' ? (rejectionReason || 'Not specified') : null
    await business.save()

    res.status(200).json({ success: true, message: `Business ${decision}`, data: business })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to verify business' })
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

    res.status(200).json({ success: true, data: business })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch business' })
  }
})

module.exports = router
