const express = require('express')
const router = express.Router()

const LostFoundItem = require('../models/LostFoundItem')
const { uploadField } = require('../middleware/upload')
const { protect } = require('../middleware/auth')

router.post('/', protect, ...uploadField('image', 'fuask-connect/lostfound'), async (req, res) => {
  try {
    const { type, title, description, category, location } = req.body

    if (!type || !title || !description || !location) {
      return res.status(400).json({ success: false, error: 'type, title, description, and location are required' })
    }
    if (!['lost', 'found'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be "lost" or "found"' })
    }

    const item = await LostFoundItem.create({
      reporterId: req.user._id,
      type,
      title,
      description,
      category: category || 'other',
      location,
      imageUrl: req.file ? req.file.path : null
    })

    res.status(201).json({ success: true, message: 'Item posted', data: item })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to post item' })
  }
})

router.get('/', protect, async (req, res) => {
  try {
    const { type, category } = req.query
    const filter = { status: 'open' }
    if (type) filter.type = type
    if (category) filter.category = category

    const items = await LostFoundItem.find(filter)
      .populate('reporterId', 'displayName department')
      .sort({ createdAt: -1 })

    res.status(200).json({ success: true, count: items.length, data: items })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch items' })
  }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const item = await LostFoundItem.findById(req.params.id)
      .populate('reporterId', 'displayName department')
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' })
    }
    res.status(200).json({ success: true, data: item })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch item' })
  }
})

router.patch('/:id/resolve', protect, async (req, res) => {
  try {
    const item = await LostFoundItem.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' })
    }
    if (item.reporterId.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'You can only resolve your own posts' })
    }

    item.status = 'resolved'
    await item.save()

    res.status(200).json({ success: true, message: 'Marked as resolved', data: item })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to update item' })
  }
})

router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await LostFoundItem.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' })
    }
    if (item.reporterId.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'You can only delete your own posts' })
    }

    await LostFoundItem.deleteOne({ _id: item._id })
    res.status(200).json({ success: true, message: 'Post deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to delete item' })
  }
})

module.exports = router
