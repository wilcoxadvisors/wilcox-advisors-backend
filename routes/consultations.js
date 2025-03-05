const express = require('express');
const router = express.Router();
const Consultation = require('../models/consultation');
const { auth } = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/emailService');

// Submit consultation request
router.post('/', auth, async (req, res, next) => {
  try {
    const consultation = new Consultation({ 
      ...req.body, 
      userId: req.user?.id 
    });
    await consultation.save();
    
    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: 'New Consultation Request - Wilcox Advisors',
      html: `
        <h2>New Consultation Request</h2>
        <p><strong>Company:</strong> ${req.body.companyName}</p>
        <p><strong>Industry:</strong> ${req.body.industry}</p>
        <p><strong>Years in Business:</strong> ${req.body.yearsInBusiness}</p>
        <p><strong>Revenue Range:</strong> ${req.body.revenueRange}</p>
        <p><strong>Services:</strong> ${req.body.services.join(', ')}</p>
        <p><strong>Contact:</strong> ${req.body.contactName}</p>
        <p><strong>Email:</strong> ${req.body.email}</p>
        <p><strong>Phone:</strong> ${req.body.phone || 'Not provided'}</p>
        <p><strong>Preferred Contact:</strong> ${req.body.preferredContact}</p>
        <p><strong>Best Time:</strong> ${req.body.preferredTime}</p>
        <p><strong>Notes:</strong> ${req.body.notes || 'None'}</p>
      `
    };
    
    // Non-blocking email sending
    sendNotificationEmail(mailOptions).catch(error => {
      console.error('Failed to send consultation notification email:', error);
    });
    
    res.status(201).json({ message: 'Consultation submitted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
