const mongoose = require('mongoose');

const CashFlowForecastSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  forecastPeriod: { type: Date, required: true },
  inflows: { type: Number, required: true },
  outflows: { type: Number, required: true },
  netCash: { type: Number, required: true },
  generatedAt: { type: Date, default: Date.now },
  aiRecommendations: { type: Object },
  isManual: { type: Boolean, default: true }
});

module.exports = mongoose.model('CashFlowForecast', CashFlowForecastSchema);
