// models/fixedAsset.js
const mongoose = require('mongoose');

const DepreciationScheduleSchema = new mongoose.Schema({
  period: { 
    type: Date, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  remainingValue: { 
    type: Number, 
    required: true 
  }
});

const FixedAssetSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  assetNumber: {
    type: String,
    trim: true,
    index: true
  },
  assetCategory: {
    type: String,
    required: true,
    enum: ['equipment', 'furniture', 'vehicles', 'buildings', 'land', 'computers', 'software', 'other'],
    index: true
  },
  location: {
    type: String,
    trim: true
  },
  acquisitionDate: {
    type: Date,
    required: true,
    index: true
  },
  acquisitionCost: {
    type: Number,
    required: true
  },
  depreciationMethod: {
    type: String,
    enum: ['straight-line', 'declining-balance', 'units-of-production'],
    default: 'straight-line'
  },
  usefulLife: {
    type: Number, // in months
    required: true
  },
  salvageValue: {
    type: Number,
    default: 0
  },
  currentBookValue: {
    type: Number,
    required: true
  },
  lastDepreciationDate: {
    type: Date
  },
  depreciationSchedule: [DepreciationScheduleSchema],
  disposed: {
    type: Boolean,
    default: false,
    index: true
  },
  disposalDate: {
    type: Date
  },
  disposalValue: {
    type: Number
  },
  journalEntryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  }],
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  depreciationAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  accumulatedDepreciationAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  notes: {
    type: String
  },
  attachments: [{
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    },
    fileName: String,
    uploadDate: Date
  }],
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Create compound indexes
FixedAssetSchema.index({ clientId: 1, entityId: 1, assetCategory: 1 });
FixedAssetSchema.index({ clientId: 1, entityId: 1, disposed: 1 });
FixedAssetSchema.index({ clientId: 1, entityId: 1, acquisitionDate: 1 });

// Pre-save middleware to set currentBookValue if not provided
FixedAssetSchema.pre('save', function(next) {
  if (this.isNew && this.currentBookValue === undefined) {
    this.currentBookValue = this.acquisitionCost;
  }
  next();
});

// Method to calculate depreciation
FixedAssetSchema.methods.calculateDepreciation = function(toDate) {
  const endDate = toDate || new Date();
  const startDate = this.lastDepreciationDate || this.acquisitionDate;
  
  // Don't calculate if the asset is disposed or not enough time has passed
  if (this.disposed || startDate >= endDate) {
    return 0;
  }
  
  let depreciationAmount = 0;
  
  switch(this.depreciationMethod) {
    case 'straight-line':
      // Monthly depreciation = (Cost - Salvage) / Useful life (in months)
      const monthlyDepreciation = (this.acquisitionCost - this.salvageValue) / this.usefulLife;
      
      // Calculate months between dates
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const months = (endDateObj.getFullYear() - startDateObj.getFullYear()) * 12 + 
                     (endDateObj.getMonth() - startDateObj.getMonth());
      
      depreciationAmount = monthlyDepreciation * months;
      break;
      
    case 'declining-balance':
      // Implement declining balance calculation
      // This is a more complex calculation that would need to be implemented based on specific requirements
      break;
      
    case 'units-of-production':
      // Units of production would require tracking the actual usage/production
      // This would need additional fields and calculation logic
      break;
  }
  
  // Ensure we don't depreciate below salvage value
  const maxAllowableDepreciation = this.currentBookValue - this.salvageValue;
  depreciationAmount = Math.min(depreciationAmount, maxAllowableDepreciation);
  depreciationAmount = Math.max(depreciationAmount, 0); // Ensure non-negative
  
  return depreciationAmount;
};

// Static method to run monthly depreciation for all assets
FixedAssetSchema.statics.runMonthlyDepreciation = async function(clientId, entityId, date = new Date()) {
  const assets = await this.find({
    clientId,
    entityId,
    disposed: false
  });
  
  const results = [];
  
  for (const asset of assets) {
    const depreciationAmount = asset.calculateDepreciation(date);
    
    if (depreciationAmount > 0) {
      // Update the asset
      asset.currentBookValue -= depreciationAmount;
      asset.lastDepreciationDate = date;
      
      // Add to depreciation schedule
      asset.depreciationSchedule.push({
        period: date,
        amount: depreciationAmount,
        remainingValue: asset.currentBookValue
      });
      
      await asset.save();
      
      results.push({
        assetId: asset._id,
        assetName: asset.name,
        depreciationAmount,
        currentBookValue: asset.currentBookValue
      });
    }
  }
  
  return results;
};

module.exports = mongoose.model('FixedAsset', FixedAssetSchema);

// routes/fixedAssets.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const FixedAsset = require('../models/fixedAsset');
const Entity = require('../models/entity');
const Account = require('../models/account');
const AuditLog = require('../models/auditLog');
const { auth, adminAuth } = require('../middleware/auth');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get all fixed assets
router.get('/', auth, async (req, res, next) => {
  try {
    const { entityId, category, disposed, search } = req.query;
    
    // Build query
    const query = { clientId: req.user.id };
    
    if (entityId) {
      query.entityId = entityId;
    }
    
    if (category) {
      query.assetCategory = category;
    }
    
    if (disposed !== undefined) {
      query.disposed = disposed === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { assetNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const assets = await FixedAsset.find(query)
      .sort({ acquisitionDate: -1 })
      .populate('entityId', 'name code')
      .populate('accountId', 'accountNumber accountName')
      .lean();
    
    res.json({
      success: true,
      assets
    });
  } catch (error) {
    logger.error('Error fetching fixed assets:', error);
    next(error);
  }
});

// Get a single fixed asset
router.get('/:id', auth, async (req, res, next) => {
  try {
    const asset = await FixedAsset.findOne({
      _id: req.params.id,
      clientId: req.user.id
    })
      .populate('entityId', 'name code')
      .populate('accountId', 'accountNumber accountName')
      .populate('depreciationAccountId', 'accountNumber accountName')
      .populate('accumulatedDepreciationAccountId', 'accountNumber accountName')
      .lean();
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Fixed asset not found'
      });
    }
    
    res.json({
      success: true,
      asset
    });
  } catch (error) {
    logger.error('Error fetching fixed asset:', error);
    next(error);
  }
});

// Create a new fixed asset
router.post('/', auth, [
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('name')
    .notEmpty()
    .withMessage('Asset name is required'),
  body('assetCategory')
    .isIn(['equipment', 'furniture', 'vehicles', 'buildings', 'land', 'computers', 'software', 'other'])
    .withMessage('Valid asset category is required'),
  body('acquisitionDate')
    .isDate()
    .withMessage('Valid acquisition date is required'),
  body('acquisitionCost')
    .isFloat({ min: 0 })
    .withMessage('Acquisition cost must be a positive number'),
  body('depreciationMethod')
    .isIn(['straight-line', 'declining-balance', 'units-of-production'])
    .withMessage('Valid depreciation method is required'),
  body('usefulLife')
    .isInt({ min: 1 })
    .withMessage('Useful life must be a positive integer'),
  body('salvageValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Salvage value must be a positive number')
], async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      entityId,
      name,
      description,
      assetNumber,
      assetCategory,
      location,
      acquisitionDate,
      acquisitionCost,
      depreciationMethod,
      usefulLife,
      salvageValue = 0,
      accountId,
      depreciationAccountId,
      accumulatedDepreciationAccountId,
      notes
    } = req.body;
    
    // Verify entity exists and belongs to client
    const entity = await Entity.findOne({
      _id: entityId,
      clientId: req.user.id
    }).session(session);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found or you do not have permission'
      });
    }
    
    // Validate account IDs if provided
    if (accountId) {
      const account = await Account.findOne({
        _id: accountId,
        clientId: req.user.id,
        entityId
      }).session(session);
      
      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Asset account not found or does not belong to this entity'
        });
      }
    }
    
    if (depreciationAccountId) {
      const depAccount = await Account.findOne({
        _id: depreciationAccountId,
        clientId: req.user.id,
        entityId
      }).session(session);
      
      if (!depAccount) {
        return res.status(404).json({
          success: false,
          message: 'Depreciation account not found or does not belong to this entity'
        });
      }
    }
    
    if (accumulatedDepreciationAccountId) {
      const accDepAccount = await Account.findOne({
        _id: accumulatedDepreciationAccountId,
        clientId: req.user.id,
        entityId
      }).session(session);
      
      if (!accDepAccount) {
        return res.status(404).json({
          success: false,
          message: 'Accumulated depreciation account not found or does not belong to this entity'
        });
      }
    }
    
    // Create the fixed asset
    const asset = new FixedAsset({
      clientId: req.user.id,
      entityId,
      name,
      description,
      assetNumber,
      assetCategory,
      location,
      acquisitionDate,
      acquisitionCost,
      depreciationMethod,
      usefulLife,
      salvageValue,
      currentBookValue: acquisitionCost, // Initial book value is the acquisition cost
      accountId,
      depreciationAccountId,
      accumulatedDepreciationAccountId,
      notes
    });
    
    await asset.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'CREATE_FIXED_ASSET',
      entityType: 'FixedAsset',
      entityId: asset._id,
      userId: req.user.id,
      details: {
        name,
        assetCategory,
        acquisitionDate,
        acquisitionCost
      }
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: 'Fixed asset created successfully',
      asset: {
        id: asset._id,
        name: asset.name,
        assetCategory: asset.assetCategory,
        acquisitionDate: asset.acquisitionDate,
        acquisitionCost: asset.acquisitionCost,
        currentBookValue: asset.currentBookValue
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error creating fixed asset:', error);
    next(error);
  } finally {
    session.endSession();
  }
});

// Update a fixed asset
router.put('/:id', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid asset ID format'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Asset name cannot be empty'),
  body('assetCategory')
    .optional()
    .isIn(['equipment', 'furniture', 'vehicles', 'buildings', 'land', 'computers', 'software', 'other'])
    .withMessage('Valid asset category is required'),
  body('acquisitionDate')
    .optional()
    .isDate()
    .withMessage('Valid acquisition date is required'),
  body('acquisitionCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Acquisition cost must be a positive number'),
  body('depreciationMethod')
    .optional()
    .isIn(['straight-line', 'declining-balance', 'units-of-production'])
    .withMessage('Valid depreciation method is required'),
  body('usefulLife')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Useful life must be a positive integer'),
  body('salvageValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Salvage value must be a positive number')
], async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find asset and make sure it belongs to this client
    const asset = await FixedAsset.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Fixed asset not found'
      });
    }
    
    // Cannot modify disposed assets
    if (asset.disposed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a disposed asset'
      });
    }
    
    const updateFields = [
      'name', 'description', 'assetNumber', 'assetCategory', 'location',
      'acquisitionDate', 'acquisitionCost', 'depreciationMethod', 'usefulLife',
      'salvageValue', 'accountId', 'depreciationAccountId', 'accumulatedDepreciationAccountId',
      'notes'
    ];
    
    // Update fields
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        asset[field] = req.body[field];
      }
    });
    
    // If acquisition cost, useful life, or salvage value changed, recalculate book value
    if (
      req.body.acquisitionCost !== undefined ||
      req.body.usefulLife !== undefined ||
      req.body.salvageValue !== undefined
    ) {
      // This is a simplified recalculation - in a real system, you'd need to handle
      // past depreciation, etc. more carefully
      if (asset.depreciationSchedule.length === 0) {
        // If no depreciation has been recorded yet, just reset to acquisition cost
        asset.currentBookValue = asset.acquisitionCost;
      } else {
        // Otherwise, we'd need a more complex recalculation based on depreciation history
        // This is just a placeholder - real implementation would be more complex
        logger.warn('Asset parameters changed after depreciation started - book value may need adjustment');
      }
    }
    
    await asset.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'UPDATE_FIXED_ASSET',
      entityType: 'FixedAsset',
      entityId: asset._id,
      userId: req.user.id,
      details: req.body
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Fixed asset updated successfully',
      asset: {
        id: asset._id,
        name: asset.name,
        assetCategory: asset.assetCategory,
        acquisitionDate: asset.acquisitionDate,
        acquisitionCost: asset.acquisitionCost,
        currentBookValue: asset.currentBookValue
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error updating fixed asset:', error);
    next(error);
  } finally {
    session.endSession();
  }
});

// Dispose of a fixed asset
router.put('/:id/dispose', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid asset ID format'),
  body('disposalDate')
    .isDate()
    .withMessage('Valid disposal date is required'),
  body('disposalValue')
    .isFloat({ min: 0 })
    .withMessage('Disposal value must be a positive number')
], async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { disposalDate, disposalValue } = req.body;
    
    // Find asset and make sure it belongs to this client
    const asset = await FixedAsset.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Fixed asset not found'
      });
    }
    
    // Cannot dispose of an already disposed asset
    if (asset.disposed) {
      return res.status(400).json({
        success: false,
        message: 'Asset has already been disposed'
      });
    }
    
    // Update asset
    asset.disposed = true;
    asset.disposalDate = disposalDate;
    asset.disposalValue = disposalValue;
    
    await asset.save({ session });
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DISPOSE_FIXED_ASSET',
      entityType: 'FixedAsset',
      entityId: asset._id,
      userId: req.user.id,
      details: {
        disposalDate,
        disposalValue,
        bookValueAtDisposal: asset.currentBookValue
      }
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Asset marked as disposed',
      asset: {
        id: asset._id,
        name: asset.name,
        disposalDate: asset.disposalDate,
        disposalValue: asset.disposalValue,
        bookValueAtDisposal: asset.currentBookValue
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error disposing fixed asset:', error);
    next(error);
  } finally {
    session.endSession();
  }
});

// Delete a fixed asset
router.delete('/:id', auth, [
  param('id')
    .isMongoId()
    .withMessage('Invalid asset ID format')
], async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find asset and make sure it belongs to this client
    const asset = await FixedAsset.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Fixed asset not found'
      });
    }
    
    // Delete the asset
    await FixedAsset.deleteOne({ _id: asset._id }).session(session);
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DELETE_FIXED_ASSET',
      entityType: 'FixedAsset',
      entityId: asset._id,
      userId: req.user.id,
      details: {
        name: asset.name,
        assetCategory: asset.assetCategory,
        acquisitionCost: asset.acquisitionCost,
        currentBookValue: asset.currentBookValue
      }
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Fixed asset deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error deleting fixed asset:', error);
    next(error);
  } finally {
    session.endSession();
  }
});

// Run depreciation for all assets (admin only)
router.post('/run-depreciation', adminAuth, [
  body('entityId')
    .isMongoId()
    .withMessage('Valid entity ID is required'),
  body('date')
    .optional()
    .isDate()
    .withMessage('Valid date is required')
], async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  try {
    const { entityId, date } = req.body;
    
    // Verify entity exists and belongs to client
    const entity = await Entity.findOne({
      _id: entityId,
      clientId: req.user.id
    });
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found or you do not have permission'
      });
    }
    
    // Run depreciation
    const depreciationResults = await FixedAsset.runMonthlyDepreciation(
      req.user.id,
      entityId,
      date ? new Date(date) : new Date()
    );
    
    res.json({
      success: true,
      message: `Depreciation completed for ${depreciationResults.length} assets`,
      results: depreciationResults
    });
  } catch (error) {
    logger.error('Error running depreciation:', error);
    next(error);
  }
});

module.exports = router;
