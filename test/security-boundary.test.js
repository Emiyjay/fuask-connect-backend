const test = require('node:test')
const assert = require('node:assert/strict')

const User = require('../models/User')
const {
  getDepartmentByCode,
  getFacultyByCode,
  isValidDepartmentFacultyPair
} = require('../utils/validateMatric')

function baseUser(role, overrides = {}) {
  return new User({
    matricNumber: role === 'student' ? 'FUAS/CPC/CSE/24/0001' : undefined,
    phoneNumber: role === 'student' ? undefined : '08012345678',
    email: `${role}@example.com`,
    passwordHash: 'test-hash',
    displayName: 'Test User',
    department: 'Cyber Security',
    faculty: 'Faculty of Computing and Communication',
    facultyCode: 'CPC',
    deptCode: 'CSE',
    role,
    ...overrides
  })
}

test('department lookup is canonical and normalized', () => {
  const department = getDepartmentByCode(' cse ')
  assert.deepEqual(department, {
    deptCode: 'CSE',
    department: 'Cyber Security',
    faculty: 'Faculty of Computing and Communication',
    facultyCode: 'CPC',
    duration: 4
  })
  assert.equal(getDepartmentByCode('UNKNOWN'), null)
})

test('faculty lookup is canonical and normalized', () => {
  assert.deepEqual(getFacultyByCode(' cpc '), {
    facultyCode: 'CPC',
    faculty: 'Faculty of Computing and Communication'
  })
  assert.equal(getFacultyByCode('UNKNOWN'), null)
})

test('department and faculty pair must match canonically', () => {
  assert.equal(isValidDepartmentFacultyPair('CSE', 'CPC'), true)
  assert.equal(isValidDepartmentFacultyPair('CSE', 'MED'), false)
  assert.equal(isValidDepartmentFacultyPair('UNKNOWN', 'CPC'), false)
})

test('student scope fields remain required', () => {
  const user = baseUser('student', {
    deptCode: undefined,
    facultyCode: undefined
  })
  assert.ok(user.validateSync().errors.deptCode)
  assert.ok(user.validateSync().errors.facultyCode)
})

test('lecturer and HOD require department and faculty scope', () => {
  for (const role of ['lecturer', 'hod']) {
    const user = baseUser(role, {
      deptCode: undefined,
      facultyCode: undefined
    })
    const errors = user.validateSync().errors
    assert.ok(errors.deptCode, role)
    assert.ok(errors.facultyCode, role)
  }
})

test('Dean requires faculty scope but not department scope', () => {
  const user = baseUser('dean', {
    department: undefined,
    deptCode: undefined,
    faculty: 'Faculty of Computing and Communication',
    facultyCode: 'CPC'
  })
  const errors = user.validateSync().errors
  assert.equal(errors.department, undefined)
  assert.equal(errors.deptCode, undefined)
  assert.equal(errors.facultyCode, undefined)
  assert.equal(errors.faculty, undefined)
})

test('non-scoped staff roles do not require department or faculty scope', () => {
  for (const role of ['sug', 'dpr', 'super_admin']) {
    const user = baseUser(role, {
      department: undefined,
      faculty: undefined,
      facultyCode: undefined,
      deptCode: undefined
    })
    const errors = user.validateSync().errors
    assert.equal(errors.department, undefined, role)
    assert.equal(errors.faculty, undefined, role)
    assert.equal(errors.facultyCode, undefined, role)
    assert.equal(errors.deptCode, undefined, role)
  }
})
