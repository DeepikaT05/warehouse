const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vaniki_stock_trace';

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');

async function generateMissingBoxes() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  // Find highest existing QR number
  const lastBox = await StockBox.findOne({}, { qrId: 1 }).sort({ _id: -1 });
  let nextQrNum = 1;
  if (lastBox && lastBox.qrId) {
    const match = lastBox.qrId.match(/VNK-(\d+)/i);
    if (match) {
      nextQrNum = parseInt(match[1], 10) + 1;
    }
  }
  console.log(`Starting next QR sequence at: VNK-${nextQrNum}`);

  const purchases = await Purchase.find({ isDeleted: false }).sort({ _id: 1 });
  console.log(`Found total ${purchases.length} purchase records in database.`);

  let totalBoxesCreated = 0;

  for (const p of purchases) {
    const boxCount = await StockBox.countDocuments({ purchaseInvoice: p.invoiceNumber, isDeleted: false });
    if (boxCount > 0) {
      console.log(`[SKIP] Invoice ${p.invoiceNumber} already has ${boxCount} boxes.`);
      continue;
    }

    console.log(`[GENERATE] Processing ${p.invoiceNumber} (${p.productName}) - Qty: ${p.quantity}, Cases: ${p.cases}`);

    let countToGenerate = 1;
    const qty = Math.round(Number(p.quantity) || 1);
    const cases = Math.round(Number(p.cases) || 0);

    if (qty <= 100) {
      countToGenerate = qty;
    } else if (cases > 0 && cases <= 200) {
      countToGenerate = cases;
    } else {
      countToGenerate = Math.min(cases || Math.ceil(qty / 20), 100);
    }

    const boxDocs = [];
    const pDate = p.purchaseDate || p.invoiceDate || new Date();
    const mfg = p.mfgDate || pDate;
    const exp = p.expDate || new Date(new Date(mfg).getTime() + 365 * 24 * 60 * 60 * 1000 * 2);
    const cost = p.purchaseCost || p.costRate || 0;

    for (let i = 0; i < countToGenerate; i++) {
      const qrId = `VNK-${nextQrNum++}`;
      boxDocs.push({
        qrId,
        barcode: qrId,
        purchaseId: p._id,
        purchaseInvoice: p.invoiceNumber,
        productName: p.productName || 'PRODUCT',
        technicalName: p.technicalName || '',
        manufacturer: p.manufacturer || 'VANIKI CROP SCIENCE PVT. LTD.',
        batchNumber: p.batchNumber || `VNK-B${p.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
        packing: p.packing || '1 kg',
        packingSize: p.packingSize || p.packing || '1 kg',
        unit: p.unit || 'kg',
        cases: p.cases || 1,
        casePacking: p.casePacking || '',
        weight: p.weight || p.packing || '1 kg',
        purchaseCost: cost,
        totalCost: cost,
        costRate: cost,
        mrp: p.mrp || (cost ? Math.round(cost * 1.4) : 500),
        mfgDate: mfg,
        expDate: exp,
        warehouseLocation: p.warehouseLocation || 'RAIPUR GODOWN',
        status: 'available',
        inwardDate: pDate,
        stickerStatus: 'not_printed',
        printCount: 0,
        verificationStatus: 'pending_verification',
        history: [
          {
            stage: 'Purchase Received',
            title: 'Purchase Bill Logged',
            description: `Received via Purchase Invoice #${p.invoiceNumber} from ${p.manufacturer}`,
            performedBy: 'Tally Auto Sync',
            timestamp: pDate
          },
          {
            stage: 'QR Generated',
            title: 'Unique Identity Assigned',
            description: `QR ID ${qrId} generated for box`,
            performedBy: 'Tally Auto Sync',
            timestamp: new Date()
          },
          {
            stage: 'Stock Available',
            title: 'Stored in Warehouse',
            description: `Stored at ${p.warehouseLocation || 'RAIPUR GODOWN'}`,
            performedBy: 'Tally Auto Sync',
            timestamp: new Date()
          }
        ]
      });
    }

    if (boxDocs.length > 0) {
      await StockBox.insertMany(boxDocs, { ordered: false });
      p.status = 'barcode_generated';
      await p.save();
      totalBoxesCreated += boxDocs.length;
      console.log(`  -> Successfully created ${boxDocs.length} boxes for ${p.invoiceNumber} (IDs: ${boxDocs[0].qrId} to ${boxDocs[boxDocs.length - 1].qrId})`);
    }
  }

  console.log(`====================================================`);
  console.log(`[DONE] Finished generating missing boxes! Total created: ${totalBoxesCreated}`);
  console.log(`Total stockboxes now in DB: ${await StockBox.countDocuments({ isDeleted: false })}`);
  console.log(`====================================================`);

  await mongoose.disconnect();
}

generateMissingBoxes().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
