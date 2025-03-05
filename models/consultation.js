const mongoose = require('mongoose');

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

module.exports = mongoose.model('Consultation', ConsultationSchema);
