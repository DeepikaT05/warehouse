const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');

async function seedInvoice301() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // 1. Find or create Dealer: TAMRAKAR AGROTECH BORI (4)
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

  // 2. Upsert Sales Invoice #301 (6 Peti, 60 LTR, ₹43,436.00)
  const invoiceData = {
    invoiceNo: '301',
    orderId: 'ORD-301',
    dealerId: dealer._id,
    dealerName: dealer.dealerName,
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'SELF VEHICAL',
    subtotal: 36810.00,
    totalTaxAmount: 6625.80,
    totalAmount: 43436.00,
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
        productName: 'AMBITION 500ML',
        batchNumber: 'SNG-AMB003',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 269.50, // 539.00 per LTR / 2
        taxRate: 18,
        total: 5390.00
      },
      {
        productName: 'PAROLI 1LTR/20100008',
        batchNumber: 'VNK-PAR-001',
        quantity: 10, // 10 LTR = 1 Peti = 10 Bottles of 1L
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 656.00,
        taxRate: 18,
        total: 6560.00
      },
      {
        productName: 'PAROLI 500ML/20050010',
        batchNumber: 'VNK-PAR-001',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 341.50, // 683.00 per LTR / 2
        taxRate: 18,
        total: 6830.00
      },
      {
        productName: 'VSTAR 500ML/20050112',
        batchNumber: 'VNK-VST-001',
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
    { invoiceNo: '301' },
    { $set: invoiceData },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n[SUCCESS] Invoice #301 Upserted:');
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
  const b1 = await StockBox.countDocuments({ productName: /AMBITION.*1/i, batchNumber: /SNG-AMB003/i, status: 'available' });
  const b2 = await StockBox.countDocuments({ productName: /AMBITION.*500/i, batchNumber: /SNG-AMB003/i, status: 'available' });
  const b3 = await StockBox.countDocuments({ productName: /PAROLI.*1/i, batchNumber: /VNK-PAR-001/i, status: 'available' });
  const b4 = await StockBox.countDocuments({ productName: /PAROLI.*500/i, batchNumber: /VNK-PAR-001/i, status: 'available' });
  const b5 = await StockBox.countDocuments({ productName: /VSTAR.*500/i, batchNumber: /VNK-VST-001/i, status: 'available' });

  console.log('\n[STOCK AVAILABILITY CHECK IN GODOWN]:');
  console.log(' - AMBITION 1L (SNG-AMB003):', b1, 'Petis available (Required: 2 Petis)');
  console.log(' - AMBITION 500ML (SNG-AMB003):', b2, 'Petis available (Required: 1 Peti)');
  console.log(' - PAROLI 1L (VNK-PAR-001):', b3, 'Petis available (Required: 1 Peti)');
  console.log(' - PAROLI 500ML (VNK-PAR-001):', b4, 'Petis available (Required: 1 Peti)');
  console.log(' - VSTAR 500ML (VNK-VST-001):', b5, 'Petis available (Required: 1 Peti)');

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

seedInvoice301().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
