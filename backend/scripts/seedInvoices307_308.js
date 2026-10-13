const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');
const Purchase = require('../models/Purchase');

async function seedInvoices307_308() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // ==========================================
  // 1. DEALER: Laxmi Krishi Kendra (Invoice #307)
  // ==========================================
  let dealer307 = await Dealer.findOne({
    $or: [
      { dealerName: /Laxmi/i },
      { gstNumber: '22ADZPT9520C1Z8' }
    ]
  });

  if (!dealer307) {
    dealer307 = await Dealer.create({
      dealerName: 'Laxmi Krishi Kendra',
      garageName: 'Laxmi Krishi Kendra',
      ownerName: 'Laxmi Krishi Kendra',
      gstNumber: '22ADZPT9520C1Z8',
      phone: '9826188888',
      email: 'laxmikrishikendra@gmail.com',
      address: 'House No-180, Ward No-07 Karhibadr, Sadar Road, Balod',
      state: 'Chhattisgarh',
      district: 'Balod',
      city: 'Balod',
      pincode: '491226'
    });
    console.log('[DEALER CREATED]:', dealer307.dealerName, dealer307._id);
  } else {
    console.log('[DEALER FOUND]:', dealer307.dealerName, dealer307._id);
  }

  // ==========================================
  // 2. INVOICE #307 (2 Peti, 20 LTR, ₹27,564.00)
  // ==========================================
  const invoice307Data = {
    invoiceNo: '307',
    orderId: 'ORD-307',
    dealerId: dealer307._id,
    dealerName: dealer307.dealerName,
    garageName: dealer307.garageName || 'Laxmi Krishi Kendra',
    dealerAddress: dealer307.address || 'House No-180, Ward No-07 Karhibadr, Sadar Road, Balod',
    dealerPhone: dealer307.phone || '9826188888',
    dealerGst: dealer307.gstNumber || '22ADZPT9520C1Z8',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'CG07BH3555',
    despatchedThrough: 'GUDDA GARAJ',
    subtotal: 23359.40,
    totalTaxAmount: 4204.68,
    totalAmount: 27564.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'AMBITION 500ML',
        batchNumber: 'SNG-AMB002',
        quantity: 20, // 10 LTR = 1 Peti = 20 Bottles of 500ML
        weight: '500 ML',
        hsnCode: '38089910',
        price: 568.985, // Rate 1137.97 per LTR / 2
        taxRate: 18,
        total: 11379.70
      },
      {
        productName: 'AMBITION 250ML',
        batchNumber: 'SNG-AMB002',
        quantity: 40, // 10 LTR = 1 Peti = 40 Bottles of 250ML
        weight: '250 ML',
        hsnCode: '38089910',
        price: 299.4925, // Rate 1197.97 per LTR / 4
        taxRate: 18,
        total: 11979.70
      }
    ]
  };

  const saved307 = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '307' },
    { $set: invoice307Data },
    { upsert: true, new: true, runValidators: false }
  );
  console.log('[SUCCESS] Invoice #307 Upserted:', saved307.invoiceNo, '| Amount: ₹' + saved307.totalAmount);

  // ==========================================
  // 3. DEALER: New Pooja Sales (Invoice #308)
  // ==========================================
  let dealer308 = await Dealer.findOne({
    $or: [
      { dealerName: /Pooja/i },
      { gstNumber: '22CUJPN4093B1ZT' }
    ]
  });

  if (!dealer308) {
    dealer308 = await Dealer.create({
      dealerName: 'New Pooja Sales',
      garageName: 'New Pooja Sales',
      ownerName: 'New Pooja Sales',
      gstNumber: '22CUJPN4093B1ZT',
      phone: '9826177777',
      email: 'newpoojasales@gmail.com',
      address: 'Bazar Chowk, Tifra, Bilaspur',
      state: 'Chhattisgarh',
      district: 'Bilaspur',
      city: 'Bilaspur',
      pincode: '495001'
    });
    console.log('[DEALER CREATED]:', dealer308.dealerName, dealer308._id);
  } else {
    console.log('[DEALER FOUND]:', dealer308.dealerName, dealer308._id);
  }

  // ==========================================
  // 4. INVOICE #308 (5 Peti, 25 KGS, ₹30,000.00)
  // ==========================================
  const invoice308Data = {
    invoiceNo: '308',
    orderId: 'ORD-308',
    dealerId: dealer308._id,
    dealerName: dealer308.dealerName,
    garageName: dealer308.garageName || 'New Pooja Sales',
    dealerAddress: dealer308.address || 'Bazar Chowk, Tifra, Bilaspur',
    dealerPhone: dealer308.phone || '9826177777',
    dealerGst: dealer308.gstNumber || '22CUJPN4093B1ZT',
    invoiceDate: new Date('2026-10-11T00:00:00.000Z'),
    destination: 'Bilaspur',
    despatchedThrough: 'OSHO EXPRESS',
    subtotal: 25423.86,
    totalTaxAmount: 4576.30,
    totalAmount: 30000.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    tallySyncStatus: 'synced',
    items: [
      {
        productName: 'FIGHTER - 50 (250 gm)',
        batchNumber: 'VNK-F50-002',
        quantity: 100, // 25.000 KGS = 5 Petis (each Peti 20 pcs x 250 gm = 5 KG) = 100 Pcs
        weight: '250 GM',
        hsnCode: '38089910',
        price: 254.2386,
        taxRate: 18,
        total: 25423.86
      }
    ]
  };

  const saved308 = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '308' },
    { $set: invoice308Data },
    { upsert: true, new: true, runValidators: false }
  );
  console.log('[SUCCESS] Invoice #308 Upserted:', saved308.invoiceNo, '| Amount: ₹' + saved308.totalAmount);

  // ==========================================
  // 5. SYNC ALL INVOICES TO TALLY 'synced'
  // ==========================================
  const salesSyncResult = await SalesInvoice.updateMany(
    { tallySyncStatus: { $ne: 'synced' } },
    { $set: { tallySyncStatus: 'synced' } }
  );
  console.log(`[TALLY SYNC]: Updated ${salesSyncResult.modifiedCount} SalesInvoices to 'synced'.`);

  const purchaseSyncResult = await Purchase.updateMany(
    { tallySyncStatus: { $ne: 'synced' } },
    { $set: { tallySyncStatus: 'synced' } }
  );
  console.log(`[TALLY SYNC]: Updated ${purchaseSyncResult.modifiedCount} Purchases to 'synced'.`);

  // ==========================================
  // 6. STOCK VERIFICATION FOR BOTH INVOICES
  // ==========================================
  const stock500 = await StockBox.countDocuments({
    productName: /AMBITION.*500/i,
    batchNumber: /SNG-AMB002/i,
    status: 'available'
  });
  const stock250 = await StockBox.countDocuments({
    productName: /AMBITION.*250/i,
    batchNumber: /SNG-AMB002/i,
    status: 'available'
  });
  const stockFighter = await StockBox.countDocuments({
    productName: /FIGHTER.*250/i,
    batchNumber: /VNK-F50-002/i,
    status: 'available'
  });

  console.log('\n[STOCK AVAILABILITY CHECK]:');
  console.log(' - AMBITION 500ML (SNG-AMB002):', stock500, 'available Petis (Required for #307: 1 Peti)');
  console.log(' - AMBITION 250ML (SNG-AMB002):', stock250, 'available Petis (Required for #306: 1 Peti, #307: 1 Peti)');
  console.log(' - FIGHTER - 50 250gm (VNK-F50-002):', stockFighter, 'available Petis (Required for #308: 5 Petis)');

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

seedInvoices307_308().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
