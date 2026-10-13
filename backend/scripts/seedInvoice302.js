const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');

async function seedInvoice302() {
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

  // 2. Upsert Sales Invoice #302 (7 Peti, 66 LTR, ₹49,272.00)
  const invoiceData = {
    invoiceNo: '302',
    orderId: 'ORD-302',
    dealerId: dealer._id,
    dealerName: dealer.dealerName,
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'Self Vehical',
    subtotal: 41756.00,
    totalTaxAmount: 7516.08,
    totalAmount: 49272.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'VSTAR 1L/20100110',
        batchNumber: 'VNK-VST-002',
        quantity: 20, // 20 LTR = 2 Petis = 20 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 761.00,
        taxRate: 18,
        total: 15220.00
      },
      {
        productName: 'VASH SUPER 1LTR/10100043',
        batchNumber: 'VNK-VSV-001',
        quantity: 30, // 30 LTR = 3 Petis = 30 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 368.00,
        taxRate: 18,
        total: 11040.00
      },
      {
        productName: 'VIGEN 150ML/10015077',
        batchNumber: 'VN-VIG01',
        quantity: 40, // 6 LTR = 1 Peti = 40 Bottles of 150ML
        weight: '150 ML',
        hsnCode: '38089910',
        price: 190.65, // 1271.00 per LTR x 0.150
        taxRate: 18,
        total: 7626.00
      },
      {
        productName: 'VIVAN SUPER 500ML/10050098',
        batchNumber: 'VNK-VS-002',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 393.50, // 787.00 per LTR / 2
        taxRate: 18,
        total: 7870.00
      }
    ]
  };

  const saved = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '302' },
    { $set: invoiceData },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n[SUCCESS] Invoice #302 Upserted:');
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

seedInvoice302().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
