const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const http = require('node:http')
const path = require('node:path')

const AUTH_PATH = require.resolve('../middleware/auth')

function loadRoute(routePath, user) {
  const absoluteRoutePath = require.resolve(routePath)

  delete require.cache[absoluteRoutePath]
  require.cache[AUTH_PATH] = {
    id: AUTH_PATH,
    filename: AUTH_PATH,
    loaded: true,
    exports: {
      protect(req, res, next) {
        req.user = user
        next()
      }
    }
  }

  return require(routePath)
}

async function requestRoute(routePath, user, method, requestPath, body) {
  const app = express()
  app.use(express.json())
  app.use('/api', loadRoute(routePath, user))
  app.use((req, res) => res.status(404).json({ success: false, error: 'not found' }))

  const server = http.createServer(app)

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api${requestPath}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    const text = await response.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {}

    return { status: response.status, body: json, raw: text }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('route authorization boundaries reject cross-scope and unauthorized requests', async () => {
  const cseStudent = {
    _id: '507f1f77bcf86cd799439011',
    role: 'student',
    deptCode: 'CSE',
    facultyCode: 'CPC',
    level: '200'
  }

  const cseHod = {
    ...cseStudent,
    role: 'hod',
    _id: '507f1f77bcf86cd799439013'
  }

  const cpcDean = {
    ...cseStudent,
    role: 'dean',
    _id: '507f1f77bcf86cd799439014'
  }

  const medDean = {
    ...cseStudent,
    role: 'dean',
    facultyCode: 'MED',
    _id: '507f1f77bcf86cd799439015'
  }

  const superAdmin = {
    ...cseStudent,
    role: 'super_admin',
    _id: '507f1f77bcf86cd799439017'
  }

  const timetableCrossStudent = await requestRoute(
    '../routes/timetable',
    cseStudent,
    'GET',
    '/department/SE'
  )
  assert.equal(timetableCrossStudent.status, 403)

  const timetableCrossDean = await requestRoute(
    '../routes/timetable',
    medDean,
    'GET',
    '/department/CSE'
  )
  assert.equal(timetableCrossDean.status, 403)

  const timetableStudentWrite = await requestRoute(
    '../routes/timetable',
    cseStudent,
    'POST',
    '/',
    {
      deptCode: 'CSE',
      facultyCode: 'CPC',
      level: '200',
      courseCode: 'CYB201',
      courseTitle: 'Cybersecurity',
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
      venue: 'Lab'
    }
  )
  assert.equal(timetableStudentWrite.status, 403)

  const timetableHodCrossDepartment = await requestRoute(
    '../routes/timetable',
    cseHod,
    'POST',
    '/',
    {
      deptCode: 'SE',
      facultyCode: 'CPC',
      level: '200',
      courseCode: 'SEN201',
      courseTitle: 'Software Engineering',
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
      venue: 'Lab'
    }
  )
  assert.equal(timetableHodCrossDepartment.status, 403)

  const timetableHodBadFaculty = await requestRoute(
    '../routes/timetable',
    cseHod,
    'POST',
    '/',
    {
      deptCode: 'CSE',
      facultyCode: 'MED',
      level: '200',
      courseCode: 'CYB201',
      courseTitle: 'Cybersecurity',
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '10:00',
      venue: 'Lab'
    }
  )
  assert.equal(timetableHodBadFaculty.status, 400)

  const timetableInvalidId = await requestRoute(
    '../routes/timetable',
    cseHod,
    'DELETE',
    '/not-an-object-id'
  )
  assert.equal(timetableInvalidId.status, 400)

  const announcementGlobalHod = await requestRoute(
    '../routes/announcements',
    cseHod,
    'POST',
    '/',
    { title: 'Test', body: 'Test', audience: 'all' }
  )
  assert.equal(announcementGlobalHod.status, 403)

  const announcementFacultyCrossDean = await requestRoute(
    '../routes/announcements',
    cpcDean,
    'POST',
    '/',
    { title: 'Test', body: 'Test', audience: 'faculty', facultyCode: 'MED' }
  )
  assert.equal(announcementFacultyCrossDean.status, 403)

  const announcementDepartmentCrossDean = await requestRoute(
    '../routes/announcements',
    cpcDean,
    'POST',
    '/',
    { title: 'Test', body: 'Test', audience: 'department', deptCode: 'MBBS' }
  )
  assert.equal(announcementDepartmentCrossDean.status, 403)

  const announcementLevelCrossDean = await requestRoute(
    '../routes/announcements',
    cpcDean,
    'POST',
    '/',
    { title: 'Test', body: 'Test', audience: 'level', deptCode: 'MBBS', level: '200' }
  )
  assert.equal(announcementLevelCrossDean.status, 403)

  const announcementInvalidId = await requestRoute(
    '../routes/announcements',
    cseHod,
    'DELETE',
    '/not-an-object-id'
  )
  assert.equal(announcementInvalidId.status, 400)

  const directoryStudentDenied = await requestRoute(
    '../routes/student-directory',
    cseStudent,
    'GET',
    '/'
  )
  assert.equal(directoryStudentDenied.status, 403)

  const directoryInvalidId = await requestRoute(
    '../routes/student-directory',
    cseHod,
    'GET',
    '/not-an-object-id'
  )
  assert.equal(directoryInvalidId.status, 400)

  const promoteNonSuperAdmin = await requestRoute(
    '../routes/admin',
    cseHod,
    'PATCH',
    '/users/507f1f77bcf86cd799439011/promote',
    { role: 'dean', facultyCode: 'CPC' }
  )
  assert.equal(promoteNonSuperAdmin.status, 403)

  const promoteInvalidId = await requestRoute(
    '../routes/admin',
    superAdmin,
    'PATCH',
    '/users/not-an-object-id/promote',
    { role: 'dean', facultyCode: 'CPC' }
  )
  assert.equal(promoteInvalidId.status, 400)
})
