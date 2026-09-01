const Product = require('../models/Product');
const StockBox = require('../models/StockBox');
const AuditLog = require('../models/AuditLog');

function escapeRegex(text) {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Get all products
const getProducts = async (req, res) => {
  try {
    const { category, search } = req.query;

    // Auto-sync products from StockBox if not already present
    const stockProductNames = await StockBox.distinct('productName');
    for (const pName of stockProductNames) {
      if (pName && pName.trim()) {
        const trimmed = pName.trim();
        const existing = await Product.findOne({
          name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' },
          isDeleted: { $ne: true }
        });
        if (!existing) {
          const sampleBox = await StockBox.findOne({ productName: trimmed });
          const code = `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
          await Product.create({
            productCode: code,
            name: trimmed,
            category: 'Crop Protection',
            unit: (sampleBox?.weight && sampleBox.weight.toLowerCase().includes('l')) ? 'Ltr' : 'kg',
            packingSize: sampleBox?.weight || '1 kg',
            mrp: Number(sampleBox?.purchaseCost) ? Math.round(Number(sampleBox.purchaseCost) * 1.5) : 500,
            minStockThreshold: 20,
            description: `Auto-synced from Purchase Stock`
          });
        }
      }
    }

    const filter = { isDeleted: { $ne: true } };
    if (category) filter.category = category;
    if (search && search.trim()) {
      const cleanSearch = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { productCode: { $regex: cleanSearch, $options: 'i' } },
        { category: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const products = await Product.find(filter).sort({ name: 1 }).lean();

    // Attach real-time available stock count for each product
    const productsWithStock = await Promise.all(
      products.map(async (p) => {
        const availableStock = await StockBox.countDocuments({
          productName: { $regex: `^${escapeRegex(p.name.trim())}$`, $options: 'i' },
          status: 'available',
          isDeleted: { $ne: true }
        });
        return {
          ...p,
          availableStock
        };
      })
    );

    return res.json({ success: true, products: productsWithStock });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Create product (Admin only)
const createProduct = async (req, res) => {
  try {
    const { productCode, name, category, unit, packingSize, mrp, minStockThreshold, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }

    const code = productCode ? productCode.toUpperCase().trim() : `PRD-${Date.now().toString().slice(-6)}`;

    const existing = await Product.findOne({ productCode: code, isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: `Product code '${code}' already exists!` });
    }

    const product = await Product.create({
      productCode: code,
      name,
      category: category || 'Crop Protection',
      unit: unit || 'kg',
      packingSize: packingSize || '1 kg',
      mrp: Number(mrp) || 0,
      minStockThreshold: Number(minStockThreshold) || 20,
      description: description || ''
    });

    await AuditLog.create({
      action: 'PRODUCT_CREATED',
      user: req.user?.username || 'admin',
      role: req.user?.role || 'admin',
      module: 'ProductManagement',
      details: `Created product ${product.name} (${product.productCode})`
    });

    return res.status(201).json({ success: true, message: 'Product created successfully', product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update product (Admin only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product || product.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    Object.assign(product, req.body);
    await product.save();

    await AuditLog.create({
      action: 'PRODUCT_UPDATED',
      user: req.user?.username || 'admin',
      role: req.user?.role || 'admin',
      module: 'ProductManagement',
      details: `Updated product ${product.name}`
    });

    return res.json({ success: true, message: 'Product updated successfully', product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Soft delete product (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.deletedBy = req.user?.username || 'admin';
    await product.save();

    await AuditLog.create({
      action: 'PRODUCT_SOFT_DELETED',
      user: req.user?.username || 'admin',
      role: req.user?.role || 'admin',
      module: 'ProductManagement',
      details: `Soft deleted product ${product.name}`
    });

    return res.json({ success: true, message: `Product ${product.name} deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct };
