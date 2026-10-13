const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');

async function seedPurchaseInvoice397() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  const invoiceNumber = 'SNG/MH26-27/397';
  const manufacturer = 'SHRINATURE GREEN AGROTECH PRIVATE LIMITED';
  const invoiceDate = new Date('2026-10-01T00:00:00.000Z');
  const ackNo = '122634921402118';
  const irn = '18fbf1db045b5a8832bda59f6e11de403ed82c9eeb901c9436e844788e5d6eda';

  // 1. Clean existing records for this invoice if any
  const existingPurchases = await Purchase.find({ invoiceNumber });
  if (existingPurchases.length > 0) {
    console.log(`Found ${existingPurchases.length} existing purchases for #${invoiceNumber}. Cleaning...`);
    await Purchase.deleteMany({ invoiceNumber });
    await StockBox.deleteMany({ purchaseInvoice: invoiceNumber });
  }

  // 2. Find next numeric QR ID
  const [top] = await StockBox.aggregate([
    { $match: { qrId: /^VNK-\d+$/ } },
    { $project: { num: { $toInt: { $substrBytes: ['$qrId', 4, 20] } } } },
    { $sort: { num: -1 } },
    { $limit: 1 }
  ]);
  let currentQrNum = (top?.num || 51018) + 1;
  console.log(`Starting QR Generation from VNK-${currentQrNum}`);

  const lineItems = [
    {
      productName: 'SCORPIO-Z 1LTR/10100001',
      billProductName: 'SCORPIO-Z',
      technicalName: 'FENPYROXIMATE 5% EC',
      hsnCode: '38089990',
      packing: '1 LTR X 10',
      packingSize: '1 LTR',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'VNK-SCZ-002',
      mfgDate: new Date('2026-10-01T00:00:00.000Z'),
      expDate: new Date('2028-09-30T00:00:00.000Z'),
      cases: 31, // 31 Peti
      conversion: 10,
      quantity: 310, // 310 LTR
      rate: 550.00,
      purchaseCost: 5500.00,
      totalCost: 170500.00
    },
    {
      productName: 'SCORPIO-Z 500ML/10050018',
      billProductName: 'SCORPIO-Z',
      technicalName: 'FENPYROXIMATE 5% EC',
      hsnCode: '38089990',
      packing: '500 ML X 20',
      packingSize: '500 ML',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'VNK-SCZ-002',
      mfgDate: new Date('2026-10-01T00:00:00.000Z'),
      expDate: new Date('2028-09-30T00:00:00.000Z'),
      cases: 20, // 20 Peti
      conversion: 20,
      quantity: 200, // 200 LTR
      rate: 580.00,
      purchaseCost: 5800.00,
      totalCost: 116000.00
    },
    {
      productName: 'SCORPIO-Z 250ML/10025017',
      billProductName: 'SCORPIO-Z',
      technicalName: 'FENPYROXIMATE 5% EC',
      hsnCode: '38089990',
      packing: '250 ML X 40',
      packingSize: '250 ML',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'VNK-SCZ-002',
      mfgDate: new Date('2026-10-01T00:00:00.000Z'),
      expDate: new Date('2028-09-30T00:00:00.000Z'),
      cases: 9, // 9 Peti
      conversion: 40,
      quantity: 90, // 90 LTR
      rate: 610.00,
      purchaseCost: 6100.00,
      totalCost: 54900.00
    }
  ];

  let totalBoxesCreated = 0;
  const createdPurchases = [];

  for (const item of lineItems) {
    console.log(`\nProcessing Item: ${item.billProductName} (${item.packing}) - ${item.cases} Peti...`);

    const purchase = await Purchase.create({
      invoiceNumber,
      purchaseDate: invoiceDate,
      manufacturer,
      invoiceDate,
      productName: item.billProductName,
      technicalName: item.technicalName,
      hsnCode: item.hsnCode,
      category: 'Crop Protection',
      batchNumber: item.batchNumber,
      packing: item.packing,
      packingSize: item.packingSize,
      unit: item.unit,
      quantity: item.quantity,
      cases: item.cases,
      conversion: item.conversion,
      casePacking: item.packing,
      weight: item.weight,
      purchaseCost: item.purchaseCost,
      totalCost: item.totalCost,
      costRate: item.rate,
      mfgDate: item.mfgDate,
      expDate: item.expDate,
      warehouseLocation: 'RAIPUR GODOWN',
      remarks: `Tally Inward: RAIPUR GODOWN | Ack: ${ackNo}`,
      status: 'barcode_generated',
      isLocked: true,
      tallySyncStatus: 'synced',
      tallyVoucherNumber: invoiceNumber,
      tallySyncedAt: new Date(),
      enteredByUsername: 'tally-sync-service'
    });

    createdPurchases.push(purchase);

    // Generate StockBoxes (1 QR per Peti / Case)
    const boxesToInsert = [];
    for (let c = 0; c < item.cases; c++) {
      const qrId = `VNK-${currentQrNum}`;
      currentQrNum++;

      boxesToInsert.push({
        qrId,
        barcode: qrId,
        purchaseId: purchase._id,
        purchaseInvoice: invoiceNumber,
        productName: item.productName,
        technicalName: item.technicalName,
        manufacturer,
        batchNumber: item.batchNumber,
        packing: item.packingSize,
        packingSize: item.packingSize,
        unit: item.unit,
        weight: item.weight,
        hsnCode: item.hsnCode,
        category: 'Crop Protection',
        cases: 1,
        conversion: item.conversion,
        purchaseCost: item.purchaseCost,
        totalCost: item.purchaseCost,
        costUnit: 'box',
        costRate: item.rate,
        mrp: item.rate * 1.35,
        mfgDate: item.mfgDate,
        expDate: item.expDate,
        warehouseLocation: 'RAIPUR GODOWN',
        status: 'available',
        stickerStatus: 'printed',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [
          {
            stage: 'Purchase Received',
            title: `Inward from ${manufacturer}`,
            description: `Imported via Tally Inward Invoice #${invoiceNumber} (Ack: ${ackNo})`,
            performedBy: 'Tally Stock Sync',
            timestamp: new Date()
          }
        ]
      });
    }

    await StockBox.insertMany(boxesToInsert);
    totalBoxesCreated += boxesToInsert.length;
    console.log(`  -> Created ${boxesToInsert.length} StockBoxes (${boxesToInsert[0].qrId} to ${boxesToInsert[boxesToInsert.length - 1].qrId})`);
  }

  console.log('\n=============================================');
  console.log(`SUCCESSFULLY SEEDED INVOICE #${invoiceNumber}!`);
  console.log(`Total Purchases: ${createdPurchases.length}`);
  console.log(`Total Peti / StockBoxes Created: ${totalBoxesCreated} Boxes`);
  console.log(`Ending QR Number: VNK-${currentQrNum - 1}`);
  console.log(`Tally Sync Status: SYNCED`);
  console.log('=============================================');

  await mongoose.disconnect();
}

seedPurchaseInvoice397().catch(err => {
  console.error('Error seeding purchase invoice 397:', err);
  process.exit(1);
});
