const dns = require('node:dns')
dns.setDefaultResultOrder('ipv4first')

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const connectDB = require('./config/db')
const sanitizeBody = require('./middleware/sanitize')
const app = express()

app.set('trust proxy', 1)

app.use(helmet())
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081').split(',')
app.use(cors({
  origin: (origin, callback) => {
    // Native app requests carry no Origin header and always pass.
    // CORS only matters for a future browser-based (e.g. web) build.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP' }
})
app.use(globalLimiter)

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts. Please wait a moment and try again.' }
})

connectDB()

app.use('/api/auth', authLimiter, require('./routes/auth'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/groups', require('./routes/groups'))
app.use('/api/social', require('./routes/social'))
app.use('/api/materials', require('./routes/materials'))
app.use('/api/messages', require('./routes/messages'))
app.use('/api/lostfound', require('./routes/lostfound'))
app.use('/api/marketplace', require('./routes/marketplace'))
app.use('/api/posts', require('./routes/posts'))
app.use('/api/timetable', require('./routes/timetable'))

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FUASK Connect Backend Running',
    version: '1.0.0',
    university: 'Federal University of Applied Sciences, Kachia'
  })
})

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`\n======================`)
  console.log(`FUASK CONNECT BACKEND STARTED`)
  console.log(`Port: ${PORT}`)
  console.log(`http://localhost:${PORT}`)
  console.log(`======================\n`)
})
