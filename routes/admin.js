const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const Blog = require('../models/blog');
const Content = require('../models/content');
const Consultation = require('../models/consultation');
const Checklist = require('../models/checklist');
const Contact = require('../models/contact');
const Chat = require('../models/chat');
const File = require('../models/file');
const { adminAuth } = require('../middleware/auth');

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1", // xAI API endpoint
});

// Get admin dashboard data
router.get('/dashboard', adminAuth, async (req, res, next) => {
  try {
    const consultations = await Consultation.find();
    const checklists = await Checklist.find();
    const contacts = await Contact.find();
    const chats = await Chat.find();
    const files = await File.find();

    // Generate blog draft based on recent trends
    const trends = `Latest trends: High interest in ${
      consultations.map(c => c.services).flat().reduce((acc, curr) => { 
        acc[curr] = (acc[curr] || 0) + 1; 
        return acc; 
      }, {})
    } Customer questions: ${chats.map(c => c.message).join(', ')}.`;
    
    const blogDraft = await openai.chat.completions.create({
      model: 'grok-2-latest',
      messages: [
        {
          role: 'user',
          content: `Generate a blog post draft for Wilcox Advisors, focusing on our services (Bookkeeping, Monthly Financial Package, Cash Flow Management, Custom Reporting, Budgeting & Forecasting, Outsourced Controller/CFO Services) based on: ${trends}. Keep it relevant to our business and customer questions.`,
        },
      ],
      max_tokens: 500,
      temperature: 0,
    }).then(res => ({ 
      title: 'Latest Financial Insights for Your Business', 
      content: res.choices[0].message.content.trim() 
    }));

    // Get site content or use defaults
    const heroContent = (await Content.findOne({ section: 'hero' })) || { 
      section: 'hero', 
      value: { 
        headline: 'Financial Solutions for Small Businesses', 
        subtext: 'Wilcox Advisors helps small businesses like yours grow smarter with tailored financial expertise.' 
      } 
    };
    
    const aboutContent = (await Content.findOne({ section: 'about' })) || { 
      section: 'about', 
      value: 'At Wilcox Advisors, we specialize in financial solutions for small businesses. From startups to growing companies, we provide the expertise you need to succeed—built to scale with you every step of the way.' 
    };

    res.json({
      blogDrafts: [blogDraft],
      hero: heroContent.value,
      about: aboutContent.value,
      stats: {
        consultations: consultations.length,
        checklists: checklists.length,
        contacts: contacts.length,
        chats: chats.length,
        files: files.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update site content
router.post('/content', adminAuth, async (req, res, next) => {
  const { section, value } = req.body;
  try {
    await Content.findOneAndUpdate(
      { section }, 
      { section, value }, 
      { upsert: true }
    );
    res.json({ message: 'Content updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all consultations
router.get('/consultations', adminAuth, async (req, res, next) => {
  try {
    const consultations = await Consultation.find().sort({ timestamp: -1 });
    res.json(consultations);
  } catch (error) {
    next(error);
  }
});

// Get all checklists
router.get('/checklists', adminAuth, async (req, res, next) => {
  try {
    const checklists = await Checklist.find().sort({ timestamp: -1 });
    res.json(checklists);
  } catch (error) {
    next(error);
  }
});

// Get all contacts
router.get('/contacts', adminAuth, async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ timestamp: -1 });
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
