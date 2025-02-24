const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai'); // Updated import for OpenAI v4.x.x

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// AWS S3 Setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

// OpenAI Setup (updated for v4.x.x)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Middleware
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

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(400).json({ message: 'Signup failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, isAdmin: user.isAdmin });
});

app.post('/api/consultation', auth, async (req, res) => {
  const consultation = new Consultation({ ...req.body, userId: req.user?.id });
  await consultation.save();
  res.status(201).json({ message: 'Consultation submitted' });
});

app.post('/api/checklist', auth, async (req, res) => {
  const checklist = new Checklist({ ...req.body, userId: req.user?.id });
  await checklist.save();
  res.status(201).json({ message: 'Checklist request submitted' });
});

app.post('/api/contact', auth, async (req, res) => {
  const contact = new Contact({ ...req.body, userId: req.user?.id });
  await contact.save();
  res.status(201).json({ message: 'Contact form submitted' });
});

app.post('/api/chat', auth, async (req, res) => {
  const { message } = req.body;
  const reply = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `You are an assistant for Wilcox Advisors, a financial services provider for small businesses. Respond to: "${message}" with a concise answer relevant to our services (Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, Outsourced Controller/CFO Services), avoiding free detailed advice. Encourage a consultation if needed.`,
    max_tokens: 100,
  }).then(res => res.choices[0].text.trim());
  const chat = new Chat({ message, reply, userId: req.user?.id, isClientChat: false });
  await chat.save();
  res.json({ reply });
});

app.post('/api/client/chat', auth, async (req, res) => {
  const { message } = req.body;
  const reply = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `You are an assistant for Wilcox Advisors, a financial services provider for small businesses. Respond to: "${message}" with a concise answer relevant to our services (Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, Outsourced Controller/CFO Services). Avoid giving free detailed advice; suggest a consultation for specifics.`,
    max_tokens: 100,
  }).then(res => res.choices[0].text.trim());
  const chat = new Chat({ message, reply, userId: req.user.id, isClientChat: true });
  await chat.save();
  res.json({ reply });
});

app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${req.user.id}/${Date.now()}-${req.file.originalname}`,
    Body: req.file.buffer,
  };
  const result = await s3.upload(params).promise();
  const file = new File({ userId: req.user.id, fileName: req.file.originalname, s3Key: result.Key });
  await file.save();
  res.status(201).json({ message: 'File uploaded' });
});

app.get('/api/client/dashboard', auth, async (req, res) => {
  const clientChat = await Chat.find({ userId: req.user.id, isClientChat: true });
  res.json({
    financials: { profitLoss: { revenue: 50000, expenses: 30000, netIncome: 20000 }, balanceSheet: { assets: 100000, liabilities: 40000, equity: 60000 } },
    cashFlow: { labels: ['Jan', 'Feb', 'Mar'], data: [10000, 15000, 12000] },
    reports: ['Sales by Category', 'Expense Breakdown'],
    gl: [{ date: '2025-02-01', description: 'Sales', amount: 5000 }],
    clientChat,
  });
});

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  const consultations = await Consultation.find();
  const checklists = await Checklist.find();
  const contacts = await Contact.find();
  const chats = await Chat.find();
  const files = await File.find();

  const trends = `Latest trends: High interest in ${consultations.map(c => c.services).flat().reduce((acc, curr) => { acc[curr] = (acc[curr] || 0) + 1; return acc; }, {})} Customer questions: ${chats.map(c => c.message).join(', ')}.`;
  const blogDraft = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `Generate a blog post draft for Wilcox Advisors, focusing on our services (Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, Outsourced Controller/CFO Services) based on: ${trends}. Keep it relevant to our business and customer questions.`,
    max_tokens: 500,
  }).then(res => ({ title: `Latest Financial Insights for Your Business`, content: res.choices[0].text.trim() }));

  const heroContent = await Content.findOne({ section: 'hero' }) || { section: 'hero', value: { headline: "Financial Solutions for Small Businesses", subtext: "Wilcox Advisors helps small businesses like yours grow smarter with tailored financial expertise." } };
  const aboutContent = await Content.findOne({ section: 'about' }) || { section: 'about', value: "At Wilcox Advisors, we specialize in financial solutions for small businesses. From startups to growing companies, we provide the expertise you need to succeed—built to scale with you every step of the way." };

  res.json({
    blogDrafts: [blogDraft],
    hero: heroContent.value,
    about: aboutContent.value,
  });
});

app.post('/api/admin/content', adminAuth, async (req, res) => {
  const { section, value } = req.body;
  await Content.findOneAndUpdate({ section }, { section, value }, { upsert: true });
  res.json({ message: 'Content updated' });
});

app.get('/api/blog', async (req, res) => {
  const posts = await Blog.find({ isDraft: false });
  res.json(posts);
});

app.post('/api/blog', adminAuth, async (req, res) => {
  const blog = new Blog({ ...req.body, isDraft: false });
  await blog.save();
  res.status(201).json({ message: 'Blog posted' });
});

app.put('/api/blog/:id', adminAuth, async (req, res) => {
  await Blog.findByIdAndUpdate(req.params.id, { ...req.body, isDraft: false });
  res.json({ message: 'Blog updated' });
});

app.listen(5000, () => console.log('Server running on port 5000'));
