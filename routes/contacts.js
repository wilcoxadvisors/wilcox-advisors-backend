const express = require('express');
const router = express.Router();
const Contact = require('../models/contact');
const { auth } = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/emailService');

// Submit contact form
router.post('/', auth, async (req, res, next) => {
  try {
    const contact = new Contact({ 
      ...req.body, 
      userId: req.user?.id 
    });
    await contact.save();
    
    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: 'New Contact Form Submission - Wilcox Advisors',
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${req.body.name}</p>
        <p><strong>Email:</strong> ${req.body.email}</p>
        <p><strong>Company:</strong> ${req.body.company}</p>
        <p><strong>Message:</strong> ${req.body.message}</p>
      `
    };
    
    // Non-blocking email sending
    sendNotificationEmail(mailOptions).catch(error => {
      console.error('Failed to send contact form notification email:', error);
    });
    
    res.status(201).json({ message: 'Contact form submitted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
