function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }
  if (value && typeof value === 'object') {
    const cleaned = {}
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue // strip keys that could be used for NoSQL injection
      }
      cleaned[key] = sanitizeValue(value[key])
    }
    return cleaned
  }
  return value
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body)
  }
  next()
}

module.exports = sanitizeBody


