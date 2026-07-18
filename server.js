const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const connectDB = require('./config/db')
const sanitizeBody = require('./middleware/sanitize')
const app = express()

app.use(helmet())
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use(cors())

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP' }
})
app.use(globalLimiter)

connectDB()

app.use('/api/auth', require('./routes/auth'))

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FUASK Connect Backend Running ✅',
    version: '1.0.0',
    university: 'Federal University of Applied Sciences, Kachia'
  })
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`\n══════════════════════════════`)
  console.log(`��� FUASK CONNECT BACKEND STARTED`)
  console.log(`��� Port: ${PORT}`)
  console.log(`��� http://localhost:${PORT}`)
  console.log(`══════════════════════════════\n`)
})
