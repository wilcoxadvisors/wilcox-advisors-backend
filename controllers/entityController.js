// controllers/entityController.js
const Entity = require('../models/entity');
const AuditLog = require('../models/auditLog');
const Account = require('../models/account');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Get all entities
exports.getEntities = async (req, res, next) => {
  try {
    const { active } = req.query;
    const query = { clientId: req.user.id };
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const entities = await Entity.find(query).sort({ name: 1 });
    
    res.json({
      success: true,
      entities: entities.map(entity => ({
        id: entity._id,
        name: entity.name,
        code: entity.code,
        type: entity.type,
        currency: entity.currency,
        isActive: entity.isActive,
        parentEntityId: entity.parentEntityId
      }))
    });
  } catch (error) {
    logger.error('Error fetching entities:', error);
    next(error);
  }
};

// Get single entity by ID
exports.getEntityById = async (req, res, next) => {
  try {
    const entity = await Entity.findOne({
      _id: req.params.id,
      clientId: req.user.id
    });
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found'
      });
    }
    
    res.json({
      success: true,
      entity: {
        id: entity._id,
        name: entity.name,
        code: entity.code,
        type: entity.type,
        currency: entity.currency,
        isActive: entity.isActive,
        parentEntityId: entity.parentEntityId,
        metadata: entity.metadata,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching entity:', error);
    next(error);
  }
};

// Create new entity
exports.createEntity = async (req, res, next) => {
  try {
    const { name, code, type, currency, parentEntityId } = req.body;
    
    // Check if entity code already exists for this client
    const existingEntity = await Entity.findOne({
      clientId: req.user.id,
      code: code
    });
    
    if (existingEntity) {
      return res.status(400).json({
        success: false,
        message: `Entity with code ${code} already exists`
      });
    }
    
    const entity = new Entity({
      clientId: req.user.id,
      name,
      code,
      type: type || 'Operating',
      currency: currency || 'USD',
      parentEntityId: parentEntityId || null
    });
    
    await entity.save();
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'CREATE_ENTITY',
      entityType: 'Entity',
      entityId: entity._id,
      userId: req.user.id,
      details: { name, code, type }
    });
    await auditLog.save();
    
    res.status(201).json({
      success: true,
      message: 'Entity created successfully',
      entity: {
        id: entity._id,
        name: entity.name,
        code: entity.code,
        type: entity.type,
        currency: entity.currency
      }
    });
  } catch (error) {
    logger.error('Error creating entity:', error);
    next(error);
  }
};

// Update existing entity
exports.updateEntity = async (req, res, next) => {
  try {
    const { name, type, currency, isActive, metadata } = req.body;
    
    // Find entity and make sure it belongs to this client
    const entity = await Entity.findOne({
      _id: req.params.id,
      clientId: req.user.id
    });
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found'
      });
    }
    
    // Update fields
    if (name) entity.name = name;
    if (type) entity.type = type;
    if (currency) entity.currency = currency;
    if (isActive !== undefined) entity.isActive = isActive;
    if (metadata) entity.metadata = { ...entity.metadata, ...metadata };
    
    await entity.save();
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'UPDATE_ENTITY',
      entityType: 'Entity',
      entityId: entity._id,
      userId: req.user.id,
      details: { name, type, currency, isActive }
    });
    await auditLog.save();
    
    res.json({
      success: true,
      message: 'Entity updated successfully',
      entity: {
        id: entity._id,
        name: entity.name,
        code: entity.code,
        type: entity.type,
        currency: entity.currency,
        isActive: entity.isActive
      }
    });
  } catch (error) {
    logger.error('Error updating entity:', error);
    next(error);
  }
};

// Delete entity
exports.deleteEntity = async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Find entity and make sure it belongs to this client
    const entity = await Entity.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).session(session);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        message: 'Entity not found'
      });
    }
    
    // Check if entity has accounts
    const accountCount = await Account.countDocuments({
      entityId: entity._id
    }).session(session);
    
    if (accountCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete entity with associated accounts. Deactivate it instead.'
      });
    }
    
    // Delete the entity
    await Entity.deleteOne({ _id: entity._id }).session(session);
    
    // Create audit log
    const auditLog = new AuditLog({
      clientId: req.user.id,
      action: 'DELETE_ENTITY',
      entityType: 'Entity',
      entityId: entity._id,
      userId: req.user.id,
      details: { name: entity.name, code: entity.code }
    });
    await auditLog.save({ session });
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Entity deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error deleting entity:', error);
    next(error);
  } finally {
    session.endSession();
  }
};
