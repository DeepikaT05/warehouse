const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');

async function seedInvoice303() {
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

  // 2. Upsert Sales Invoice #303 (9 Peti, ₹46,506.00)
  const invoiceData = {
    invoiceNo: '303',
    orderId: 'ORD-303',
    dealerId: dealer._id,
    dealerName: dealer.dealerName,
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'SELF VEHICAL',
    subtotal: 39411.60,
    totalTaxAmount: 7094.08,
    totalAmount: 46506.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'VIVAN SUPER 250ML/10025097',
        batchNumber: 'VNK-VS-002',
        quantity: 40, // 10 LTR = 1 Peti = 40 Bottles of 250ML
        weight: '250 ML',
        hsnCode: '38089910',
        price: 197.75, // 791.00 per LTR / 4
        taxRate: 18,
        total: 7910.00
      },
      {
        productName: 'VASH SUPER 500ML/10050044',
        batchNumber: 'VNK-VSV-001',
        quantity: 40, // 20 LTR = 2 Petis = 40 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 252.00, // 504.00 per LTR / 2
        taxRate: 18,
        total: 10080.00
      },
      {
        productName: 'VALID 1LTR/40100030',
        batchNumber: 'VNK-VLD-002',
        quantity: 20, // 20 LTR = 2 Petis = 20 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 179.00,
        taxRate: 18,
        total: 3580.00
      },
      {
        productName: 'VALID 500ML/40050032',
        batchNumber: 'VNK-VLD-002',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 97.00, // 194.00 per LTR / 2
        taxRate: 18,
        total: 1940.00
      },
      {
        productName: 'MATIX 266.4GM/10026003',
        batchNumber: 'VNK-MTX-003',
        quantity: 20, // 5.328 KGS = 1 Peti = 20 Packs of 266.4 GM
        weight: '266.4 GM',
        hsnCode: '38089910',
        price: 419.58, // 1575.00 per KG x 0.2664
        taxRate: 18,
        total: 8391.60
      },
      {
        productName: 'STICK MAX 500ML/40050021',
        batchNumber: '34021110',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 184.00, // 368.00 per LTR / 2
        taxRate: 18,
        total: 3680.00
      },
      {
        productName: 'STICK MAX 250ML/40025021',
        batchNumber: '34021110',
        quantity: 40, // 10 LTR = 1 Peti = 40 Bottles of 250ML
        weight: '250 ML',
        hsnCode: '38089910',
        price: 95.75, // 383.00 per LTR / 4
        taxRate: 18,
        total: 3830.00
      }
    ]
  };

  const saved = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '303' },
    { $set: invoiceData },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n[SUCCESS] Invoice #303 Upserted:');
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

seedInvoice303().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
