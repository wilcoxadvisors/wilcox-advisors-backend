const nodemailer = require('nodemailer');

// Email transporter instance
let emailTransporter;

// Create email transporter
const createTransporter = () => {
  try {
    // Create a transporter with Gmail settings
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // For development environments
      }
    });
    
    // Verify the connection
    emailTransporter.verify(function(error, success) {
      if (error) {
        console.error('Email transporter verification failed:', error);
      } else {
        console.log('Email server is ready to take our messages');
      }
    });
  } catch (error) {
    console.error('Failed to create email transporter:', error);
  }
};

// Initialize the transporter
createTransporter();

// Helper function to send emails with fallback logging
const sendNotificationEmail = async (options) => {
  try {
    if (!emailTransporter) {
      createTransporter(); // Try to recreate transporter if it doesn't exist
    }
    
    const info = await emailTransporter.sendMail(options);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    
    // Log the email content for backup
    console.log('--- Email Content (Fallback) ---');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('Body:', options.html ? 'HTML Content' : options.text);
    console.log('--- End Email Content ---');
    
    return false;
  }
};

module.exports = { 
  sendNotificationEmail,
  createTransporter
};
