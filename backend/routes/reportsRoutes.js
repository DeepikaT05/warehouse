const express = require('express');
const router = express.Router();
const { getReportsSummary } = require('../controllers/reportsController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/summary', getReportsSummary);

module.exports = router;
