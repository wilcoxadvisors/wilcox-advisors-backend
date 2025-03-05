const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const Chat = require('../models/chat');

// Configure OpenAI/xAI
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1", // xAI API endpoint
});

// Public chat endpoint
router.post('/', async (req, res, next) => {
  const { message } = req.body;
  try {
    // Extract token if available
    const token = req.headers['authorization']?.split(' ')[1];
    let userId = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        if (error.name !== 'TokenExpiredError') {
          console.warn('Invalid token, proceeding as guest:', error.message);
        }
      }
    }
    
    // Get AI response
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
    
    // Save the chat
    const chat = new Chat({ message, reply, userId, isClientChat: false });
    await chat.save();
    
    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

// Client chat endpoint (for authenticated clients)
router.post('/client', async (req, res, next) => {
  const { message } = req.body;
  try {
    // Extract token if available
    const token = req.headers['authorization']?.split(' ')[1];
    let userId = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (error) {
        if (error.name !== 'TokenExpiredError') {
          console.warn('Invalid token, proceeding as guest:', error.message);
        }
      }
    }
    
    // Get AI response
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
    
    // Save the chat
    const chat = new Chat({ message, reply, userId, isClientChat: true });
    await chat.save();
    
    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
