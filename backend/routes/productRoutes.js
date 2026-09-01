const express = require('express');
const router = express.Router();
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.use(verifyToken);

router.get('/', getProducts);
router.post('/', requireRoles('admin'), createProduct);
router.put('/:id', requireRoles('admin'), updateProduct);
router.delete('/:id', requireRoles('admin'), deleteProduct);

module.exports = router;
