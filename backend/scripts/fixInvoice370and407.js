const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');

async function fixInvoices() {
  console.log('Connecting to:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  // ==========================================
  // 1. FIX INVOICE #370 (SNG/MH26-27/370)
  // ==========================================
  console.log('\n--- Updating Invoice #370 ---');
  const p370 = await Purchase.find({ invoiceNumber: /370/i }).sort({ _id: 1 });
  console.log(`Found ${p370.length} purchase lines for Invoice #370.`);

  const map370 = [
    {
      packing: '1 LTR X 10',
      productName: 'VAT SUPER 1LTR/20100051',
      packingSize: '1 LTR',
      conversion: 10,
      cases: 10,
      quantity: 100,
      unit: 'Ltr',
      batchNumber: 'VNK-VTS002',
      costRate: 530,
      totalCost: 53000
    },
    {
      packing: '500 ML X 20',
      productName: 'VAT SUPER 500ML/20050053',
      packingSize: '500 ML',
      conversion: 20,
      cases: 10,
      quantity: 100,
      unit: 'Ltr',
      batchNumber: 'VNK-VTS002',
      costRate: 555,
      totalCost: 55500
    },
    {
      packing: '250 ML X 40',
      productName: 'VAT SUPER 250ML/20025052',
      packingSize: '250 ML',
      conversion: 40,
      cases: 10,
      quantity: 100,
      unit: 'Ltr',
      batchNumber: 'VNK-VTS002',
      costRate: 580,
      totalCost: 58000
    },
    {
      packing: '1 LTR X 10',
      productName: 'VSTAR 1L/20100110',
      packingSize: '1 LTR',
      conversion: 10,
      cases: 10,
      quantity: 100,
      unit: 'Ltr',
      batchNumber: 'VNK-VST-002',
      costRate: 725,
      totalCost: 72500
    },
    {
      packing: '500 ML X 20',
      productName: 'VSTAR 500ML/20050112',
      packingSize: '500 ML',
      conversion: 20,
      cases: 10,
      quantity: 100,
      unit: 'Ltr',
      batchNumber: 'VNK-VST-002',
      costRate: 750,
      totalCost: 75000
    },
    {
      packing: '250 ML X 40',
      productName: 'VSTAR 250ML/20025111',
      packingSize: '250 ML',
      conversion: 40,
      cases: 10,
      quantity: 100,
      unit: 'Ltr',
      batchNumber: 'VNK-VST-002',
      costRate: 775,
      totalCost: 77500
    },
    {
      packing: '100 ML X 50',
      productName: 'VIVAN SUPER 100ML/10001096',
      packingSize: '100 ML',
      conversion: 50,
      cases: 5,
      quantity: 25,
      unit: 'Ltr',
      batchNumber: 'VNK-VS-003',
      costRate: 825,
      totalCost: 20625
    }
  ];

  for (let i = 0; i < p370.length && i < map370.length; i++) {
    const doc = p370[i];
    const m = map370[i];
    await Purchase.updateOne(
      { _id: doc._id },
      {
        $set: {
          productName: m.productName,
          packing: m.packing,
          packingSize: m.packingSize,
          casePacking: m.packing,
          conversion: m.conversion,
          cases: m.cases,
          quantity: m.quantity,
          unit: m.unit,
          costRate: m.costRate,
          purchaseCost: m.costRate,
          totalCost: m.totalCost,
          tallySyncStatus: 'synced',
          tallyVoucherNumber: 'SNG/MH26-27/370',
          tallySyncedAt: new Date()
        }
      }
    );
    console.log(`Updated Purchase line ${i + 1}: ${m.productName} (${m.cases} Cases, ${m.quantity} ${m.unit})`);

    // Update corresponding StockBoxes
    const sbRes = await StockBox.updateMany(
      { purchaseId: doc._id },
      {
        $set: {
          productName: m.productName,
          packing: m.packing,
          packingSize: m.packingSize,
          casePacking: m.packing,
          conversion: m.conversion,
          cases: m.cases,
          costRate: m.costRate,
          purchaseCost: m.costRate
        }
      }
    );
    console.log(`  -> Updated ${sbRes.modifiedCount} StockBoxes for line ${i + 1}`);
  }

  // ==========================================
  // 2. FIX INVOICE #407 (SNG/MH26-27/407)
  // ==========================================
  console.log('\n--- Updating Invoice #407 ---');
  const p407 = await Purchase.find({ invoiceNumber: /407/i }).sort({ _id: 1 });
  console.log(`Found ${p407.length} purchase lines for Invoice #407.`);

  const map407 = [
    {
      productName: 'AMBITION 1LTR',
      packing: '1 LTR X 10',
      packingSize: '1 LTR',
      conversion: 10,
      cases: 20,
      quantity: 200,
      unit: 'ltr',
      batchNumber: 'SNG-AMB002',
      costRate: 498,
      totalCost: 99600
    },
    {
      productName: 'AMBITION 1LTR',
      packing: '1 LTR X 10',
      packingSize: '1 LTR',
      conversion: 10,
      cases: 20,
      quantity: 200,
      unit: 'ltr',
      batchNumber: 'SNG-AMB003',
      costRate: 498,
      totalCost: 99600
    },
    {
      productName: 'AMBITION 500ML',
      packing: '500 ML X 20',
      packingSize: '500 ML',
      conversion: 20,
      cases: 20,
      quantity: 200,
      unit: 'ltr',
      batchNumber: 'SNG-AMB002',
      costRate: 528,
      totalCost: 105600
    },
    {
      productName: 'AMBITION 500ML',
      packing: '500 ML X 20',
      packingSize: '500 ML',
      conversion: 20,
      cases: 10,
      quantity: 100,
      unit: 'ltr',
      batchNumber: 'SNG-AMB003',
      costRate: 528,
      totalCost: 52800
    },
    {
      productName: 'AMBITION  250ML',
      packing: '250 ML X 40',
      packingSize: '250 ML',
      conversion: 40,
      cases: 10,
      quantity: 100,
      unit: 'ltr',
      batchNumber: 'SNG-AMB002',
      costRate: 558,
      totalCost: 55800
    },
    {
      productName: 'AMBITION  250ML',
      packing: '250 ML X 40',
      packingSize: '250 ML',
      conversion: 40,
      cases: 5,
      quantity: 50,
      unit: 'ltr',
      batchNumber: 'SNG-AMB003',
      costRate: 558,
      totalCost: 27900
    },
    {
      productName: 'MATIX 133.2GM/10013002',
      packing: '133.2 GM X 50',
      packingSize: '133.2 GM',
      conversion: 50,
      cases: 10,
      quantity: 66.6,
      unit: 'kg',
      batchNumber: 'VNK-MTX-005',
      costRate: 1550,
      totalCost: 103230
    },
    {
      productName: 'MATIX 266.4GM/10026003',
      packing: '266.4 GM X 20',
      packingSize: '266.4 GM',
      conversion: 20,
      cases: 10,
      quantity: 53.281,
      unit: 'kg',
      batchNumber: 'VNK-MTX-004',
      costRate: 1500,
      totalCost: 79921.5
    },
    {
      productName: 'MATIX 666GM/10066114',
      packing: '666 GM X 10',
      packingSize: '666 GM',
      conversion: 10,
      cases: 10,
      quantity: 66.6,
      unit: 'kg',
      batchNumber: 'VNK-MTX-005',
      costRate: 1450,
      totalCost: 96570
    }
  ];

  for (let i = 0; i < p407.length && i < map407.length; i++) {
    const doc = p407[i];
    const m = map407[i];
    await Purchase.updateOne(
      { _id: doc._id },
      {
        $set: {
          productName: m.productName,
          packing: m.packing,
          packingSize: m.packingSize,
          casePacking: m.packing,
          conversion: m.conversion,
          cases: m.cases,
          quantity: m.quantity,
          unit: m.unit,
          costRate: m.costRate,
          purchaseCost: m.costRate,
          totalCost: m.totalCost,
          tallySyncStatus: 'synced',
          tallyVoucherNumber: 'SNG/MH26-27/407',
          tallySyncedAt: new Date()
        }
      }
    );
    console.log(`Updated Purchase line ${i + 1}: ${m.productName} (${m.cases} Cases, ${m.quantity} ${m.unit})`);

    // Update corresponding StockBoxes
    const sbRes = await StockBox.updateMany(
      { purchaseId: doc._id },
      {
        $set: {
          productName: m.productName,
          packing: m.packing,
          packingSize: m.packingSize,
          casePacking: m.packing,
          conversion: m.conversion,
          cases: m.cases
        }
      }
    );
    console.log(`  -> Updated ${sbRes.modifiedCount} StockBoxes for line ${i + 1}`);
  }

  // ==========================================
  // 3. SYNC ALL PENDING SALES INVOICES
  // ==========================================
  console.log('\n--- Updating Pending Sales Invoices to Synced ---');
  const SalesInvoice = require('../models/SalesInvoice');
  const siRes = await SalesInvoice.updateMany(
    { tallySyncStatus: { $ne: 'synced' } },
    { $set: { tallySyncStatus: 'synced', tallySyncedAt: new Date() } }
  );
  console.log(`Updated ${siRes.modifiedCount} sales invoices to tallySyncStatus: 'synced'`);

  console.log('\nFix successfully completed!');
  await mongoose.disconnect();
}

fixInvoices().catch(err => {
  console.error('Error fixing invoices:', err);
  process.exit(1);
});
