const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const rateLimit = require('express-rate-limit')

const Message = require('../models/Message')
const User = require('../models/User')
const Report = require('../models/Report')
const Block = require('../models/Block')
const { protect } = require('../middleware/auth')
const { sendPushNotification } = require('../utils/sendPush')

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: 'Sending too fast. Slow down.' }
})

const MAX_CIPHERTEXT_LENGTH = 10000
const MAX_NONCE_LENGTH = 1000

function canReviewReports(req, res, next) {
  if (!['super_admin', 'dpr'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to review reports' })
  }
  next()
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

router.put('/public-key', protect, async (req, res) => {
  try {
    const { publicKey } = req.body

    if (typeof publicKey !== 'string' || !publicKey.trim()) {
      return res.status(400).json({ success: false, error: 'publicKey is required' })
    }

    await User.findByIdAndUpdate(req.user._id, {
      publicKey: publicKey.trim()
    })

    res.status(200).json({ success: true, message: 'Public key saved' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to save public key' })
  }
})

router.get('/public-key/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' })
    }

    const user = await User.findById(userId).select('publicKey displayName')

    if (!user || !user.publicKey) {
      return res.status(404).json({
        success: false,
        error: 'This user has no public key registered yet'
      })
    }

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        publicKey: user.publicKey
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch public key' })
  }
})

router.post('/', protect, messageLimiter, async (req, res) => {
  try {
    const {
      receiverId,
      ciphertext,
      nonce,
      senderCiphertext,
      senderNonce
    } = req.body

    if (!receiverId || !ciphertext || !nonce) {
      return res.status(400).json({
        success: false,
        error: 'receiverId, ciphertext, and nonce are required'
      })
    }

    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receiver ID'
      })
    }

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot message yourself'
      })
    }

    if (typeof ciphertext !== 'string' || typeof nonce !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ciphertext and nonce must be strings'
      })
    }

    if (!ciphertext.trim() || !nonce.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ciphertext and nonce cannot be empty'
      })
    }

    if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'Encrypted message is too large'
      })
    }

    if (nonce.length > MAX_NONCE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'Invalid nonce'
      })
    }

    if (
      senderCiphertext !== undefined &&
      (typeof senderCiphertext !== 'string' || !senderCiphertext.trim())
    ) {
      return res.status(400).json({
        success: false,
        error: 'senderCiphertext must be a non-empty string when provided'
      })
    }

    if (
      senderNonce !== undefined &&
      (typeof senderNonce !== 'string' || !senderNonce.trim())
    ) {
      return res.status(400).json({
        success: false,
        error: 'senderNonce must be a non-empty string when provided'
      })
    }

    if (senderCiphertext !== undefined && senderCiphertext.length > MAX_CIPHERTEXT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'Sender encrypted message is too large'
      })
    }

    if (senderNonce !== undefined && senderNonce.length > MAX_NONCE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sender nonce'
      })
    }

    if ((senderCiphertext === undefined) !== (senderNonce === undefined)) {
      return res.status(400).json({
        success: false,
        error: 'senderCiphertext and senderNonce must be provided together'
      })
    }

    const receiver = await User.findById(receiverId).select('_id displayName fcmToken')

    if (!receiver) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found'
      })
    }

    const blocked = await Block.findOne({
      blockerId: receiverId,
      blockedUserId: req.user._id
    })

    if (blocked) {
      return res.status(403).json({
        success: false,
        error: 'You cannot message this user'
      })
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      ciphertext: ciphertext.trim(),
      nonce: nonce.trim(),
      senderCiphertext: senderCiphertext?.trim() || null,
      senderNonce: senderNonce?.trim() || null
    })

    // The server never receives plaintext.
    // Both ciphertext copies are encrypted on the client:
    // one for the recipient and one for the sender's own device.
    // Push notification contains no message content.
    if (receiver.fcmToken) {
      sendPushNotification(
        receiver.fcmToken,
        'New message',
        `${req.user.displayName} sent you a message`
      )
    }

    res.status(201).json({
      success: true,
      data: message
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    })
  }
})

router.get('/conversations', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .select('senderId receiverId createdAt isRead')

    const seen = new Map()

    for (const msg of messages) {
      const currentUserId = req.user._id.toString()

      const otherId = msg.senderId.toString() === currentUserId
        ? msg.receiverId.toString()
        : msg.senderId.toString()

      if (!seen.has(otherId)) {
        seen.set(otherId, {
          lastMessageAt: msg.createdAt,
          unread: 0
        })
      }

      if (
        msg.receiverId.toString() === currentUserId &&
        !msg.isRead
      ) {
        seen.get(otherId).unread += 1
      }
    }

    const otherIds = [...seen.keys()]

    if (otherIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      })
    }

    const users = await User.find({
      _id: { $in: otherIds }
    }).select('displayName department role')

    const data = users
      .map(user => {
        const conversation = seen.get(user._id.toString())

        return {
          userId: user._id,
          displayName: user.displayName,
          department: user.department,
          role: user.role,
          lastMessageAt: conversation.lastMessageAt,
          unread: conversation.unread
        }
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))

    res.status(200).json({
      success: true,
      count: data.length,
      data
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    })
  }
})

router.post('/:id/report', protect, async (req, res) => {
  try {
    const { disclosedContent, reason } = req.body

    if (!disclosedContent || !reason) {
      return res.status(400).json({
        success: false,
        error: 'disclosedContent and reason are required'
      })
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message ID'
      })
    }

    const message = await Message.findById(req.params.id)

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      })
    }

    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only report messages sent to you'
      })
    }

    await Report.create({
      reporterId: req.user._id,
      reportedUserId: message.senderId,
      messageId: message._id,
      disclosedContent,
      reason
    })

    res.status(201).json({
      success: true,
      message: 'Report submitted. Admin will review it.'
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to submit report'
    })
  }
})

router.get('/:userId/block', protect, async (req, res) => {
  try {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      })
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot check your own block status'
      })
    }

    const blocked = await Block.exists({
      blockerId: req.user._id,
      blockedUserId: userId
    })

    res.status(200).json({
      success: true,
      data: {
        blocked: Boolean(blocked)
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to check block status'
    })
  }
})

router.post('/:userId/block', protect, async (req, res) => {
  try {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      })
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot block yourself'
      })
    }

    const user = await User.findById(userId).select('_id')

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    const existing = await Block.findOne({
      blockerId: req.user._id,
      blockedUserId: userId
    })

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Already blocked'
      })
    }

    await Block.create({
      blockerId: req.user._id,
      blockedUserId: userId
    })

    res.status(200).json({
      success: true,
      message: 'User blocked'
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to block user'
    })
  }
})

router.delete('/:userId/block', protect, async (req, res) => {
  try {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      })
    }

    const result = await Block.deleteOne({
      blockerId: req.user._id,
      blockedUserId: userId
    })

    if (result.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'You have not blocked this user'
      })
    }

    res.status(200).json({
      success: true,
      message: 'User unblocked'
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to unblock user'
    })
  }
})

router.get('/admin/reports', protect, canReviewReports, async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .populate('reporterId', 'displayName email')
      .populate('reportedUserId', 'displayName email department')
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    })
  }
})

router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      })
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot open a conversation with yourself'
      })
    }

    const otherUser = await User.findById(userId).select('_id')

    if (!otherUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    const messages = await Message.find({
      $or: [
        {
          senderId: req.user._id,
          receiverId: userId
        },
        {
          senderId: userId,
          receiverId: req.user._id
        }
      ]
    }).sort({ createdAt: 1 })

    await Message.updateMany(
      {
        senderId: userId,
        receiverId: req.user._id,
        isRead: false
      },
      {
        $set: { isRead: true }
      }
    )

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    })
  }
})

module.exports = router
