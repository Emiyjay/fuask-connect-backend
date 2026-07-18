const express = require('express')
const router = express.Router()

const Group = require('../models/Group')
const GroupMembership = require('../models/GroupMembership')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function canGenerateGroups(req, res, next) {
  if (!['lecturer', 'hod', 'dean', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Not authorized to create assignment groups' })
  }
  next()
}

router.get('/mine', protect, async (req, res) => {
  try {
    const memberships = await GroupMembership.find({ userId: req.user._id }).populate('groupId')
    const typeOrder = { school: 1, faculty: 2, department: 3, cohort: 4, sug: 5, course: 6, club: 7, assignment: 8, study: 9 }

    const groups = memberships
      .filter(m => m.groupId)
      .map(m => ({
        id: m.groupId._id,
        name: m.groupId.name,
        type: m.groupId.type,
        courseCode: m.groupId.courseCode || null,
        parentGroupId: m.groupId.parentGroupId || null,
        role: m.role,
        joinedAt: m.createdAt
      }))
      .sort((a, b) => (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99))

    res.status(200).json({ success: true, count: groups.length, data: groups })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch groups' })
  }
})

router.get('/clubs', protect, async (req, res) => {
  try {
    const clubs = await Group.find({ type: 'club', parentGroupId: null }).select('name description createdAt')
    res.status(200).json({ success: true, count: clubs.length, data: clubs })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch clubs' })
  }
})

router.post('/', protect, async (req, res) => {
  try {
    const { name, description, parentGroupId } = req.body
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Club name must be at least 3 characters' })
    }

    let parentGroup = null
    if (parentGroupId) {
      parentGroup = await Group.findById(parentGroupId)
      if (!parentGroup) {
        return res.status(404).json({ success: false, error: 'Parent group not found' })
      }
      if (parentGroup.type !== 'club') {
        return res.status(400).json({ success: false, error: 'Sub-groups can only be created under a club' })
      }
      const parentMembership = await GroupMembership.findOne({ groupId: parentGroupId, userId: req.user._id })
      if (!parentMembership) {
        return res.status(403).json({ success: false, error: 'You must be a member of the parent group to create a sub-group under it' })
      }
    }

    const existing = await Group.findOne({ type: 'club', name: name.trim(), parentGroupId: parentGroupId || null })
    if (existing) {
      return res.status(409).json({ success: false, error: 'A group with this name already exists here' })
    }

    const club = await Group.create({
      type: 'club',
      name: name.trim(),
      description: description || '',
      isPublic: true,
      parentGroupId: parentGroupId || null
    })

    await GroupMembership.create({ groupId: club._id, userId: req.user._id, role: 'admin' })

    res.status(201).json({
      success: true,
      message: parentGroupId ? `Sub-group created under ${parentGroup.name}` : 'Club created! You are the admin.',
      data: club
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to create club' })
  }
})

router.post('/course/join', protect, async (req, res) => {
  try {
    const { courseCode } = req.body
    if (!courseCode || courseCode.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'A valid course code is required' })
    }

    const cleanedCode = courseCode.trim().toUpperCase()

    let group = await Group.findOne({ type: 'course', courseCode: cleanedCode })
    if (!group) {
      group = await Group.create({
        type: 'course',
        name: `${cleanedCode} � Course Group`,
        courseCode: cleanedCode,
        isPublic: true
      })
    }

    const existing = await GroupMembership.findOne({ groupId: group._id, userId: req.user._id })
    if (existing) {
      return res.status(400).json({ success: false, error: 'You are already a member of this course group' })
    }

    const role = ['lecturer', 'hod', 'dean'].includes(req.user.role) ? 'admin' : 'member'
    await GroupMembership.create({ groupId: group._id, userId: req.user._id, role })

    res.status(200).json({ success: true, message: `You joined ${group.name}`, data: group })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to join course group' })
  }
})

router.post('/:id/join', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }
    if (group.type !== 'club' || !group.isPublic) {
      return res.status(403).json({ success: false, error: 'This group cannot be self-joined' })
    }

    if (group.parentGroupId) {
      const parentMembership = await GroupMembership.findOne({ groupId: group.parentGroupId, userId: req.user._id })
      if (!parentMembership) {
        const parentGroup = await Group.findById(group.parentGroupId)
        return res.status(403).json({
          success: false,
          error: `You must join ${parentGroup ? parentGroup.name : 'the parent group'} first before joining this sub-group`
        })
      }
    }

    const existing = await GroupMembership.findOne({ groupId: group._id, userId: req.user._id })
    if (existing) {
      return res.status(400).json({ success: false, error: 'You are already a member of this club' })
    }

    await GroupMembership.create({ groupId: group._id, userId: req.user._id, role: 'member' })

    res.status(200).json({ success: true, message: `You joined ${group.name}` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to join club' })
  }
})

router.post('/study', protect, async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Group name must be at least 3 characters' })
    }

    const group = await Group.create({
      type: 'study',
      name: name.trim(),
      description: description || '',
      createdBy: req.user._id,
      isPublic: false
    })

    await GroupMembership.create({ groupId: group._id, userId: req.user._id, role: 'admin' })

    res.status(201).json({ success: true, message: 'Study group created! You are the admin.', data: group })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to create study group' })
  }
})

router.post('/:id/invite', protect, async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Provide the email or matric number of the person to invite' })
    }

    const group = await Group.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }
    if (group.type !== 'study') {
      return res.status(403).json({ success: false, error: 'Invites are only supported for study groups' })
    }

    const membership = await GroupMembership.findOne({ groupId: group._id, userId: req.user._id })
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only the group admin can invite members' })
    }

    const cleaned = identifier.trim().toUpperCase()
    const invitedUser = await User.findOne({
      $or: [{ email: identifier.trim().toLowerCase() }, { matricNumber: cleaned }]
    })

    if (!invitedUser) {
      return res.status(404).json({ success: false, error: 'No user found with that email or matric number' })
    }

    const existing = await GroupMembership.findOne({ groupId: group._id, userId: invitedUser._id })
    if (existing) {
      return res.status(400).json({ success: false, error: 'This person is already in the group' })
    }

    await GroupMembership.create({ groupId: group._id, userId: invitedUser._id, role: 'member' })

    res.status(200).json({ success: true, message: `${invitedUser.displayName} was added to ${group.name}` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to invite member' })
  }
})

router.delete('/:id/leave', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }
    if (!['club', 'study', 'course'].includes(group.type)) {
      return res.status(403).json({ success: false, error: 'You cannot leave this type of group' })
    }

    const membership = await GroupMembership.findOne({ groupId: group._id, userId: req.user._id })
    if (!membership) {
      return res.status(400).json({ success: false, error: 'You are not a member of this group' })
    }

    await GroupMembership.deleteOne({ _id: membership._id })

    res.status(200).json({ success: true, message: `You left ${group.name}` })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to leave group' })
  }
})

router.post('/assignment/generate', protect, canGenerateGroups, async (req, res) => {
  try {
    const { courseCode, sourceGroupId, mode, value, title } = req.body

    if (!courseCode || !sourceGroupId || !mode || !value) {
      return res.status(400).json({
        success: false,
        error: 'courseCode, sourceGroupId, mode ("size" or "count"), and value are required'
      })
    }
    if (!['size', 'count'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'mode must be "size" or "count"' })
    }

    const sourceGroup = await Group.findById(sourceGroupId)
    if (!sourceGroup) {
      return res.status(404).json({ success: false, error: 'Source group not found' })
    }

    const memberships = await GroupMembership.find({ groupId: sourceGroupId }).populate('userId', 'displayName')
    const students = memberships.filter(m => m.userId).map(m => m.userId)

    if (students.length === 0) {
      return res.status(400).json({ success: false, error: 'Source group has no members to assign' })
    }

    const shuffled = shuffle(students)

    let numberOfGroups
    if (mode === 'size') {
      numberOfGroups = Math.ceil(shuffled.length / value)
    } else {
      numberOfGroups = value
    }
    if (numberOfGroups < 1) numberOfGroups = 1

    const buckets = Array.from({ length: numberOfGroups }, () => [])
    shuffled.forEach((student, index) => {
      buckets[index % numberOfGroups].push(student)
    })

    const createdGroups = []
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i]
      if (bucket.length === 0) continue

      const group = await Group.create({
        type: 'assignment',
        name: `${courseCode} � Group ${i + 1}`,
        courseCode,
        createdBy: req.user._id,
        parentGroupId: sourceGroupId,
        description: title || ''
      })

      await GroupMembership.insertMany(
        bucket.map(student => ({ groupId: group._id, userId: student._id, role: 'member' }))
      )

      createdGroups.push({
        id: group._id,
        name: group.name,
        members: bucket.map(s => ({ id: s._id, displayName: s.displayName }))
      })
    }

    res.status(201).json({
      success: true,
      message: `Generated ${createdGroups.length} groups for ${courseCode}`,
      data: createdGroups
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to generate assignment groups' })
  }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }

    const membership = await GroupMembership.findOne({ groupId: group._id, userId: req.user._id })
    const isCreator = group.createdBy && group.createdBy.toString() === req.user._id.toString()

    if (!membership && !isCreator && group.type !== 'club' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'You do not have access to this group' })
    }

    res.status(200).json({
      success: true,
      data: { ...group.toObject(), yourRole: membership ? membership.role : (isCreator ? 'creator' : null) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch group' })
  }
})

router.get('/:id/members', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }

    const membership = await GroupMembership.findOne({ groupId: group._id, userId: req.user._id })
    const isCreator = group.createdBy && group.createdBy.toString() === req.user._id.toString()

    if (!membership && !isCreator && group.type !== 'club' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'You do not have access to this group' })
    }

    const members = await GroupMembership.find({ groupId: group._id })
      .populate('userId', 'displayName role department level')

    const data = members
      .filter(m => m.userId)
      .map(m => ({
        id: m.userId._id,
        displayName: m.userId.displayName,
        userRole: m.userId.role,
        groupRole: m.role,
        department: m.userId.department,
        level: m.userId.level
      }))

    res.status(200).json({ success: true, count: data.length, data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch members' })
  }
})

module.exports = router
