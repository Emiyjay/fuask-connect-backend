function validatePhone(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { valid: false, error: 'Phone number is required' }
  }

  const cleaned = phoneNumber.trim().replace(/\s+/g, '')

  const localFormat = /^0[7-9][0-1]\d{8}$/
  const internationalFormat = /^\+234[7-9][0-1]\d{8}$/

  if (!localFormat.test(cleaned) && !internationalFormat.test(cleaned)) {
    return { valid: false, error: 'Invalid Nigerian phone number format' }
  }

  const normalized = cleaned.startsWith('+234')
    ? cleaned
    : `+234${cleaned.slice(1)}`

  return { valid: true, phoneNumber: normalized }
}

module.exports = validatePhone
