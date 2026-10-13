const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');

async function seedInvoice306() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // 1. Find or create Dealer: Maa Gayatri Krishi Kendra
  let dealer = await Dealer.findOne({
    $or: [
      { dealerName: /Gayatri/i },
      { gstNumber: '22FYTPS5880Q1Z3' }
    ]
  });

  if (!dealer) {
    dealer = await Dealer.create({
      dealerName: 'Maa Gayatri Krishi Kendra',
      garageName: 'Maa Gayatri Krishi Kendra',
      ownerName: 'Maa Gayatri Krishi Kendra',
      gstNumber: '22FYTPS5880Q1Z3',
      phone: '9826199999',
      email: 'maagayatrikrishikendra@gmail.com',
      address: 'Kamraud, Main Road, Panchayat Bhawan, Balod',
      state: 'Chhattisgarh',
      district: 'Balod',
      city: 'Balod',
      pincode: '491226'
    });
    console.log('[DEALER CREATED]:', dealer.dealerName, dealer._id);
  } else {
    console.log('[DEALER FOUND]:', dealer.dealerName, dealer._id);
  }

  // 2. Upsert Sales Invoice #306
  const invoiceData = {
    invoiceNo: '306',
    orderId: 'ORD-306',
    dealerId: dealer._id,
    dealerName: dealer.dealerName,
    garageName: dealer.garageName || 'Maa Gayatri Krishi Kendra',
    dealerAddress: dealer.address || 'Kamraud, Main Road, Panchayat Bhawan, Balod',
    dealerPhone: dealer.phone || '9826199999',
    dealerGst: dealer.gstNumber || '22FYTPS5880Q1Z3',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'GUDDA GARAJ',
    subtotal: 22759.40,
    totalTaxAmount: 4096.68,
    totalAmount: 26856.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'AMBITION 1LTR',
        batchNumber: 'SNG-AMB002',
        quantity: 10, // 10 LTR = 1 Peti = 10 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 1077.97,
        taxRate: 18,
        total: 10779.70
      },
      {
        productName: 'AMBITION 250ML',
        batchNumber: 'SNG-AMB002',
        quantity: 40, // 10 LTR = 1 Peti = 40 Bottles of 250ML
        weight: '250 ML',
        hsnCode: '38089910',
        price: 299.4925,
        taxRate: 18,
        total: 11979.70
      }
    ]
  };

  const saved = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '306' },
    { $set: invoiceData },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n[SUCCESS] Invoice #306 Upserted:');
  console.log(' - Invoice No:', saved.invoiceNo);
  console.log(' - Dealer:', saved.dealerName);
  console.log(' - Total Amount: ₹' + saved.totalAmount);
  console.log(' - Dispatched Through:', saved.despatchedThrough);
  console.log(' - Destination:', saved.destination);
  console.log(' - Items Count:', saved.items.length);
  saved.items.forEach(itm => {
    console.log(`   * ${itm.productName} | Batch: ${itm.batchNumber} | Qty: ${itm.quantity} (${itm.weight}) | ₹${itm.total}`);
  });

  // Check matching stock availability
  const boxes1L = await StockBox.countDocuments({
    productName: /AMBITION.*1/i,
    batchNumber: /SNG-AMB002/i,
    status: 'available'
  });
  const boxes250 = await StockBox.countDocuments({
    productName: /AMBITION.*250/i,
    batchNumber: /SNG-AMB002/i,
    status: 'available'
  });
  console.log('\n[STOCK AVAILABILITY]:');
  console.log(' - AMBITION 1L (SNG-AMB002):', boxes1L, 'available Petis (Required: 1 Peti)');
  console.log(' - AMBITION 250ML (SNG-AMB002):', boxes250, 'available Petis (Required: 1 Peti)');

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

seedInvoice306().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
