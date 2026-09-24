const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

function getRecipientDomain(email) {
  const [, domain] = String(email).split('@')
  return domain || 'unknown'
}

async function sendOTPEmail(toEmail, otp, displayName) {
  const { data, error } = await resend.emails.send({
    from: 'FUASK Connect <onboarding@resend.dev>', // swap once your domain is verified
    to: toEmail,
    subject: 'Verify your FUASK Connect account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Hi ${displayName},</h2>
        <p>Your FUASK Connect verification code is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `
  })

  if (error) {
    console.error('OTP email delivery request failed', {
      recipientDomain: getRecipientDomain(toEmail),
      error: error.message || error.name || String(error)
    })
    throw new Error('OTP email delivery failed')
  }

  console.info('OTP email accepted by email provider', {
    recipientDomain: getRecipientDomain(toEmail),
    messageId: data?.id || null
  })

  return data
}

module.exports = { sendOTPEmail }
