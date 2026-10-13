const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');

async function seedPurchaseInvoice407() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  const invoiceNumber = 'SNG/MH26-27/407';
  const manufacturer = 'SHRINATURE GREEN AGROTECH PRIVATE LIMITED';
  const invoiceDate = new Date('2026-10-05T00:00:00.000Z');
  const ackNo = '122634984245961';
  const irn = 'd9eb5e089a1ba86c2a196c4852a9696bb259dfb024a450297df3ec12190c11b0';

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
  let currentQrNum = (top?.num || 51078) + 1;
  console.log(`Starting QR Generation from VNK-${currentQrNum}`);

  const lineItems = [
    {
      productName: 'AMBITION 1LTR',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '1 LTR X 10',
      packingSize: '1 LTR',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'SNG-AMB002',
      mfgDate: new Date('2026-10-04T00:00:00.000Z'),
      expDate: new Date('2028-10-03T00:00:00.000Z'),
      cases: 20, // 20 Peti
      conversion: 10,
      quantity: 200, // 200 LTR
      rate: 498.00,
      purchaseCost: 4980.00,
      totalCost: 99600.00
    },
    {
      productName: 'AMBITION 1LTR',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '1 LTR X 10',
      packingSize: '1 LTR',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'SNG-AMB003',
      mfgDate: new Date('2026-10-05T00:00:00.000Z'),
      expDate: new Date('2028-10-04T00:00:00.000Z'),
      cases: 20, // 20 Peti
      conversion: 10,
      quantity: 200, // 200 LTR
      rate: 498.00,
      purchaseCost: 4980.00,
      totalCost: 99600.00
    },
    {
      productName: 'AMBITION 500ML',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '500 ML X 20',
      packingSize: '500 ML',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'SNG-AMB002',
      mfgDate: new Date('2026-10-04T00:00:00.000Z'),
      expDate: new Date('2028-10-03T00:00:00.000Z'),
      cases: 20, // 20 Peti
      conversion: 20,
      quantity: 200, // 200 LTR
      rate: 528.00,
      purchaseCost: 5280.00,
      totalCost: 105600.00
    },
    {
      productName: 'AMBITION 500ML',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '500 ML X 20',
      packingSize: '500 ML',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'SNG-AMB003',
      mfgDate: new Date('2026-10-05T00:00:00.000Z'),
      expDate: new Date('2028-10-04T00:00:00.000Z'),
      cases: 10, // 10 Peti
      conversion: 20,
      quantity: 100, // 100 LTR
      rate: 528.00,
      purchaseCost: 5280.00,
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
      weight: '10.000 LTR',
      batchNumber: 'SNG-AMB002',
      mfgDate: new Date('2026-10-04T00:00:00.000Z'),
      expDate: new Date('2028-10-03T00:00:00.000Z'),
      cases: 10, // 10 Peti
      conversion: 40,
      quantity: 100, // 100 LTR
      rate: 558.00,
      purchaseCost: 5580.00,
      totalCost: 55800.00
    },
    {
      productName: 'AMBITION  250ML',
      billProductName: 'AMBITION',
      technicalName: 'ABAMECTIN 1.9%SC',
      hsnCode: '38089199',
      packing: '250 ML X 40',
      packingSize: '250 ML',
      unit: 'ltr',
      weight: '10.000 LTR',
      batchNumber: 'SNG-AMB003',
      mfgDate: new Date('2026-10-05T00:00:00.000Z'),
      expDate: new Date('2028-10-04T00:00:00.000Z'),
      cases: 5, // 5 Peti
      conversion: 40,
      quantity: 50, // 50 LTR
      rate: 558.00,
      purchaseCost: 5580.00,
      totalCost: 27900.00
    },
    {
      productName: 'MATIX 133.2GM/10013002',
      billProductName: 'MATIX',
      technicalName: 'DINOTEFURAN 15% + PYMERTOZINE 45% WG',
      hsnCode: '38089199',
      packing: '133.2 GM X 50',
      packingSize: '133.2 GM',
      unit: 'kg',
      weight: '6.660 KGS',
      batchNumber: 'VNK-MTX-005',
      mfgDate: new Date('2026-10-04T00:00:00.000Z'),
      expDate: new Date('2028-10-03T00:00:00.000Z'),
      cases: 10, // 10 Peti
      conversion: 50,
      quantity: 66.6, // 66.6 KGS
      rate: 1550.00,
      purchaseCost: 10323.00,
      totalCost: 103230.00
    },
    {
      productName: 'MATIX 266.4GM/10026003',
      billProductName: 'MATIX',
      technicalName: 'DINOTEFURAN 15% + PYMERTOZINE 45% WG',
      hsnCode: '38089199',
      packing: '266.4 GM X 20',
      packingSize: '266.4 GM',
      unit: 'kg',
      weight: '5.328 KGS',
      batchNumber: 'VNK-MTX-004',
      mfgDate: new Date('2026-10-04T00:00:00.000Z'),
      expDate: new Date('2028-10-03T00:00:00.000Z'),
      cases: 10, // 10 Peti
      conversion: 20,
      quantity: 53.281, // 53.281 KGS
      rate: 1500.00,
      purchaseCost: 7992.15,
      totalCost: 79921.50
    },
    {
      productName: 'MATIX 666GM/10066114',
      billProductName: 'MATIX',
      technicalName: 'DINOTEFURAN 15% + PYMERTOZINE 45% WG',
      hsnCode: '38089199',
      packing: '666 GM X 10',
      packingSize: '666 GM',
      unit: 'kg',
      weight: '6.660 KGS',
      batchNumber: 'VNK-MTX-005',
      mfgDate: new Date('2026-10-04T00:00:00.000Z'),
      expDate: new Date('2028-10-03T00:00:00.000Z'),
      cases: 10, // 10 Peti
      conversion: 10,
      quantity: 66.6, // 66.6 KGS
      rate: 1450.00,
      purchaseCost: 9657.00,
      totalCost: 96570.00
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

seedPurchaseInvoice407().catch(err => {
  console.error('Error seeding purchase invoice 407:', err);
  process.exit(1);
});
