const { initializeApp, cert } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')

let initialized = false
let messaging = null

try {
  const serviceAccount = require('./firebase-service-account.json')
  const app = initializeApp({ credential: cert(serviceAccount) })
  messaging = getMessaging(app)
  initialized = true
  console.log('✅ Firebase Admin initialized — push notifications active')
} catch (error) {
  console.warn(`⚠️  Firebase init failed: ${error.message}`)
}

module.exports = { messaging, initialized }
