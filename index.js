const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();
const app = express();

// Middle ware
// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: 'https://vocal-daffodil-cc98bd.netlify.app'
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// xAI (Grok) Setup
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY, // New environment variable for xAI
  base_url: "https://api.x.ai/v1", // xAI API endpoint
});

// Models
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

const ConsultationSchema = new mongoose.Schema({
  userId: String,
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
  userId: String,
  name: String,
  email: String,
  companyName: String,
  revenueRange: String,
  timestamp: { type: Date, default: Date.now },
});
const Checklist = mongoose.model('Checklist', ChecklistSchema);

const ContactSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  company: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});
const Contact = mongoose.model('Contact', ContactSchema);

const ChatSchema = new mongoose.Schema({
  userId: String,
  message: String,
  reply: String,
  isClientChat: Boolean,
  timestamp: { type: Date, default: Date.now },
});
const Chat = mongoose.model('Chat', ChatSchema);

const FileSchema = new mongoose.Schema({
  userId: String,
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
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
    res.status(201).json({ message: 'Checklist request submitted' });
  } catch (error) {
    console.error('Checklist submission error:', error);
    res.status(500).json({ message: 'Failed to submit checklist request' });
  }
});

app.post('/api/contact', auth, async (req, res) => {
  try {
    const contact = new Contact({ ...req.body, userId: req.user?.id });
    await contact.save();
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
        if (error.name === 'TokenExpiredError') {
          console.warn('Expired token, proceeding as guest:', error.message);
        } else {
          console.warn('Invalid token, proceeding as guest:', error.message);
        }
      }
    }
    const completion = await openai.chat.completions.create({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: 'You are Grok, a chatbot acting as an assistant for Wilcox Advisors, a financial services provider specializing in small businesses. Your responses must be concise, professional, and strictly limited to information about Wilcox Advisors’ website and services, including Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, and Outsourced Controller/CFO Services. Do not provide free detailed advice or general knowledge outside these services. Encourage users to schedule a consultation for specific guidance or detailed information.'
        },
        {
          role: 'user',
          content: `Respond to: "${message}" with a concise answer focused only on Wilcox Advisors’ services and website. Avoid free detailed advice and suggest a consultation if the user seeks specifics.`
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
        if (error.name === 'TokenExpiredError') {
          console.warn('Expired token, proceeding as guest:', error.message);
        } else {
          console.warn('Invalid token, proceeding as guest:', error.message);
        }
      }
    }
    const completion = await openai.chat.completions.create({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'system',
          content: 'You are Grok, a chatbot acting as an assistant for Wilcox Advisors, a financial services provider specializing in small businesses. Your responses must be concise, professional, and strictly limited to information about Wilcox Advisors’ website and services, including Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, and Outsourced Controller/CFO Services. Do not provide free detailed advice or general knowledge outside these services. Suggest a consultation for specific guidance or detailed information.'
        },
        {
          role: 'user',
          content: `Respond to: "${message}" with a concise answer focused only on Wilcox Advisors’ services and website. Avoid free detailed advice and recommend a consultation for specifics.`
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
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Generate a blog post draft for Wilcox Advisors, focusing on our services (Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, Outsourced Controller/CFO Services) based on: ${trends}. Keep it relevant to our business and customer questions.`,
        },
      ],
      max_tokens: 500,
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

// Server Startup
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
