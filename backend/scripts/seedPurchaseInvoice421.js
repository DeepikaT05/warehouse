const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');

async function seedPurchaseInvoice421() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  const invoiceNumber = 'SNG/MH26-27/421';
  const manufacturer = 'SHRINATURE GREEN AGROTECH PRIVATE LIMITED';
  const invoiceDate = new Date('2026-10-10T00:00:00.000Z');
  const ewayBillNo = '222306154733';
  const ackNo = '122635092965899';
  const irn = '0fe19d7668f7f324cc87a165cb3256241eaabcbd32e76165d95d9222d0ac2b06';

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
  let currentQrNum = (top?.num || 50982) + 1;
  console.log(`Starting QR Generation from VNK-${currentQrNum}`);

  const lineItems = [
    {
      productName: 'FIGHTER - 50 (250 gm)',
      billProductName: 'FIGHTER',
      technicalName: 'DIAFENTHIURON 50% WP',
      hsnCode: '38089910',
      packing: '250 GM X 20',
      packingSize: '250 GM',
      unit: 'kg',
      weight: '5.000 KGS', // 20 x 250gm = 5 kg per box
      batchNumber: 'VNK-F50-002',
      mfgDate: new Date('2026-10-09T00:00:00.000Z'),
      expDate: new Date('2028-10-08T00:00:00.000Z'),
      cases: 20, // 20 Peti
      conversion: 20,
      quantity: 100, // 100 KGS
      rate: 860.00, // per kg
      purchaseCost: 4300.00, // 5 kg x 860 = 4300 per box
      totalCost: 86000.00
    },
    {
      productName: 'AMBITION 500ML',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '500 ML X 20',
      packingSize: '500 ML',
      unit: 'ltr',
      weight: '10.000 LTR', // 20 x 500ml = 10 Ltr per box
      batchNumber: 'SNG-AMB003',
      mfgDate: new Date('2026-10-05T00:00:00.000Z'),
      expDate: new Date('2028-10-04T00:00:00.000Z'),
      cases: 10, // 10 Peti
      conversion: 20,
      quantity: 100, // 100 LTR
      rate: 528.00, // per ltr
      purchaseCost: 5280.00, // 10 Ltr x 528 = 5280 per box
      totalCost: 52800.00
    },
    {
      productName: 'AMBITION  250ML',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '250 ML X 40',
      packingSize: '250 ML',
      unit: 'ltr',
      weight: '10.000 LTR', // 40 x 250ml = 10 Ltr per box
      batchNumber: 'SNG-AMB003',
      mfgDate: new Date('2026-10-05T00:00:00.000Z'),
      expDate: new Date('2028-10-04T00:00:00.000Z'),
      cases: 5, // 5 Peti
      conversion: 40,
      quantity: 50, // 50 LTR
      rate: 558.00, // per ltr
      purchaseCost: 5580.00, // 10 Ltr x 558 = 5580 per box
      totalCost: 27900.00
    },
    {
      productName: 'SCORPIO-Z 250ML/10025017',
      billProductName: 'SCORPIO-Z',
      technicalName: 'FENPYROXIMATE 5% EC',
      hsnCode: '38089990',
      packing: '250 ML X 40',
      packingSize: '250 ML',
      unit: 'ltr',
      weight: '10.000 LTR', // 40 x 250ml = 10 Ltr per box
      batchNumber: 'VNK-SCZ-002',
      mfgDate: new Date('2026-10-01T00:00:00.000Z'),
      expDate: new Date('2028-09-30T00:00:00.000Z'),
      cases: 1, // 1 Peti
      conversion: 40,
      quantity: 10, // 10 LTR
      rate: 610.00, // per ltr
      purchaseCost: 6100.00, // 10 Ltr x 610 = 6100 per box
      totalCost: 6100.00
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
      remarks: `Tally Inward: RAIPUR GODOWN | E-Way: ${ewayBillNo} | Ack: ${ackNo}`,
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
            description: `Imported via Tally Inward Invoice #${invoiceNumber} (E-Way: ${ewayBillNo})`,
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

seedPurchaseInvoice421().catch(err => {
  console.error('Error seeding purchase invoice 421:', err);
  process.exit(1);
});
