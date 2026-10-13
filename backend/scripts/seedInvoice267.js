const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const Product = require('../models/Product');

async function seedInvoice267() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected.');

  // 1. Check or Create Dealer TAMRAKAR AGROTECH BORI (4)
  let dealer = await Dealer.findOne({
    $or: [
      { dealerName: /TAMRAKAR AGROTECH BORI/i },
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

  // 2. Check Product Master for MATIX 666GM/10066114
  let matixProd = await Product.findOne({ name: 'MATIX 666GM/10066114' });
  if (!matixProd) {
    matixProd = await Product.create({
      productCode: 'PRD-100067',
      name: 'MATIX 666GM/10066114',
      technicalName: 'DINOTEFURAN 15% +PYMERTOZINE 45% WG',
      category: 'Crop Protection',
      hsnCode: '38089910',
      unit: 'kg',
      packingSize: '666 GM',
      conversion: 10,
      alternateUnit: 'BOX',
      mrp: 1500,
      minStockThreshold: 20
    });
    console.log('[PRODUCT CREATED]:', matixProd.name);
  }

  // 3. Ensure Inward Stock for MATIX 666GM/10066114 (Batch VNK-MTX-002)
  const existingMatixBoxes = await StockBox.countDocuments({
    productName: 'MATIX 666GM/10066114',
    batchNumber: 'VNK-MTX-002',
    isDeleted: { $ne: true }
  });

  if (existingMatixBoxes === 0) {
    console.log('[INWARD STOCK]: Creating purchase & stock boxes for MATIX 666GM/10066114...');

    let purchase = await Purchase.findOne({ invoiceNumber: 'VNK-TLY-060' });
    if (!purchase) {
      purchase = await Purchase.create({
        invoiceNumber: 'VNK-TLY-060',
        purchaseDate: new Date('2025-09-29T00:00:00.000Z'),
        invoiceDate: new Date('2025-09-29T00:00:00.000Z'),
        manufacturer: 'VANIKI CROP SCIENCE PVT. LTD.',
        productName: 'MATIX 666GM/10066114',
        technicalName: 'DINOTEFURAN 15% +PYMERTOZINE 45% WG',
        hsnCode: '38089910',
        category: 'Crop Protection',
        batchNumber: 'VNK-MTX-002',
        packing: '666 GM',
        packingSize: '666 GM',
        unit: 'kg',
        weight: '66.6 KGS',
        quantity: 100, // 10 cases = 100 pieces
        cases: 10,
        conversion: 10,
        purchaseCost: 945,
        costRate: 945,
        totalCost: 94500,
        mrp: 1500,
        mfgDate: new Date('2025-09-29T00:00:00.000Z'),
        expDate: new Date('2027-09-28T00:00:00.000Z'),
        warehouseLocation: 'RAIPUR GODOWN',
        remarks: 'Tally Inward: RAIPUR GODOWN | Batch: VNK-MTX-002 | 10 Cases (100 Pcs)',
        status: 'barcode_generated',
        isLocked: true,
        tallySyncStatus: 'synced',
        enteredByUsername: 'warehouse1'
      });
    }

    // Find highest existing QR number
    const [top] = await StockBox.aggregate([
      { $match: { qrId: /^VNK-\d+$/ } },
      { $project: { num: { $toInt: { $substrBytes: ['$qrId', 4, 12] } } } },
      { $sort: { num: -1 } },
      { $limit: 1 }
    ]);
    let nextNum = (top?.num || 50882) + 1;

    const boxDocs = [];
    const now = new Date();
    for (let i = 0; i < 100; i++) {
      const qrId = `VNK-${nextNum + i}`;
      boxDocs.push({
        qrId,
        barcode: qrId,
        purchaseId: purchase._id,
        purchaseInvoice: 'VNK-TLY-060',
        productName: 'MATIX 666GM/10066114',
        technicalName: 'DINOTEFURAN 15% +PYMERTOZINE 45% WG',
        manufacturer: 'VANIKI CROP SCIENCE PVT. LTD.',
        batchNumber: 'VNK-MTX-002',
        packing: '666 GM',
        packingSize: '666 GM',
        unit: 'kg',
        weight: '66.6 KGS',
        cases: 10,
        conversion: 10,
        hsnCode: '38089910',
        category: 'Crop Protection',
        purchaseCost: 945,
        totalCost: 945,
        costRate: 945,
        mrp: 1500,
        mfgDate: new Date('2025-09-29T00:00:00.000Z'),
        expDate: new Date('2027-09-28T00:00:00.000Z'),
        warehouseLocation: 'RAIPUR GODOWN',
        status: 'available',
        stickerStatus: 'not_printed',
        verificationStatus: 'pending_verification',
        history: [
          {
            stage: 'Purchase Received',
            title: 'Purchase Inward Logged',
            description: 'Imported Batch VNK-MTX-002 (RAIPUR GODOWN) - 10 Cases (100 Pcs)',
            performedBy: 'warehouse1',
            timestamp: now
          },
          {
            stage: 'QR Generated',
            title: 'Unique Barcode/QR Assigned',
            description: `Unique identity ${qrId} generated for box`,
            performedBy: 'warehouse1',
            timestamp: now
          }
        ]
      });
    }

    await StockBox.insertMany(boxDocs, { ordered: true });
    console.log(`[STOCKBOXES CREATED]: 100 boxes created for MATIX 666GM/10066114 (VNK-${nextNum} to VNK-${nextNum + 99})`);
  } else {
    console.log(`[STOCKBOXES FOUND]: ${existingMatixBoxes} boxes already exist for MATIX 666GM/10066114.`);
  }

  // 4. Create or Update Sales Invoice 267
  const invoiceData = {
    invoiceNo: '267',
    orderId: `ORD-${Date.now().toString().slice(-6)}`,
    dealerId: dealer._id,
    dealerName: dealer.dealerName || 'TAMRAKAR AGROTECH BORI (4)',
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
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
        quantity: 40, // 2 cases of 20 = 40 pieces (10 LTR)
        weight: '250 ML',
        hsnCode: '31031000',
        price: 609,
        taxRate: 5,
        total: 6090
      },
      {
        productName: 'RUBICON 100ML',
        batchNumber: 'VNK-RUB001',
        quantity: 100, // 2 cases of 50 = 100 pieces (10 LTR)
        weight: '100 ML',
        hsnCode: '31031000',
        price: 662,
        taxRate: 5,
        total: 6620
      },
      {
        productName: 'MATIX 666GM/10066114',
        batchNumber: 'VNK-MTX-002',
        quantity: 30, // 3 cases of 10 = 30 pieces (19.98 KGS)
        weight: '666 GM',
        hsnCode: '38089910',
        price: 1418,
        taxRate: 18,
        total: 28331.64
      }
    ]
  };

  const existingInvoice = await SalesInvoice.findOne({ invoiceNo: '267' });
  let savedInvoice;
  if (existingInvoice) {
    Object.assign(existingInvoice, invoiceData);
    savedInvoice = await existingInvoice.save();
    console.log('[INVOICE UPDATED]: Invoice #267 updated successfully.');
  } else {
    savedInvoice = await SalesInvoice.create(invoiceData);
    console.log('[INVOICE CREATED]: Invoice #267 created successfully.');
  }

  console.log('Invoice Summary:');
  console.log(' - Invoice No:', savedInvoice.invoiceNo);
  console.log(' - Dealer:', savedInvoice.dealerName);
  console.log(' - Date:', savedInvoice.invoiceDate);
  console.log(' - Total Amount: ₹' + savedInvoice.totalAmount);
  console.log(' - Items:');
  savedInvoice.items.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.productName} (Batch: ${item.batchNumber}) - Qty: ${item.quantity} Pcs, Weight: ${item.weight}`);
  });

  process.exit(0);
}

seedInvoice267().catch(err => {
  console.error('Error seeding invoice 267:', err);
  process.exit(1);
});
