const express = require('express');
const router = express.Router();
const accountingRoutes = require('./accounting');

router.use('/accounting', accountingRoutes);

module.exports = router;
