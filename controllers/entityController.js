// controllers/entityController.js
const Entity = require('../models/entity');
const AuditLog = require('../models/auditLog');
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

// Create new entity
exports.createEntity = async (req, res, next) => {
  try {
    const { name, code, type, currency, parentEntityId } = req.body;
    
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
        code: entity.code
      }
    });
  } catch (error) {
    logger.error('Error creating entity:', error);
    next(error);
  }
};
