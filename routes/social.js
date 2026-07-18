const express = require('express')
const router = express.Router()

const Follow = require('../models/Follow')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

router.post('/follow/:userId', protect, async (req, res) => {
  try {
    const targetId = req.params.userId
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot follow yourself' })
    }

    const targetUser = await User.findById(targetId)
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const existing = await Follow.findOne({ followerId: req.user._id, followingId: targetId })
    if (existing) {
      return res.status(400).json({ success: false, error: 'You already follow this person' })
    }

    await Follow.create({ followerId: req.user._id, followingId: targetId })

    res.status(201).json({ success: true, message: `You are now following ${targetUser.displayName}` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to follow user' })
  }
})

router.delete('/follow/:userId', protect, async (req, res) => {
  try {
    const result = await Follow.deleteOne({ followerId: req.user._id, followingId: req.params.userId })
    if (result.deletedCount === 0) {
      return res.status(400).json({ success: false, error: 'You do not follow this person' })
    }
    res.status(200).json({ success: true, message: 'Unfollowed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to unfollow user' })
  }
})

router.get('/followers/:userId', protect, async (req, res) => {
  try {
    const follows = await Follow.find({ followingId: req.params.userId })
      .populate('followerId', 'displayName department level role')

    const data = follows.filter(f => f.followerId).map(f => ({
      id: f.followerId._id,
      displayName: f.followerId.displayName,
      department: f.followerId.department,
      level: f.followerId.level
    }))

    res.status(200).json({ success: true, count: data.length, data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch followers' })
  }
})

router.get('/following/:userId', protect, async (req, res) => {
  try {
    const follows = await Follow.find({ followerId: req.params.userId })
      .populate('followingId', 'displayName department level role')

    const data = follows.filter(f => f.followingId).map(f => ({
      id: f.followingId._id,
      displayName: f.followingId.displayName,
      department: f.followingId.department,
      level: f.followingId.level
    }))

    res.status(200).json({ success: true, count: data.length, data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch following list' })
  }
})

router.get('/stats/:userId', protect, async (req, res) => {
  try {
    const [followerCount, followingCount] = await Promise.all([
      Follow.countDocuments({ followingId: req.params.userId }),
      Follow.countDocuments({ followerId: req.params.userId })
    ])
    res.status(200).json({ success: true, data: { followers: followerCount, following: followingCount } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch stats' })
  }
})

module.exports = router
