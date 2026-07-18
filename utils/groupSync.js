const Group = require('../models/Group')
const GroupMembership = require('../models/GroupMembership')

async function findOrCreateGroup(filter, groupData) {
  let group = await Group.findOne(filter)
  if (!group) {
    group = await Group.create(groupData)
  }
  return group
}

async function joinGroup(userId, groupId, role = 'member') {
  const exists = await GroupMembership.findOne({ userId, groupId })
  if (exists) return exists
  return GroupMembership.create({ userId, groupId, role })
}

async function syncStudentGroups(user) {
  const schoolGroup = await findOrCreateGroup(
    { type: 'school' },
    { type: 'school', name: 'FUASK Campus-Wide' }
  )
  await joinGroup(user._id, schoolGroup._id, 'member')

  const facultyGroup = await findOrCreateGroup(
    { type: 'faculty', facultyCode: user.facultyCode },
    { type: 'faculty', facultyCode: user.facultyCode, name: user.faculty, parentGroupId: schoolGroup._id }
  )
  await joinGroup(user._id, facultyGroup._id, 'member')

  const deptGroup = await findOrCreateGroup(
    { type: 'department', deptCode: user.deptCode },
    { type: 'department', deptCode: user.deptCode, facultyCode: user.facultyCode, name: user.department, parentGroupId: facultyGroup._id }
  )
  await joinGroup(user._id, deptGroup._id, 'member')

  const cohortGroup = await findOrCreateGroup(
    { type: 'cohort', deptCode: user.deptCode, enrollmentYear: user.enrollmentYear },
    {
      type: 'cohort',
      deptCode: user.deptCode,
      facultyCode: user.facultyCode,
      enrollmentYear: user.enrollmentYear,
      name: `${user.department} ${user.enrollmentYear} Set`,
      parentGroupId: deptGroup._id
    }
  )
  await joinGroup(user._id, cohortGroup._id, 'member')

  return { schoolGroup, facultyGroup, deptGroup, cohortGroup }
}

async function syncStaffGroups(user) {
  const schoolGroup = await findOrCreateGroup(
    { type: 'school' },
    { type: 'school', name: 'FUASK Campus-Wide' }
  )
  const schoolRole = ['dpr', 'super_admin'].includes(user.role) ? 'admin' : 'member'
  await joinGroup(user._id, schoolGroup._id, schoolRole)

  if (user.role === 'dpr' || user.role === 'super_admin') {
    return
  }
  if (user.role === 'sug') {
    const sugGroup = await findOrCreateGroup(
      { type: 'sug' },
      { type: 'sug', name: 'FUASK SUG', parentGroupId: schoolGroup._id }
    )
    await joinGroup(user._id, sugGroup._id, 'admin')
    return
  }

  if (['dean', 'hod', 'lecturer'].includes(user.role)) {
    const facultyGroup = await findOrCreateGroup(
      { type: 'faculty', facultyCode: user.facultyCode },
      { type: 'faculty', facultyCode: user.facultyCode, name: user.faculty, parentGroupId: schoolGroup._id }
    )
    await joinGroup(user._id, facultyGroup._id, user.role === 'dean' ? 'oversight' : 'member')

    if (user.role === 'hod' || user.role === 'lecturer') {
      const deptGroup = await findOrCreateGroup(
        { type: 'department', deptCode: user.deptCode },
        { type: 'department', deptCode: user.deptCode, facultyCode: user.facultyCode, name: user.department, parentGroupId: facultyGroup._id }
      )
      await joinGroup(user._id, deptGroup._id, user.role === 'hod' ? 'admin' : 'member')
    }
  }
}

module.exports = { syncStudentGroups, syncStaffGroups, findOrCreateGroup, joinGroup }
