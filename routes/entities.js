// routes/entities.js
const express = require('express');
const router = express.Router();
const { getEntities, createEntity } = require('../controllers/entityController');
const { validateEntity } = require('../validators/entityValidator');
const { auth } = require('../middleware/auth');

// Routes with middleware
router.get('/', auth, getEntities);
router.post('/', auth, validateEntity, createEntity);

module.exports = router;
