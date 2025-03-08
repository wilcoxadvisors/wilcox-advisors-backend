// routes/blog.js
const express = require('express');
const router = express.Router();
const Blog = require('../models/blog');
const { adminAuth } = require('../middleware/auth');

/**
 * @route   GET /api/blog
 * @desc    Get all published blog posts
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    // Find all published blog posts
    const posts = await Blog.find({ isDraft: false }).sort({ timestamp: -1 });
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    next(error);
  }
});

/**
 * @route   POST /api/blog
 * @desc    Create a new blog post
 * @access  Admin only
 */
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const blog = new Blog({ ...req.body });
    await blog.save();
    
    res.status(201).json({ 
      message: 'Blog post created successfully',
      blog
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    next(error);
  }
});

/**
 * @route   PUT /api/blog/:id
 * @desc    Update a blog post
 * @access  Admin only
 */
router.put('/:id', adminAuth, async (req, res, next) => {
  try {
    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    
    if (!updatedBlog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    res.json({ 
      message: 'Blog post updated successfully',
      blog: updatedBlog
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    next(error);
  }
});

/**
 * @route   DELETE /api/blog/:id
 * @desc    Delete a blog post
 * @access  Admin only
 */
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    
    if (!deletedBlog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    next(error);
  }
});

module.exports = router;
