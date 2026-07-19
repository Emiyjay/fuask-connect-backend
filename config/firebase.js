const admin = require('firebase-admin')

let initialized = false

try {
  const serviceAccount = require('./firebase-service-account.json')
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  initialized = true
  console.log('✅ Firebase Admin initialized — push notifications active')
} catch (error) {
  console.warn('⚠️  Firebase service account not found — push notifications disabled until config/firebase-service-account.json is added')
}

module.exports = { admin, initialized }
