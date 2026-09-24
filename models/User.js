const mongoose = require('mongoose')
const { getCurrentLevel, getCurrentSessionYear } = require('../utils/academicSession')

const userSchema = new mongoose.Schema({
  matricNumber: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    required: function () { return this.role === 'student' }
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    required: function () { return this.role !== 'student' }
  },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  displayName: { type: String, required: true, trim: true },
  department: {
    type: String,
    required: function () { return ['student', 'lecturer', 'hod'].includes(this.role) }
  },
  faculty: {
    type: String,
    required: function () { return ['student', 'lecturer', 'hod', 'dean'].includes(this.role) }
  },
  facultyCode: {
    type: String,
    required: function () { return ['student', 'lecturer', 'hod', 'dean'].includes(this.role) }
  },
  deptCode: {
    type: String,
    required: function () { return ['student', 'lecturer', 'hod'].includes(this.role) }
  },
  enrollmentYear: { type: Number, default: null },
  programDuration: { type: Number, default: null },
  accountStatus: {
    type: String,
    enum: ['active', 'withdrawn', 'expelled', 'suspended'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['student', 'lecturer', 'hod', 'dean', 'sug', 'dpr', 'super_admin'],
    default: 'student'
  },
  isVerified: { type: Boolean, default: false },
  verificationOTP: { type: String, select: false },
  verificationOTPExpiry: { type: Date, select: false },
  tokenVersion: { type: Number, default: 0 },
  publicKey: { type: String, default: null },
  fcmToken: { type: String, default: null },
  lastActive: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

userSchema.virtual('level').get(function () {
  if (this.role !== 'student' || !this.enrollmentYear) return null
  return getCurrentLevel(this.enrollmentYear)
})

userSchema.virtual('isGraduated').get(function () {
  if (this.role !== 'student' || !this.enrollmentYear || !this.programDuration) return false
  const sessionYear = getCurrentSessionYear()
  return (sessionYear - this.enrollmentYear) >= this.programDuration
})

module.exports = mongoose.model('User', userSchema)
