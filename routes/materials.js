const express = require('express')
const router = express.Router()
const Material = require('../models/Material')
const { uploadField } = require('../middleware/upload')
const { protect } = require('../middleware/auth')
const GroupMembership = require('../models/GroupMembership')

router.post('/upload', protect, ...uploadField('file', 'fuask-connect/materials'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded' })
    }
    const { title, courseCode, isPrivate, scope, groupId } = req.body

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' })
    }

    const shared = isPrivate === 'false' || isPrivate === false
    const materialScope = scope === 'cohort' ? 'cohort' : 'general'

    if (shared && materialScope === 'cohort' && !groupId) {
      return res.status(400).json({ success: false, error: 'groupId is required for cohort-scoped materials' })
    }

    const material = await Material.create({
      uploaderId: req.user._id,
      title,
      courseCode: courseCode || null,
      fileUrl: req.file.path,
      fileType: req.file.mimetype,
      department: req.user.department,
      isPrivate: shared ? false : true,
      scope: materialScope,
      groupId: shared && materialScope === 'cohort' ? groupId : null
    })

    res.status(201).json({ success: true, message: 'Material uploaded', data: material })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Upload failed' })
  }
})

router.get('/mine', protect, async (req, res) => {
  try {
    const materials = await Material.find({ uploaderId: req.user._id }).sort({ createdAt: -1 })
    res.status(200).json({ success: true, count: materials.length, data: materials })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch materials' })
  }
})

router.get('/general', protect, async (req, res) => {
  try {
    const materials = await Material.find({ isPrivate: false, scope: 'general' }).sort({ createdAt: -1 })
    res.status(200).json({ success: true, count: materials.length, data: materials })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch materials' })
  }
})

router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const membership = await GroupMembership.findOne({ groupId: req.params.groupId, userId: req.user._id })
    if (!membership && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'You do not have access to this group' })
    }
    const materials = await Material.find({ groupId: req.params.groupId, scope: 'cohort', isPrivate: false }).sort({ createdAt: -1 })
    res.status(200).json({ success: true, count: materials.length, data: materials })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch materials' })
  }
})

router.delete('/:id', protect, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id)
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' })
    }
    if (material.uploaderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You can only delete your own materials' })
    }
    await Material.deleteOne({ _id: material._id })
    res.status(200).json({ success: true, message: 'Material deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch materials' })
  }
})

module.exports = router
