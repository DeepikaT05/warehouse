const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);
router.get('/', globalSearch);

module.exports = router;
