const express = require('express')
const router = express.Router()

const Material = require('../models/Material')
const { uploadField } = require('../middleware/upload')
const { protect } = require('../middleware/auth')

router.post('/upload', protect, ...uploadField('file', 'fuask-connect/materials'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded' })
    }

    const { title, courseCode } = req.body
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' })
    }

    const material = await Material.create({
      uploaderId: req.user._id,
      title,
      courseCode: courseCode || null,
      fileUrl: req.file.path,
      fileType: req.file.mimetype,
      department: req.user.department
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
    res.status(500).json({ success: false, error: 'Failed to delete material' })
  }
})

module.exports = router
