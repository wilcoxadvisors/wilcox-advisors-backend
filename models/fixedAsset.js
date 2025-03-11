// models/fixedAsset.js
const FixedAssetSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  name: { type: String, required: true },
  description: String,
  assetCategory: { type: String, required: true },
  acquisitionDate: { type: Date, required: true },
  acquisitionCost: { type: Number, required: true },
  depreciationMethod: { type: String, enum: ['straight-line', 'declining-balance', 'units-of-production'], default: 'straight-line' },
  usefulLife: { type: Number, required: true }, // in months
  salvageValue: { type: Number, default: 0 },
  currentBookValue: { type: Number, required: true },
  depreciationSchedule: [{
    period: Date,
    amount: Number,
    remainingValue: Number
  }],
  disposed: { type: Boolean, default: false },
  disposalDate: Date,
  disposalValue: Number
});
