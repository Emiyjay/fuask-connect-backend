const express = require('express')
const router = express.Router()
const User = require('../models/User')
const { protect } = require('../middleware/auth')

router.get('/search', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) return res.status(400).json({ success: false, error: 'Search must contain at least 2 characters' })
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    const users = await User.find({
      _id: { $ne: req.user._id },
      accountStatus: 'active',
      isVerified: true,
      $or: [
        { displayName: regex },
        { matricNumber: regex },
        { department: regex },
        { deptCode: regex }
      ]
    }).select('displayName department faculty role publicKey').limit(20)
    res.json({ success: true, count: users.length, data: users })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to search users' })
  }
})

module.exports = router
