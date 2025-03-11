// models/entityGroup.js
const EntityGroupSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  entities: [{ 
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    ownership: { type: Number, default: 100 }, // percentage
    consolidationMethod: { type: String, enum: ['full', 'equity', 'proportional'], default: 'full' }
  }],
  eliminationRules: [{
    sourceAccount: String,
    targetAccount: String,
    description: String
  }]
});
