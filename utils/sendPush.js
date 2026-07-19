const { admin, initialized } = require('../config/firebase')

async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!initialized || !fcmToken) return null
  try {
    return await admin.messaging().send({ token: fcmToken, notification: { title, body }, data })
  } catch (error) {
    console.error('Push notification failed:', error.message)
    return null
  }
}

async function sendPushToMany(fcmTokens, title, body, data = {}) {
  const validTokens = [...new Set(fcmTokens.filter(Boolean))]
  if (!initialized || validTokens.length === 0) return null
  try {
    return await admin.messaging().sendEachForMulticast({ tokens: validTokens, notification: { title, body }, data })
  } catch (error) {
    console.error('Bulk push notification failed:', error.message)
    return null
  }
}

module.exports = { sendPushNotification, sendPushToMany }
