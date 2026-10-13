const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');

async function seedInvoice305() {
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

  // 2. Upsert Sales Invoice #305 (6 Peti, 60 LTR, ₹33,559.00)
  const invoiceData = {
    invoiceNo: '305',
    orderId: 'ORD-305',
    dealerId: dealer._id,
    dealerName: dealer.dealerName,
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'SELF VEHICAL',
    subtotal: 28440.00,
    totalTaxAmount: 5119.20,
    totalAmount: 33559.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'AMBITION 1LTR',
        batchNumber: 'SNG-AMB003',
        quantity: 20, // 20 LTR = 2 Petis = 20 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 508.00,
        taxRate: 18,
        total: 10160.00
      },
      {
        productName: 'VALID 1LTR/40100030',
        batchNumber: 'VNK-VLD-002',
        quantity: 10, // 10 LTR = 1 Peti = 10 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 179.00,
        taxRate: 18,
        total: 1790.00
      },
      {
        productName: 'PAYTHEN 500ML/10050163',
        batchNumber: 'VNK-PBF-001',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 310.00, // 620.00 per LTR / 2
        taxRate: 18,
        total: 6200.00
      },
      {
        productName: 'RUDRA 505 1LTR/10100015',
        batchNumber: 'VNK-R505-002',
        quantity: 10, // 10 LTR = 1 Peti = 10 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 504.00,
        taxRate: 18,
        total: 5040.00
      },
      {
        productName: 'RUDRA 505 500ML/10050016',
        batchNumber: 'VNK-R505-001',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 262.50, // 525.00 per LTR / 2
        taxRate: 18,
        total: 5250.00
      }
    ]
  };

  const saved = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '305' },
    { $set: invoiceData },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n[SUCCESS] Invoice #305 Upserted:');
  console.log(' - Invoice No:', saved.invoiceNo);
  console.log(' - Dealer:', saved.dealerName);
  console.log(' - Total Amount: ₹' + saved.totalAmount);
  console.log(' - Dispatched Through:', saved.despatchedThrough);
  console.log(' - Destination:', saved.destination);
  console.log(' - Items Count:', saved.items.length);
  saved.items.forEach(itm => {
    console.log(`   * ${itm.productName} | Batch: ${itm.batchNumber} | Qty: ${itm.quantity} (${itm.weight}) | ₹${itm.total}`);
  });

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

seedInvoice305().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
