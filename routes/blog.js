const express = require('express');
const router = express.Router();
const Blog = require('../models/blog');
const { adminAuth } = require('../middleware/auth');

// Get published blog posts
router.get('/', async (req, res, next) => {
  try {
    const posts = await Blog.find({ isDraft: false }).sort({ timestamp: -1 });
    res.json(posts);
  } catch (error) {
    next(error);
  }
});

// Create blog post (admin only)
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const blog = new Blog({ ...req.body });
    await blog.save();
    res.status(201).json({ 
      message: 'Blog post created successfully',
      blog
    });
  } catch (error) {
    next(error);
  }
});

// Update blog post (admin only)
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
    next(error);
  }
});

// Delete blog post (admin only)
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    
    if (!deletedBlog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
