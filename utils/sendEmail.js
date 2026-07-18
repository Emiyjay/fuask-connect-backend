const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

async function sendOTPEmail(toEmail, otp, displayName) {
  await transporter.sendMail({
    from: `"FUASK Connect" <${process.env.EMAIL_USER}>`,
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
