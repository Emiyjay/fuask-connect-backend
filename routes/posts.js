const express = require('express')
const router = express.Router()

const Post = require('../models/Post')
const Comment = require('../models/Comment')
const Group = require('../models/Group')
const GroupMembership = require('../models/GroupMembership')
const { protect } = require('../middleware/auth')
const { uploadFields } = require('../middleware/upload')

const RESTRICTED_GROUP_TYPES = ['school', 'faculty', 'department', 'sug']

async function getGroupAccess(groupId, userId, userRole) {
  const group = await Group.findById(groupId)
  if (!group) return { group: null }

  const membership = await GroupMembership.findOne({ groupId, userId })
  const isSuperAdmin = userRole === 'super_admin'

  const canView = !!membership || isSuperAdmin || (group.type === 'club' && group.isPublic)
  const canPost = !!membership && (
    RESTRICTED_GROUP_TYPES.includes(group.type)
      ? ['admin', 'oversight'].includes(membership.role)
      : true
  )
  const canModerate = isSuperAdmin || (membership && ['admin', 'oversight'].includes(membership.role))

  return { group, membership, canView, canPost, canModerate }
}

router.post('/', protect, ...uploadFields('media', 'fuask-connect/posts', 5), async (req, res) => {
  try {
    const { groupId, content } = req.body
    if (!groupId || !content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'groupId and content are required' })
    }

    const { group, canPost } = await getGroupAccess(groupId, req.user._id, req.user.role)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }
    if (!canPost) {
      return res.status(403).json({ success: false, error: 'You are not authorized to post in this group' })
    }

    const media = (req.uploadedFiles || []).map(f => ({ url: f.url, type: f.type }))

    const post = await Post.create({ groupId, authorId: req.user._id, content: content.trim(), media })

    res.status(201).json({ success: true, data: post })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to create post' })
  }
})

router.get('/group/:groupId', protect, async (req, res) => {
  try {
    const { group, canView } = await getGroupAccess(req.params.groupId, req.user._id, req.user.role)
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' })
    }
    if (!canView) {
      return res.status(403).json({ success: false, error: 'You do not have access to this group' })
    }

    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 50)
    const skip = (page - 1) * limit

    const posts = await Post.find({ groupId: req.params.groupId })
      .populate('authorId', 'displayName role department')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Post.countDocuments({ groupId: req.params.groupId })

    const data = posts.map(p => ({
      id: p._id,
      content: p.content,
      media: p.media,
      isPinned: p.isPinned,
      likeCount: p.likes.length,
      likedByMe: p.likes.some(id => id.toString() === req.user._id.toString()),
      author: p.authorId,
      createdAt: p.createdAt
    }))

    res.status(200).json({ success: true, page, limit, total, totalPages: Math.ceil(total / limit), data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch posts' })
  }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('authorId', 'displayName role department')
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' })
    }

    const { canView } = await getGroupAccess(post.groupId, req.user._id, req.user.role)
    if (!canView) {
      return res.status(403).json({ success: false, error: 'You do not have access to this post' })
    }

    res.status(200).json({
      success: true,
      data: {
        id: post._id,
        content: post.content,
        media: post.media,
        isPinned: post.isPinned,
        likeCount: post.likes.length,
        likedByMe: post.likes.some(id => id.toString() === req.user._id.toString()),
        author: post.authorId,
        createdAt: post.createdAt
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch post' })
  }
})

router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' })
    }

    const isAuthor = post.authorId.toString() === req.user._id.toString()
    const { canModerate } = await getGroupAccess(post.groupId, req.user._id, req.user.role)

    if (!isAuthor && !canModerate) {
      return res.status(403).json({ success: false, error: 'You cannot delete this post' })
    }
    if (post.isPinned && !canModerate) {
      return res.status(403).json({ success: false, error: 'Only a group admin can delete a pinned post' })
    }

    await Comment.deleteMany({ postId: post._id })
    await Post.deleteOne({ _id: post._id })

    res.status(200).json({ success: true, message: 'Post deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to delete post' })
  }
})

router.patch('/:id/pin', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' })
    }

    const { canModerate } = await getGroupAccess(post.groupId, req.user._id, req.user.role)
    if (!canModerate) {
      return res.status(403).json({ success: false, error: 'Only a group admin can pin or unpin a post' })
    }

    post.isPinned = !post.isPinned
    await post.save()

    res.status(200).json({ success: true, message: post.isPinned ? 'Post pinned' : 'Post unpinned', data: post })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to update post' })
  }
})

router.post('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' })
    }

    const { canView } = await getGroupAccess(post.groupId, req.user._id, req.user.role)
    if (!canView) {
      return res.status(403).json({ success: false, error: 'You do not have access to this post' })
    }

    const alreadyLiked = post.likes.some(id => id.toString() === req.user._id.toString())
    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString())
    } else {
      post.likes.push(req.user._id)
    }
    await post.save()

    res.status(200).json({ success: true, liked: !alreadyLiked, likeCount: post.likes.length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to like post' })
  }
})

router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Comment content is required' })
    }

    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' })
    }

    const { canView } = await getGroupAccess(post.groupId, req.user._id, req.user.role)
    if (!canView) {
      return res.status(403).json({ success: false, error: 'You do not have access to this post' })
    }

    const comment = await Comment.create({ postId: post._id, authorId: req.user._id, content: content.trim() })
    await comment.populate('authorId', 'displayName role department')

    res.status(201).json({ success: true, data: comment })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to add comment' })
  }
})

router.get('/:id/comments', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' })
    }

    const { canView } = await getGroupAccess(post.groupId, req.user._id, req.user.role)
    if (!canView) {
      return res.status(403).json({ success: false, error: 'You do not have access to this post' })
    }

    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 30, 100)
    const skip = (page - 1) * limit

    const comments = await Comment.find({ postId: post._id })
      .populate('authorId', 'displayName role department')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)

    const total = await Comment.countDocuments({ postId: post._id })

    res.status(200).json({ success: true, page, limit, total, totalPages: Math.ceil(total / limit), data: comments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to fetch comments' })
  }
})

router.delete('/comments/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId)
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' })
    }

    const post = await Post.findById(comment.postId)
    const isAuthor = comment.authorId.toString() === req.user._id.toString()
    const { canModerate } = post ? await getGroupAccess(post.groupId, req.user._id, req.user.role) : { canModerate: false }

    if (!isAuthor && !canModerate) {
      return res.status(403).json({ success: false, error: 'You cannot delete this comment' })
    }

    await Comment.deleteOne({ _id: comment._id })

    res.status(200).json({ success: true, message: 'Comment deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, error: 'Failed to delete comment' })
  }
})

module.exports = router
