// routes/entities.js
const express = require('express');
const router = express.Router();
const { 
  getEntities, 
  getEntityById, 
  createEntity, 
  updateEntity,
  deleteEntity
} = require('../controllers/entityController');
const { 
  validateCreateEntity, 
  validateUpdateEntity,
  validateEntityId
} = require('../validators/entityValidator');
const { auth } = require('../middleware/auth');

// Get all entities
router.get('/', auth, getEntities);

// Get entity by ID
router.get('/:id', auth, validateEntityId, getEntityById);

// Create new entity
router.post('/', auth, validateCreateEntity, createEntity);

// Update entity
router.put('/:id', auth, validateUpdateEntity, updateEntity);

// Delete entity
router.delete('/:id', auth, validateEntityId, deleteEntity);

module.exports = router;
