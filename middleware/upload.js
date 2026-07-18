const multer = require('multer')
const cloudinary = require('../config/cloudinary')

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  zipBased: [0x50, 0x4B, 0x03, 0x04],
  oleBased: [0xD0, 0xCF, 0x11, 0xE0]
}

function matchesSignature(buffer, signature) {
  return signature.every((byte, i) => buffer[i] === byte)
}

function isAllowedFile(buffer) {
  return Object.values(SIGNATURES).some(sig => matchesSignature(buffer, sig))
}

function validateFileContent(req, res, next) {
  if (!req.file) return next()
  if (!isAllowedFile(req.file.buffer)) {
    return res.status(400).json({ success: false, error: 'File content does not match an allowed type' })
  }
  next()
}

function validateMultipleFileContent(req, res, next) {
  if (!req.files || req.files.length === 0) return next()
  const invalid = req.files.some(file => !isAllowedFile(file.buffer))
  if (invalid) {
    return res.status(400).json({ success: false, error: 'One or more files do not match an allowed type' })
  }
  next()
}

function uploadToCloudinary(folder) {
  return (req, res, next) => {
    if (!req.file) return next()
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) {
          console.error(error)
          return res.status(500).json({ success: false, error: 'File upload failed' })
        }
        req.file.path = result.secure_url
        next()
      }
    )
    stream.end(req.file.buffer)
  }
}

function uploadMultipleToCloudinary(folder) {
  return async (req, res, next) => {
    if (!req.files || req.files.length === 0) return next()
    try {
      const uploads = await Promise.all(
        req.files.map(file => new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'auto' },
            (error, result) => {
              if (error) return reject(error)
              resolve({ url: result.secure_url, type: file.mimetype })
            }
          )
          stream.end(file.buffer)
        }))
      )
      req.uploadedFiles = uploads
      next()
    } catch (error) {
      console.error(error)
      res.status(500).json({ success: false, error: 'File upload failed' })
    }
  }
}

function uploadField(fieldName, folder) {
  return [memoryUpload.single(fieldName), validateFileContent, uploadToCloudinary(folder)]
}

function uploadFields(fieldName, folder, maxCount = 5) {
  return [memoryUpload.array(fieldName, maxCount), validateMultipleFileContent, uploadMultipleToCloudinary(folder)]
}

module.exports = { uploadField, uploadFields }
