const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Checklist = require('../models/checklist');
const { auth } = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/emailService');

// Submit checklist request and generate PDF
router.post('/', auth, async (req, res, next) => {
  try {
    const checklist = new Checklist({ 
      ...req.body, 
      userId: req.user?.id 
    });
    await checklist.save();
    
    // Create PDF directory if it doesn't exist
    const pdfDir = path.join(__dirname, '..', 'public', 'pdfs');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    
    // Generate unique filename
    const filename = `financial-checklist-${Date.now()}.pdf`;
    const pdfPath = path.join(pdfDir, filename);
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(pdfPath));
    
    // Add content to PDF
    doc.fontSize(25).text('Financial Checklist for Small Businesses', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Prepared for: ${req.body.name} (${req.body.companyName})`, { align: 'center' });
    doc.moveDown(2);
    
    // Add checklist items
    const checklistItems = [
      'Set up separate business bank accounts and credit cards',
      'Establish a reliable bookkeeping system',
      'Track all business expenses with proper documentation',
      'Create a realistic budget with monthly, quarterly, and annual projections',
      'Plan for taxes by setting aside appropriate funds',
      'Review financial statements monthly',
      'Reconcile accounts regularly',
      'Create a cash flow management system',
      'Establish proper invoicing and accounts receivable procedures',
      'Review pricing structure regularly to ensure profitability',
      'Build relationships with financial professionals',
      'Develop an emergency fund for unexpected expenses',
      'Consider insurance options to protect your business',
      'Plan for retirement and investment options',
      'Review financial goals quarterly and adjust as needed'
    ];
    
    checklistItems.forEach((item, index) => {
      doc.fontSize(12).text(`${index + 1}. ${item}`);
      doc.moveDown();
    });
    
    doc.moveDown();
    doc.fontSize(14).text('Need help implementing these steps?', { align: 'center' });
    doc.fontSize(14).text('Contact Wilcox Advisors for a free consultation!', { align: 'center' });
    
    doc.end();
    
    // Send checklist email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: req.body.email,
      subject: 'Your Financial Checklist - Wilcox Advisors',
      html: `
        <h2>Thank you for requesting our Financial Checklist!</h2>
        <p>Hello ${req.body.name},</p>
        <p>We've attached your personalized Small Business Financial Checklist. This document includes essential steps to help manage your business finances more effectively.</p>
        <p>If you have any questions or would like assistance implementing these steps, please don't hesitate to contact us for a free consultation.</p>
        <p>Regards,<br>The Wilcox Advisors Team</p>
      `,
      attachments: [
        {
          filename: 'Financial-Checklist.pdf',
          path: pdfPath
        }
      ]
    };
    
    // Non-blocking email sending
    sendNotificationEmail(mailOptions).catch(error => {
      console.error('Failed to send checklist email:', error);
    });
    
    // Send notification email
    const notificationOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: 'New Checklist Request - Wilcox Advisors',
      html: `
        <h2>New Checklist Request</h2>
        <p><strong>Name:</strong> ${req.body.name}</p>
        <p><strong>Email:</strong> ${req.body.email}</p>
        <p><strong>Company:</strong> ${req.body.companyName}</p>
        <p><strong>Revenue Range:</strong> ${req.body.revenueRange}</p>
      `
    };
    
    // Non-blocking email sending
    sendNotificationEmail(notificationOptions).catch(error => {
      console.error('Failed to send checklist notification email:', error);
    });
    
    res.status(201).json({ message: 'Checklist sent to your email' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
