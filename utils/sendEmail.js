const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

async function sendOTPEmail(toEmail, otp, displayName) {
  await resend.emails.send({
    from: 'FUASK Connect <onboarding@resend.dev>', // swap once your domain is verified — see note below
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
}

module.exports = { sendOTPEmail }
