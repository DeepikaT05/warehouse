const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');

async function seedAllFourInvoices() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // 1. Ensure Dealer TAMRAKAR AGROTECH
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

  // 2. Ensure product aliases for TORANTO 250GM
  await Product.updateOne(
    { name: 'TORANTO 250GM (124)' },
    {
      $setOnInsert: {
        name: 'TORANTO 250GM (124)',
        productCode: 'TORANTO-250',
        packingSize: '250 GM',
        conversion: 20,
        isDeleted: false
      }
    },
    { upsert: true }
  );

  // Helper function to upsert an invoice and remove any duplicates
  async function upsertInvoice(invoiceNo, data) {
    console.log(`\n=== Upserting Invoice #${invoiceNo} ===`);
    // Delete duplicates if more than 1 exists
    const existing = await SalesInvoice.find({ invoiceNo });
    if (existing.length > 1) {
      console.log(`Found ${existing.length} records for invoice #${invoiceNo}. Removing duplicates...`);
      for (let i = 1; i < existing.length; i++) {
        await SalesInvoice.deleteOne({ _id: existing[i]._id });
      }
    }

    const saved = await SalesInvoice.findOneAndUpdate(
      { invoiceNo },
      { $set: data },
      { upsert: true, new: true, runValidators: false }
    );
    console.log(`Invoice #${saved.invoiceNo} successfully updated/inserted:`);
    console.log(`  - Dealer: ${saved.dealerName}`);
    console.log(`  - Total Amount: ₹${saved.totalAmount}`);
    console.log(`  - Destination: ${saved.destination}`);
    console.log(`  - Dispatch: ${saved.despatchedThrough}`);
    console.log(`  - Items Count: ${saved.items.length}`);
    return saved;
  }

  // ==========================================
  // INVOICE #267 (7 Peti, ₹46,777)
  // ==========================================
  await upsertInvoice('267', {
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
        price: 725,
        taxRate: 5,
        total: 7250
      },
      {
        productName: 'MATIX 666GM/10066114',
        batchNumber: 'VNK-MTX-002',
        quantity: 30, // 3 cases x 10 = 30 pcs (19.98 KG)
        weight: '666 GM',
        hsnCode: '38089910',
        price: 1386.47,
        taxRate: 18,
        total: 27701.64
      }
    ]
  });

  // ==========================================
  // INVOICE #268 (3 Peti, ₹40,266)
  // ==========================================
  await upsertInvoice('268', {
    invoiceNo: '268',
    orderId: 'ORD-268001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
    destination: 'BORI',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 34123.88,
    totalTaxAmount: 6142.30,
    totalAmount: 40266.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'MATIX 666GM/10066114',
        batchNumber: 'VNK-MTX-002',
        quantity: 10, // 1 case x 10 = 10 pcs (6.66 KGS)
        weight: '666 GM',
        hsnCode: '38089910',
        price: 1418,
        taxRate: 18,
        total: 9443.88
      },
      {
        productName: 'TORANTO 250GM  (124)',
        batchNumber: 'VBK-TOR-003',
        quantity: 40, // 2 cases x 20 = 40 pcs (10.00 KGS)
        weight: '250 GM',
        hsnCode: '38089910',
        price: 2468,
        taxRate: 18,
        total: 24680.00
      }
    ]
  });

  // ==========================================
  // INVOICE #269 (6 Peti, ₹43,104)
  // ==========================================
  await upsertInvoice('269', {
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
  });

  // ==========================================
  // INVOICE #270 (4 Peti, ₹34,971)
  // ==========================================
  await upsertInvoice('270', {
    invoiceNo: '270',
    orderId: 'ORD-270001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
    destination: 'BORI',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 31224.11,
    totalTaxAmount: 3746.89,
    totalAmount: 34971.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'MATIX 266.4GM/10026003',
        batchNumber: 'VNK-MTX-001',
        quantity: 40, // 2 cases x 20 = 40 pcs (10.656 KG)
        weight: '266.4 GM',
        hsnCode: '38089910',
        price: 1673.30,
        taxRate: 18,
        total: 17830.68
      },
      {
        productName: 'PAROLI 1LTR/20100008',
        batchNumber: 'VNK-PAR-001',
        quantity: 20, // 2 cases x 10 = 20 pcs (20.00 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 669.67,
        taxRate: 18,
        total: 13393.43
      }
    ]
  });

  console.log('\n=============================================');
  console.log('ALL 4 INVOICES (267, 268, 269, 270) SEEDED!');
  console.log('=============================================');
  await mongoose.disconnect();
}

seedAllFourInvoices().catch(err => {
  console.error('Error seeding invoices:', err);
  process.exit(1);
});
