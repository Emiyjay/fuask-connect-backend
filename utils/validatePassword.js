function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' }
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\/;']/.test(password)) {
    return { valid: false, error: 'Password must contain at least one symbol' }
  }
  return { valid: true }
}

module.exports = validatePassword
