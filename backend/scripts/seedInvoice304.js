const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');

async function seedInvoice304() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // 1. Find Dealer: TAMRAKAR AGROTECH BORI (4)
  let dealer = await Dealer.findOne({
    $or: [
      { dealerName: /TAMRAKAR AGROTECH/i },
      { gstNumber: '22ANYPT1907C1ZX' },
      { phone: '9406161233' }
    ]
  });

  if (!dealer) {
    dealer = await Dealer.create({
      dealerName: 'TAMRAKAR AGROTECH BORI (4)',
      garageName: 'TAMRAKAR AGROTECH BORI (4)',
      ownerName: 'TAMRAKAR',
      gstNumber: '22ANYPT1907C1ZX',
      phone: '9406161233',
      email: 'mohanishtamrakar5@gmail.com',
      address: 'BAZAR CHOWK BORI',
      state: 'Chhattisgarh',
      district: 'Durg',
      city: 'Bori',
      pincode: '491001'
    });
    console.log('[DEALER CREATED]:', dealer.dealerName, dealer._id);
  } else {
    console.log('[DEALER FOUND]:', dealer.dealerName, dealer._id);
  }

  // 2. Upsert Sales Invoice #304 (4 Peti, 35 LTR, ₹16,714.00)
  const invoiceData = {
    invoiceNo: '304',
    orderId: 'ORD-304',
    dealerId: dealer._id,
    dealerName: dealer.dealerName,
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'SELF VEHICAL',
    subtotal: 14670.00,
    totalTaxAmount: 2043.90,
    totalAmount: 16714.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'KASOL 500ML',
        batchNumber: 'VNK-KAS-002',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '31031000',
        price: 97.00, // 194.00 per LTR / 2
        taxRate: 5,
        total: 1940.00
      },
      {
        productName: 'HULK 250ML',
        batchNumber: 'VNK-HUL-002',
        quantity: 20, // 5 LTR = 1 Peti = 20 Bottles of 250ML
        weight: '250 ML',
        hsnCode: '31031000',
        price: 132.50, // 530.00 per LTR / 4
        taxRate: 5,
        total: 2650.00
      },
      {
        productName: 'RUDRA 505 1LTR/10100015',
        batchNumber: 'VNK-R505-002',
        quantity: 20, // 20 LTR = 2 Petis = 20 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 504.00,
        taxRate: 18,
        total: 10080.00
      }
    ]
  };

  const saved = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '304' },
    { $set: invoiceData },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n[SUCCESS] Invoice #304 Upserted:');
  console.log(' - Invoice No:', saved.invoiceNo);
  console.log(' - Dealer:', saved.dealerName);
  console.log(' - Total Amount: ₹' + saved.totalAmount);
  console.log(' - Dispatched Through:', saved.despatchedThrough);
  console.log(' - Destination:', saved.destination);
  console.log(' - Items Count:', saved.items.length);
  saved.items.forEach(itm => {
    console.log(`   * ${itm.productName} | Batch: ${itm.batchNumber} | Qty: ${itm.quantity} (${itm.weight}) | ₹${itm.total}`);
  });

  // Stock Availability Check
  const b1 = await StockBox.countDocuments({ productName: /KASOL/i, batchNumber: /VNK-KAS-002/i, status: 'available' });
  const b2 = await StockBox.countDocuments({ productName: /HULK/i, batchNumber: /VNK-HUL-002/i, status: 'available' });
  const b3 = await StockBox.countDocuments({ productName: /RUDRA/i, batchNumber: /VNK-R505-002/i, status: 'available' });

  console.log('\n[STOCK AVAILABILITY CHECK IN GODOWN]:');
  console.log(' - KASOL 500ML (VNK-KAS-002):', b1, 'boxes available (Required: 1 Peti)');
  console.log(' - HULK 250ML (VNK-HUL-002):', b2, 'boxes available (Required: 1 Peti)');
  console.log(' - RUDRA 505 1L (VNK-R505-002):', b3, 'boxes available (Required: 2 Petis)');

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

seedInvoice304().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
