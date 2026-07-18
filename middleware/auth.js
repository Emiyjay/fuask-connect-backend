const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists' })
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ success: false, error: 'Session expired. Please log in again' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

module.exports = { protect }
