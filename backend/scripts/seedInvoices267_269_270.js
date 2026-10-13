const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');

async function seedAllThreeInvoices() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // Find Dealer TAMRAKAR AGROTECH
  let dealer = await Dealer.findOne({
    $or: [
      { dealerName: /TAMRAKAR AGROTECH/i },
      { phone: '9406161233' },
      { phone: '9826123456' }
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
    console.log('[DEALER CREATED]:', dealer.dealerName);
  } else {
    console.log('[DEALER FOUND]:', dealer.dealerName, dealer._id);
  }

  // ==========================================
  // 1. SEED / RESTORE TAX INVOICE #267 (7 Cases, ₹46,777)
  // ==========================================
  console.log('\n--- Processing Tax Invoice #267 ---');
  // Clean any multiple 267s first
  const existing267s = await SalesInvoice.find({ invoiceNo: '267' });
  if (existing267s.length > 1) {
    for (let i = 1; i < existing267s.length; i++) {
      await SalesInvoice.deleteOne({ _id: existing267s[i]._id });
    }
  }

  const invoice267Data = {
    invoiceNo: '267',
    orderId: 'ORD-267001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
    destination: 'BORI',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 41041.64,
    totalTaxAmount: 5735.20,
    totalAmount: 46777.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'RUBICON 250ML',
        batchNumber: 'VNK-RUB-001',
        quantity: 40, // 2 cases x 20 = 40 pcs (10 LTR)
        weight: '250 ML',
        hsnCode: '31031000',
        price: 609,
        taxRate: 5,
        total: 6090
      },
      {
        productName: 'RUBICON 100ML',
        batchNumber: 'VNK-RUB001',
        quantity: 100, // 2 cases x 50 = 100 pcs (10 LTR)
        weight: '100 ML',
        hsnCode: '31031000',
        price: 662,
        taxRate: 5,
        total: 6620
      },
      {
        productName: 'MATIX 666GM/10066114',
        batchNumber: 'VNK-MTX-002',
        quantity: 30, // 3 cases x 10 = 30 pcs (19.98 KG)
        weight: '666 GM',
        hsnCode: '38089910',
        price: 1418,
        taxRate: 18,
        total: 28331.64
      }
    ]
  };

  const inv267 = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '267' },
    { $set: invoice267Data },
    { upsert: true, new: true }
  );
  console.log(`[INVOICE 267 OK]: ₹${inv267.totalAmount}, items: ${inv267.items.length}`);

  // ==========================================
  // 2. CLEAN & SEED TAX INVOICE #270 (4 Cases, ₹34,971) - PREVENT DUPLICATES
  // ==========================================
  console.log('\n--- Processing Tax Invoice #270 ---');
  // Remove any duplicate 270s if any
  const existing270s = await SalesInvoice.find({ invoiceNo: '270' });
  if (existing270s.length > 1) {
    console.log(`Found ${existing270s.length} entries for 270. Keeping 1 and removing duplicates...`);
    for (let i = 1; i < existing270s.length; i++) {
      await SalesInvoice.deleteOne({ _id: existing270s[i]._id });
    }
  }

  const invoice270Data = {
    invoiceNo: '270',
    orderId: 'ORD-270001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
    destination: 'DURG',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 29636.80,
    totalTaxAmount: 5334.62,
    totalAmount: 34971.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'MATIX 266.4GM/10026003',
        batchNumber: 'VNK-MTX-001',
        quantity: 40, // 2 cases x 20 = 40 pcs (10.66 KG)
        weight: '266 GM',
        hsnCode: '38089910',
        price: 1550,
        taxRate: 18,
        total: 16516.80
      },
      {
        productName: 'PAROLI 1LTR/20100008',
        batchNumber: 'VNK-PAR-001',
        quantity: 20, // 2 cases x 10 = 20 pcs (20.00 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 656,
        taxRate: 18,
        total: 13120.00
      }
    ]
  };

  const inv270 = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '270' },
    { $set: invoice270Data },
    { upsert: true, new: true }
  );
  console.log(`[INVOICE 270 OK (SINGLE)]: ₹${inv270.totalAmount}, items: ${inv270.items.length}`);

  // ==========================================
  // 3. SEED TAX INVOICE #269 (6 Cases, ₹43,104)
  // ==========================================
  console.log('\n--- Processing Tax Invoice #269 ---');
  // Remove duplicate 269s if any exist
  const existing269s = await SalesInvoice.find({ invoiceNo: '269' });
  if (existing269s.length > 1) {
    for (let i = 1; i < existing269s.length; i++) {
      await SalesInvoice.deleteOne({ _id: existing269s[i]._id });
    }
  }

  const invoice269Data = {
    invoiceNo: '269',
    orderId: 'ORD-269001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
    destination: 'DURG',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 37200.00,
    totalTaxAmount: 5904.30,
    totalAmount: 43104.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'AMBITION 1LTR',
        batchNumber: 'SNG-AMB001',
        quantity: 30, // 3 cases x 10 = 30 pcs (30.00 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 617,
        taxRate: 18,
        total: 18510.00
      },
      {
        productName: 'NEXON 1LTR/20100005',
        batchNumber: 'VNK-NEX-004',
        quantity: 10, // 1 case x 10 = 10 pcs (10.00 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 1260,
        taxRate: 18,
        total: 12600.00
      },
      {
        productName: 'RUBICON 250ML',
        batchNumber: 'VNK-RUB-001',
        quantity: 40, // 2 cases x 20 = 40 pcs (10.00 LTR)
        weight: '250 ML',
        hsnCode: '31031000',
        price: 609,
        taxRate: 5,
        total: 6090.00
      }
    ]
  };

  const inv269 = await SalesInvoice.findOneAndUpdate(
    { invoiceNo: '269' },
    { $set: invoice269Data },
    { upsert: true, new: true }
  );
  console.log(`[INVOICE 269 OK]: ₹${inv269.totalAmount}, items: ${inv269.items.length}`);

  // Summary Verification
  const checkAll = await SalesInvoice.find({ invoiceNo: { $in: ['267', '269', '270'] } }).lean();
  console.log('\n=== FINAL VERIFICATION OF INVOICES ===');
  checkAll.forEach(inv => {
    console.log(`Invoice #${inv.invoiceNo}: ₹${inv.totalAmount} | Dealer: ${inv.dealerName} | Items: ${inv.items.length}`);
    inv.items.forEach(it => {
      console.log(`   - ${it.productName} (${it.batchNumber}) -> Qty: ${it.quantity} Pcs, Weight: ${it.weight}`);
    });
  });

  process.exit(0);
}

seedAllThreeInvoices().catch(err => {
  console.error('Error seeding invoices:', err);
  process.exit(1);
});
