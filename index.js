const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();

// Middleware
// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: 'https://vocal-daffodil-cc98bd.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Improved Email Configuration
let emailTransporter;

// Function to create a nodemailer transporter with error handling
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

// Initialize the email transporter
createTransporter();

// Helper function to send emails with fallback logging
async function sendNotificationEmail(options) {
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
}

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// xAI (Grok) Setup
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY, // Use xAI API key from environment
  baseURL: "https://api.x.ai/v1", // xAI API endpoint
});

// Models
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

const ConsultationSchema = new mongoose.Schema({
  userId: String, // Optional for guests
  companyName: String,
  industry: String,
  yearsInBusiness: String,
  revenueRange: String,
  services: [String],
  contactName: String,
  email: String,
  phone: String,
  preferredContact: String,
  preferredTime: String,
  notes: String,
  timestamp: { type: Date, default: Date.now },
});
const Consultation = mongoose.model('Consultation', ConsultationSchema);

const ChecklistSchema = new mongoose.Schema({
  userId: String, // Optional for guests
  name: String,
  email: String,
  companyName: String,
  revenueRange: String,
  timestamp: { type: Date, default: Date.now },
});
const Checklist = mongoose.model('Checklist', ChecklistSchema);

const ContactSchema = new mongoose.Schema({
  userId: String, // Optional for guests
  name: String,
  email: String,
  company: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});
const Contact = mongoose.model('Contact', ContactSchema);

const ChatSchema = new mongoose.Schema({
  userId: String, // Can be null for guest chats
  message: String,
  reply: String,
  isClientChat: Boolean,
  timestamp: { type: Date, default: Date.now },
});
const Chat = mongoose.model('Chat', ChatSchema);

const FileSchema = new mongoose.Schema({
  userId: String, // Required for authenticated users only
  fileName: String,
  s3Key: String,
  timestamp: { type: Date, default: Date.now },
});
const File = mongoose.model('File', FileSchema);

const BlogSchema = new mongoose.Schema({
  title: String,
  content: String,
  isDraft: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now },
});
const Blog = mongoose.model('Blog', BlogSchema);

const ContentSchema = new mongoose.Schema({
  section: String,
  value: mongoose.Mixed,
  timestamp: { type: Date, default: Date.now },
});
const Content = mongoose.model('Content', ContentSchema);

// Authentication Middleware
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token && req.method !== 'POST') return res.status(401).json({ message: 'Unauthorized' });
  try {
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Multer Setup for File Uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' }); // Extended to 24 hours
    res.json({ token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ message: 'Signup failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '24h' }); // Extended to 24 hours
    res.json({ token, isAdmin: user.isAdmin });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/consultation', auth, async (req, res) => {
  try {
    const consultation = new Consultation({ ...req.body, userId: req.user?.id });
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
    console.error('Consultation submission error:', error);
    res.status(500).json({ message: 'Failed to submit consultation' });
  }
});

app.post('/api/checklist', auth, async (req, res) => {
  try {
    const checklist = new Checklist({ ...req.body, userId: req.user?.id });
    await checklist.save();
    
    // Create PDF directory if it doesn't exist
    const pdfDir = path.join(__dirname, 'public', 'pdfs');
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
    console.error('Checklist submission error:', error);
    res.status(500).json({ message: 'Failed to submit checklist request' });
  }
});

app.post('/api/contact', auth, async (req, res) => {
  try {
    const contact = new Contact({ ...req.body, userId: req.user?.id });
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
    console.error('Contact form submission error:', error);
    res.status(500).json({ message: 'Failed to submit contact form' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const token = req.headers['authorization']?.split(' ')[1]; // Optionally check for token
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id; // Use user ID if valid
      } catch (error) {
        if (error.name !== 'TokenExpiredError') { // Only log non-expiration errors
          console.warn('Invalid token, proceeding as guest:', error.message);
        }
      }
    }
    const completion = await openai.chat.completions.create({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: "You are Grok, a chatbot acting as an assistant for Wilcox Advisors, a financial services provider specializing in small businesses. Your responses must be concise, professional, and strictly limited to information about Wilcox Advisors' website and services, including Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, and Outsourced Controller/CFO Services. Do not provide free detailed advice or general knowledge outside these services. Encourage users to schedule a consultation for specific guidance or detailed information."
        },
        {
          role: 'user',
          content: `Respond to: "${message}" with a concise answer focused only on Wilcox Advisors' services and website. Avoid free detailed advice and suggest a consultation if the user seeks specifics.`
        },
      ],
      stream: false,
      max_tokens: 100,
      temperature: 0,
    });
    const reply = completion.choices[0].message.content.trim();
    const chat = new Chat({ message, reply, userId, isClientChat: false });
    await chat.save();
    res.json({ reply });
  } catch (error) {
    console.error('xAI API error in /api/chat:', error);
    res.status(500).json({ message: 'Failed to get response from AI' });
  }
});

app.post('/api/client/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const token = req.headers['authorization']?.split(' ')[1]; // Optionally check for token
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id; // Use user ID if valid
      } catch (error) {
        if (error.name !== 'TokenExpiredError') { // Only log non-expiration errors
          console.warn('Invalid token, proceeding as guest:', error.message);
        }
      }
    }
    const completion = await openai.chat.completions.create({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: "You are Grok, a chatbot acting as an assistant for Wilcox Advisors, a financial services provider specializing in small businesses. Your responses must be concise, professional, and strictly limited to information about Wilcox Advisors' website and services, including Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, and Outsourced Controller/CFO Services. Do not provide free detailed advice or general knowledge outside these services. Suggest a consultation for specific guidance or detailed information."
        },
        {
          role: 'user',
          content: `Respond to: "${message}" with a concise answer focused only on Wilcox Advisors' services and website. Avoid free detailed advice and recommend a consultation for specifics.`
        },
      ],
      stream: false,
      max_tokens: 100,
      temperature: 0,
    });
    const reply = completion.choices[0].message.content.trim();
    const chat = new Chat({ message, reply, userId, isClientChat: true });
    await chat.save();
    res.json({ reply });
  } catch (error) {
    console.error('xAI API error in /api/client/chat:', error);
    res.status(500).json({ message: 'Failed to get response from AI' });
  }
});

app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${req.user.id}/${Date.now()}-${req.file.originalname}`,
    Body: req.file.buffer,
  };
  try {
    const result = await s3.upload(params).promise();
    const file = new File({ userId: req.user.id, fileName: req.file.originalname, s3Key: result.Key });
    await file.save();
    res.status(201).json({ message: 'File uploaded' });
  } catch (error) {
    console.error('S3 upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
});

app.get('/api/client/dashboard', auth, async (req, res) => {
  try {
    const clientChat = await Chat.find({ userId: req.user.id, isClientChat: true });
    res.json({
      financials: { profitLoss: { revenue: 50000, expenses: 30000, netIncome: 20000 }, balanceSheet: { assets: 100000, liabilities: 40000, equity: 60000 } },
      cashFlow: { labels: ['Jan', 'Feb', 'Mar'], data: [10000, 15000, 12000] },
      reports: ['Sales by Category', 'Expense Breakdown'],
      gl: [{ date: '2025-02-01', description: 'Sales', amount: 5000 }],
      clientChat,
    });
  } catch (error) {
    console.error('Error fetching client dashboard:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
});

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const consultations = await Consultation.find();
    const checklists = await Checklist.find();
    const contacts = await Contact.find();
    const chats = await Chat.find();
    const files = await File.find();

    const trends = `Latest trends: High interest in ${consultations.map(c => c.services).flat().reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {})} Customer questions: ${chats.map(c => c.message).join(', ')}.`;
    const blogDraft = await openai.chat.completions.create({
      model: 'grok-2-latest', // Updated to use xAI's Grok model
      messages: [
        {
          role: 'user',
          content: `Generate a blog post draft for Wilcox Advisors, focusing on our services (Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, Outsourced Controller/CFO Services) based on: ${trends}. Keep it relevant to our business and customer questions.`,
        },
      ],
      max_tokens: 500,
      temperature: 0, // Deterministic for consistency
    }).then(res => ({ title: 'Latest Financial Insights for Your Business', content: res.choices[0].message.content.trim() }));

    const heroContent = (await Content.findOne({ section: 'hero' })) || { section: 'hero', value: { headline: 'Financial Solutions for Small Businesses', subtext: 'Wilcox Advisors helps small businesses like yours grow smarter with tailored financial expertise.' } };
    const aboutContent = (await Content.findOne({ section: 'about' })) || { section: 'about', value: 'At Wilcox Advisors, we specialize in financial solutions for small businesses. From startups to growing companies, we provide the expertise you need to succeed—built to scale with you every step of the way.' };

    res.json({
      blogDrafts: [blogDraft],
      hero: heroContent.value,
      about: aboutContent.value,
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ message: 'Failed to load admin dashboard' });
  }
});

app.post('/api/admin/content', adminAuth, async (req, res) => {
  const { section, value } = req.body;
  try {
    await Content.findOneAndUpdate({ section }, { section, value }, { upsert: true });
    res.json({ message: 'Content updated' });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ message: 'Failed to update content' });
  }
});

app.get('/api/blog', async (req, res) => {
  try {
    const posts = await Blog.find({ isDraft: false });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ message: 'Failed to load blog posts' });
  }
});

app.post('/api/blog', adminAuth, async (req, res) => {
  try {
    const blog = new Blog({ ...req.body, isDraft: false });
    await blog.save();
    res.status(201).json({ message: 'Blog posted' });
  } catch (error) {
    console.error('Error posting blog:', error);
    res.status(500).json({ message: 'Failed to post blog' });
  }
});

app.put('/api/blog/:id', adminAuth, async (req, res) => {
  try {
    await Blog.findByIdAndUpdate(req.params.id, { ...req.body, isDraft: false });
    res.json({ message: 'Blog updated' });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ message: 'Failed to update blog' });
  }
});

// Serve static files
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdfs')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Server Startup
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
