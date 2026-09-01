const Product = require('../models/Product');
const StockBox = require('../models/StockBox');
const Purchase = require('../models/Purchase');
const Dealer = require('../models/Dealer');

// Helper to escape special regex characters
function escapeRegex(text) {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

const globalSearch = async (req, res) => {
  try {
    const query = req.query.q || req.query.search || '';
    if (!query || !query.trim()) {
      return res.json({
        success: true,
        results: { products: [], boxes: [], invoices: [], dealers: [] }
      });
    }

    const cleanQuery = query.trim();
    const regex = new RegExp(escapeRegex(cleanQuery), 'i');

    // Run parallel searches across entities
    const [products, boxes, purchases, dealers] = await Promise.all([
      // Products
      Product.find({
        isDeleted: { $ne: true },
        $or: [
          { name: regex },
          { productCode: regex },
          { category: regex }
        ]
      })
        .limit(8)
        .lean(),

      // Stock Boxes
      StockBox.find({
        isDeleted: { $ne: true },
        $or: [
          { qrId: regex },
          { barcode: regex },
          { productName: regex },
          { batchNumber: regex },
          { purchaseInvoice: regex },
          { warehouseLocation: regex }
        ]
      })
        .limit(10)
        .lean(),

      // Purchase Invoices
      Purchase.find({
        isDeleted: { $ne: true },
        $or: [
          { invoiceNumber: regex },
          { manufacturer: regex },
          { productName: regex },
          { lrNumber: regex }
        ]
      })
        .limit(6)
        .lean(),

      // Dealers
      Dealer.find({
        $or: [
          { dealerName: regex },
          { garageName: regex },
          { ownerName: regex },
          { phone: regex },
          { city: regex },
          { gstNumber: regex }
        ]
      })
        .limit(6)
        .lean()
    ]);

    // Attach available stock count to matching products
    const productsWithStock = await Promise.all(
      products.map(async (p) => {
        const availableStock = await StockBox.countDocuments({
          productName: { $regex: `^${escapeRegex(p.name.trim())}$`, $options: 'i' },
          status: 'available',
          isDeleted: { $ne: true }
        });
        return { ...p, availableStock };
      })
    );

    return res.json({
      success: true,
      results: {
        products: productsWithStock,
        boxes,
        invoices: purchases,
        dealers
      }
    });
  } catch (err) {
    console.error('Global search error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { globalSearch };
