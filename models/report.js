// models/report.js
const ReportSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['standard', 'custom'], default: 'standard' },
  reportType: { type: String, enum: ['balance-sheet', 'income-statement', 'cash-flow', 'custom'], required: true },
  customDefinition: {
    fields: [String],
    filters: Object,
    groupBy: [String],
    calculations: [Object]
  },
  layout: Object,
  lastGenerated: Date,
  schedule: {
    isScheduled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly'] },
    nextRun: Date
  }
});
