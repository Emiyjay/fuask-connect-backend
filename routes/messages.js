const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')

const Message = require('../models/Message')
const User = require('../models/User')
const Report = require('../models/Report')
const Block = require('../models/Block')
const { protect } = require('../middleware/auth')

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Sending too fast. Slow down.' }
})

function canReviewReports(req, res, next) {
  if (!['super_admin', 'dpr'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to review reports' })
  }
  next()
}

router.put('/public-key', protect, async (req, res) => {
  try {
    const { publicKey } = req.body
    if (!publicKey) {
      return res.status(400).json({ success: false, error: 'publicKey is required' })
    }
    await User.findByIdAndUpdate(req.user._id, { publicKey })
    res.status(200).json({ success: true, message: 'Public key saved' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to save public key' })
  }
})

router.get('/public-key/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('publicKey displayName')
    if (!user || !user.publicKey) {
      return res.status(404).json({ success: false, error: 'This user has no public key registered yet' })
    }
    res.status(200).json({ success: true, data: { userId: user._id, publicKey: user.publicKey } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch public key' })
  }
})

router.post('/', protect, messageLimiter, async (req, res) => {
  try {
    const { receiverId, ciphertext, nonce } = req.body

    if (!receiverId || !ciphertext || !nonce) {
      return res.status(400).json({ success: false, error: 'receiverId, ciphertext, and nonce are required' })
    }
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot message yourself' })
    }

    const receiver = await User.findById(receiverId)
    if (!receiver) {
      return res.status(404).json({ success: false, error: 'Recipient not found' })
    }

    const blocked = await Block.findOne({ blockerId: receiverId, blockedUserId: req.user._id })
    if (blocked) {
      return res.status(403).json({ success: false, error: 'You cannot message this user' })
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      ciphertext,
      nonce
    })

    res.status(201).json({ success: true, data: message })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to send message' })
  }
})

router.get('/conversations', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    }).sort({ createdAt: -1 })

    const seen = new Map()
    for (const msg of messages) {
      const otherId = msg.senderId.toString() === req.user._id.toString()
        ? msg.receiverId.toString()
        : msg.senderId.toString()

      if (!seen.has(otherId)) {
        seen.set(otherId, { lastMessageAt: msg.createdAt, unread: 0 })
      }
      if (msg.receiverId.toString() === req.user._id.toString() && !msg.isRead) {
        seen.get(otherId).unread += 1
      }
    }

    const otherIds = [...seen.keys()]
    const users = await User.find({ _id: { $in: otherIds } }).select('displayName department role')

    const data = users.map(u => ({
      userId: u._id,
      displayName: u.displayName,
      department: u.department,
      lastMessageAt: seen.get(u._id.toString()).lastMessageAt,
      unread: seen.get(u._id.toString()).unread
    })).sort((a, b) => b.lastMessageAt - a.lastMessageAt)

    res.status(200).json({ success: true, count: data.length, data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' })
  }
})

router.post('/:id/report', protect, async (req, res) => {
  try {
    const { disclosedContent, reason } = req.body
    if (!disclosedContent || !reason) {
      return res.status(400).json({ success: false, error: 'disclosedContent and reason are required' })
    }

    const message = await Message.findById(req.params.id)
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' })
    }
    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You can only report messages sent to you' })
    }

    await Report.create({
      reporterId: req.user._id,
      reportedUserId: message.senderId,
      messageId: message._id,
      disclosedContent,
      reason
    })

    res.status(201).json({ success: true, message: 'Report submitted. Admin will review it.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to submit report' })
  }
})

router.post('/:userId/block', protect, async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot block yourself' })
    }
    const existing = await Block.findOne({ blockerId: req.user._id, blockedUserId: req.params.userId })
    if (existing) {
      return res.status(400).json({ success: false, error: 'Already blocked' })
    }
    await Block.create({ blockerId: req.user._id, blockedUserId: req.params.userId })
    res.status(200).json({ success: true, message: 'User blocked' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to block user' })
  }
})

router.delete('/:userId/block', protect, async (req, res) => {
  try {
    const result = await Block.deleteOne({ blockerId: req.user._id, blockedUserId: req.params.userId })
    if (result.deletedCount === 0) {
      return res.status(400).json({ success: false, error: 'You have not blocked this user' })
    }
    res.status(200).json({ success: true, message: 'User unblocked' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to unblock user' })
  }
})

router.get('/admin/reports', protect, canReviewReports, async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .populate('reporterId', 'displayName email')
      .populate('reportedUserId', 'displayName email department')
      .sort({ createdAt: -1 })

    res.status(200).json({ success: true, count: reports.length, data: reports })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch reports' })
  }
})

router.get('/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user._id }
      ]
    }).sort({ createdAt: 1 })

    await Message.updateMany(
      { senderId: req.params.userId, receiverId: req.user._id, isRead: false },
      { isRead: true }
    )

    res.status(200).json({ success: true, count: messages.length, data: messages })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch messages' })
  }
})

module.exports = router
