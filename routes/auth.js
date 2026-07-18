const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')

const router = express.Router()

const User = require('../models/User')
const validateMatric = require('../utils/validateMatric')
const validatePhone = require('../utils/validatePhone')
const { sendOTPEmail } = require('../utils/sendEmail')
const { syncStudentGroups, syncStaffGroups } = require('../utils/groupSync')
const { protect } = require('../middleware/auth')

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts. Try again in an hour.' }
})

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  })
}

router.post('/register/student', authLimiter, async (req, res) => {
  try {
    const { matricNumber, email, password, displayName } = req.body

    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, error: 'Email, password, and display name are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
    }

    const matricResult = validateMatric(matricNumber)
    if (!matricResult.valid) {
      return res.status(400).json({ success: false, error: matricResult.error })
    }

    const existingMatric = await User.findOne({ matricNumber: matricResult.matricNumber })
    if (existingMatric) {
      return res.status(409).json({ success: false, error: 'This matric number is already registered' })
    }
    const existingEmail = await User.findOne({ email: email.toLowerCase() })
    if (existingEmail) {
      return res.status(409).json({ success: false, error: 'This email is already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const otp = generateOTP()
    const otpHash = await bcrypt.hash(otp, 10)

    const user = await User.create({
      matricNumber: matricResult.matricNumber,
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      department: matricResult.department,
      faculty: matricResult.faculty,
      facultyCode: matricResult.facultyCode,
      deptCode: matricResult.deptCode,
      enrollmentYear: matricResult.enrollmentYear,
      programDuration: matricResult.programDuration,
      role: 'student',
      verificationOTP: otpHash,
      verificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000)
    })

    await sendOTPEmail(user.email, otp, user.displayName)

    res.status(201).json({
      success: true,
      message: 'Account created! Check your email for the 6-digit verification code.',
      data: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        department: user.department,
        level: user.level,
        isVerified: user.isVerified
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
})

// SECURITY: role is intentionally NOT accepted from the client here.
// Self-registration always creates 'lecturer'. Elevation to hod/dean/dpr/sug/super_admin
// requires an existing super_admin using PATCH /admin/users/:id/promote
router.post('/register/staff', authLimiter, async (req, res) => {
  try {
    const { phoneNumber, email, password, displayName, deptCode, facultyCode, department, faculty } = req.body

    if (!email || !password || !displayName || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number, email, password, and display name are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
    }

    const phoneResult = validatePhone(phoneNumber)
    if (!phoneResult.valid) {
      return res.status(400).json({ success: false, error: phoneResult.error })
    }

    if (!department || !faculty || !deptCode || !facultyCode) {
      return res.status(400).json({ success: false, error: 'Department and faculty information required' })
    }

    const existingPhone = await User.findOne({ phoneNumber: phoneResult.phoneNumber })
    if (existingPhone) {
      return res.status(409).json({ success: false, error: 'This phone number is already registered' })
    }
    const existingEmail = await User.findOne({ email: email.toLowerCase() })
    if (existingEmail) {
      return res.status(409).json({ success: false, error: 'This email is already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const otp = generateOTP()
    const otpHash = await bcrypt.hash(otp, 10)

    const user = await User.create({
      phoneNumber: phoneResult.phoneNumber,
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      department,
      faculty,
      facultyCode,
      deptCode,
      role: 'lecturer',
      verificationOTP: otpHash,
      verificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000)
    })

    await sendOTPEmail(user.email, otp, user.displayName)

    res.status(201).json({
      success: true,
      message: 'Account created! Check your email for the 6-digit verification code.',
      data: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        department: user.department,
        isVerified: user.isVerified
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
})

router.post('/verify', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+verificationOTP +verificationOTPExpiry')
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email' })
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, error: 'Account already verified' })
    }
    if (!user.verificationOTP || new Date() > user.verificationOTPExpiry) {
      return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one' })
    }

    const match = await bcrypt.compare(otp, user.verificationOTP)
    if (!match) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' })
    }

    user.isVerified = true
    user.verificationOTP = undefined
    user.verificationOTPExpiry = undefined
    await user.save()

    if (user.role === 'student') {
      await syncStudentGroups(user)
    } else {
      await syncStaffGroups(user)
    }

    const token = generateToken(user)

    res.status(200).json({
      success: true,
      message: 'Account verified! Welcome to FUASK Connect.',
      token,
      data: {
        id: user._id,
        displayName: user.displayName,
        role: user.role,
        department: user.department,
        level: user.level
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Verification failed' })
  }
})

router.post('/resend-otp', authLimiter, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email' })
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, error: 'Account already verified' })
    }

    const otp = generateOTP()
    user.verificationOTP = await bcrypt.hash(otp, 10)
    user.verificationOTPExpiry = new Date(Date.now() + 10 * 60 * 1000)
    await user.save()

    await sendOTPEmail(user.email, otp, user.displayName)

    res.status(200).json({ success: true, message: 'A new OTP has been sent to your email' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to resend OTP' })
  }
})

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, error: 'Please verify your email before logging in' })
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Access denied. Your account status is: ${user.accountStatus}. Contact your department for help.`
      })
    }

    if (user.role === 'student' && user.isGraduated) {
      return res.status(403).json({
        success: false,
        error: 'Your program duration has concluded. Student access has ended. Contact the registrar for alumni access.'
      })
    }

    user.lastActive = new Date()
    await user.save()

    const token = generateToken(user)

    res.status(200).json({
      success: true,
      message: 'Login successful. Welcome back!',
      token,
      data: {
        id: user._id,
        displayName: user.displayName,
        role: user.role,
        department: user.department,
        level: user.level
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

router.post('/logout', protect, async (req, res) => {
  try {
    req.user.tokenVersion += 1
    await req.user.save()
    res.status(200).json({ success: true, message: 'Logged out from all devices' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Logout failed' })
  }
})

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    // Always respond the same way whether or not the account exists � prevents email enumeration
    if (user) {
      const otp = generateOTP()
      user.verificationOTP = await bcrypt.hash(otp, 10)
      user.verificationOTPExpiry = new Date(Date.now() + 10 * 60 * 1000)
      await user.save()
      await sendOTPEmail(user.email, otp, user.displayName)
    }

    res.status(200).json({ success: true, message: 'If that email is registered, a reset code has been sent.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to process request' })
  }
})

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'email, otp, and newPassword are required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+verificationOTP +verificationOTPExpiry')
    if (!user || !user.verificationOTP || new Date() > user.verificationOTPExpiry) {
      return res.status(400).json({ success: false, error: 'Invalid or expired code' })
    }

    const match = await bcrypt.compare(otp, user.verificationOTP)
    if (!match) {
      return res.status(400).json({ success: false, error: 'Invalid or expired code' })
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12)
    user.verificationOTP = undefined
    user.verificationOTPExpiry = undefined
    user.tokenVersion += 1 // invalidate any existing sessions in case the account was compromised
    await user.save()

    res.status(200).json({ success: true, message: 'Password reset successful. Please log in with your new password.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to reset password' })
  }
})

router.get('/me', protect, async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user
  })
})

module.exports = router
