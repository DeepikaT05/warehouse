const Product = require('../models/Product');
const StockBox = require('../models/StockBox');
const Purchase = require('../models/Purchase');
const Dealer = require('../models/Dealer');
const SalesInvoice = require('../models/SalesInvoice');

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
        results: { products: [], boxes: [], invoices: [], salesInvoices: [], dealers: [] }
      });
    }

    const cleanQuery = query.trim();
    let searchPattern = escapeRegex(cleanQuery);
    if (/v[ei]+da|w[ei]+da/i.test(searchPattern)) {
      searchPattern = searchPattern.replace(/v[ei]+da|w[ei]+da/gi, 'v[ei]+da');
    }
    if (/v[ei]+gen|w[ei]+gen/i.test(searchPattern)) {
      searchPattern = searchPattern.replace(/v[ei]+gen|w[ei]+gen/gi, 'v[ei]+gen');
    }
    const regex = new RegExp(searchPattern, 'i');

    // Run parallel searches across entities
    const [products, boxes, purchases, salesInvoices, dealers] = await Promise.all([
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

      // Sales Invoices / Assigned Dealer Bills
      (() => {
        let salesFilter = {
          $or: [
            { invoiceNo: regex },
            { buyerOrderNo: regex },
            { dealerName: regex },
            { garageName: regex },
            { destination: regex },
            { assignedToUser: regex },
            { orderStatus: regex },
            { 'items.productName': regex }
          ]
        };

        // If user typed general keywords like 'bill', 'sales bill', 'assign', show latest bills
        if (/^(bill|bills|sales|sale|assign|assigned|sales bill|assign bill|assigned bills|invoice|invoices)$/i.test(cleanQuery)) {
          salesFilter = {};
        }

        return SalesInvoice.find(salesFilter)
          .sort({ invoiceDate: -1, createdAt: -1 })
          .limit(8)
          .lean();
      })(),

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

    // One grouped aggregation instead of a countDocuments per matched product.
    const names = products.map(pr => String(pr.name || '').trim()).filter(Boolean);
    let stockByName = {};
    if (names.length) {
      const rows = await StockBox.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: 'available',
            productName: { $in: names.map(n => new RegExp(`^${escapeRegex(n)}$`, 'i')) }
          }
        },
        { $group: { _id: { $toLower: '$productName' }, count: { $sum: 1 } } }
      ]);
      stockByName = Object.fromEntries(rows.map(r => [r._id, r.count]));
    }

    const productsWithStock = products.map(pr => ({
      ...pr,
      availableStock: stockByName[String(pr.name || '').trim().toLowerCase()] || 0
    }));

    return res.json({
      success: true,
      results: {
        products: productsWithStock,
        boxes,
        invoices: purchases,
        salesInvoices,
        dealers
      }
    });
  } catch (err) {
    console.error('Global search error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { globalSearch };
