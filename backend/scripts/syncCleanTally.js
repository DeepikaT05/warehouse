/**
 * syncCleanTally.js
 * Wipes out legacy/wrong stock and cleanly imports 100% of products,
 * technical names, packing, conversions, batches, godowns, and stock
 * from Tally GOLD Prime: "VANIKI CROP SCIENCE PVT. LTD."
 * strictly from groups: "38089910" and "5%".
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TALLY_URL = process.env.TALLY_URL || 'http://192.168.1.250:9000';
const TALLY_COMPANY = 'VANIKI CROP SCIENCE PVT. LTD.';

async function runCleanSync() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB at', mongoUri);

  // 1. Fetch Master Stock Items from Tally
  console.log(`Fetching Stock Items from Tally company "${TALLY_COMPANY}"...`);
  const itemsXmlReq = `<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
      <EXPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>List of Accounts</REPORTNAME>
          <STATICVARIABLES>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            <SVCURRENTCOMPANY>${TALLY_COMPANY}</SVCURRENTCOMPANY>
            <ACCOUNTTYPE>Stock Items</ACCOUNTTYPE>
          </STATICVARIABLES>
        </REQUESTDESC>
      </EXPORTDATA>
    </BODY>
  </ENVELOPE>`;

  const itemsRes = await fetch(TALLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=utf-8', 'Content-Length': String(Buffer.byteLength(itemsXmlReq)) },
    body: itemsXmlReq
  });
  const itemsXml = await itemsRes.text();
  const itemChunks = itemsXml.split('<STOCKITEM ').slice(1);

  const masterProducts = new Map();
  for (const c of itemChunks) {
    const parent = c.match(/<PARENT>([^<]+)<\/PARENT>/)?.[1];
    // Only accept items strictly under 38089910 and 5%
    if (parent !== '38089910' && parent !== '5%') continue;

    const name = c.match(/NAME="([^"]+)"/)?.[1];
    if (!name) continue;

    const u653 = c.match(/<UDF:_UDF_671089653[^>]*>([^<]+)<\/UDF:_UDF_671089653>/)?.[1]?.trim();
    const u159 = c.match(/<UDF:_UDF_788530159[^>]*>([^<]+)<\/UDF:_UDF_788530159>/)?.[1]?.trim();
    const u160 = c.match(/<UDF:_UDF_788530160[^>]*>([^<]+)<\/UDF:_UDF_788530160>/)?.[1]?.trim();
    const baseUnit = c.match(/<BASEUNITS>([^<]+)<\/BASEUNITS>/)?.[1] || 'kg';

    // Parse Packing Size and Conversion factor (pieces per Peti) from U160
    let packing = '1 kg';
    let conv = 10;
    if (u160) {
      const m = u160.trim().match(/([\d.]+)\s*([a-zA-Z]*)\s*[xX*]\s*([\d.]+)/i);
      if (m) {
        const u = m[2] ? m[2].toUpperCase() : (name.match(/(LTR|LT|ML|GM|KG|BAG)/i)?.[1]?.toUpperCase() || 'UNIT');
        packing = `${m[1]} ${u}`;
        conv = parseInt(m[3], 10);
      }
    } else {
      const m = name.match(/(\d+(?:\.\d+)?)\s*(LTR|LT|ML|GM|KG|BAG)/i);
      if (m) packing = `${m[1]} ${m[2].toUpperCase()}`;
    }

    if (!conv || isNaN(conv) || conv <= 0) conv = 10;

    // Calculate unitKgLtr
    let unitKgLtr = 1;
    const pMatch = packing.match(/([\d.]+)\s*(LTR|LT|ML|GM|KG|BAG)/i);
    if (pMatch) {
      const val = parseFloat(pMatch[1]);
      const u = pMatch[2].toUpperCase();
      if (u === 'ML' || u === 'GM') unitKgLtr = val / 1000;
      else unitKgLtr = val;
    }

    let caseWeight = u653 ? parseFloat(u653) : (unitKgLtr * conv);
    if (isNaN(caseWeight) || caseWeight <= 0) caseWeight = unitKgLtr * conv;


    masterProducts.set(name.trim().toUpperCase(), {
      name: name.trim(),
      category: parent === '38089910' ? 'Crop Protection' : 'Plant Nutrition & Growth',
      hsnCode: parent === '38089910' ? '38089910' : '31059090',
      technicalName: u159 || '',
      packingSize: packing,
      conversion: conv,
      pcsPerCase: conv,
      caseWeight,
      unitKgLtr,
      unit: baseUnit.toLowerCase().includes('ltr') ? 'Ltr' : (baseUnit.toLowerCase().includes('pcs') ? 'pcs' : 'kg'),
      rawU160: u160 || '',
      rawU653: u653 || ''
    });
  }

  console.log(`Parsed ${masterProducts.size} eligible Master Products from Tally (Groups: 38089910 and 5%).`);

  // 2. Fetch Live Stock Summary (Batches & Godowns)
  console.log(`Fetching Stock Summary from Tally company "${TALLY_COMPANY}"...`);
  const summaryXmlReq = `<ENVELOPE>
    <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
    <BODY>
      <EXPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>Stock Summary</REPORTNAME>
          <STATICVARIABLES>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            <SVCURRENTCOMPANY>${TALLY_COMPANY}</SVCURRENTCOMPANY>
            <SVFROMDATE>20260401</SVFROMDATE>
            <SVTODATE>20260929</SVTODATE>
            <EXPLODEFLAG>Yes</EXPLODEFLAG>
            <ISITEMWISE>Yes</ISITEMWISE>
          </STATICVARIABLES>
        </REQUESTDESC>
      </EXPORTDATA>
    </BODY>
  </ENVELOPE>`;

  const sumRes = await fetch(TALLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=utf-8', 'Content-Length': String(Buffer.byteLength(summaryXmlReq)) },
    body: summaryXmlReq
  });
  const sumXml = await sumRes.text();
  const chunks = sumXml.split('<DSPACCNAME>').slice(1);

  const eligibleLots = [];
  for (const c of chunks) {
    const nameMatch = c.match(/<DSPDISPNAME>([^<]+)<\/DSPDISPNAME>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    const meta = masterProducts.get(name.toUpperCase());
    if (!meta) continue;

    const rateMatch = c.match(/<DSPCLRATE>([^<]+)<\/DSPCLRATE>/);
    const rate = rateMatch ? parseFloat(rateMatch[1].trim()) || 0 : 0;
    const batchMatches = [...c.matchAll(/<SSBATCH>([^<]+)<\/SSBATCH>[\s\S]*?<SSGODOWN>([^<]+)<\/SSGODOWN>[\s\S]*?<DSPCLQTY>([^<]+)<\/DSPCLQTY>/g)];

    for (const b of batchMatches) {
      const batch = b[1].trim();
      const godown = b[2].trim();
      const rawQtyStr = b[3].trim();
      const mQty = rawQtyStr.match(/([-+]?[0-9]*\.?[0-9]+)/);
      const tallyNum = mQty ? parseFloat(mQty[1]) : 0;

      if (tallyNum > 0) {
        const cases = Math.max(1, Math.round(tallyNum / meta.caseWeight));
        const totalPcs = cases * meta.pcsPerCase;
        const totalCostVal = Math.round(tallyNum * rate * 100) / 100;
        const unitCostVal = Math.round((totalCostVal / totalPcs) * 100) / 100;

        eligibleLots.push({
          productName: meta.name,
          category: meta.category,
          hsnCode: meta.hsnCode,
          technicalName: meta.technicalName,
          packing: meta.packingSize,
          packingSize: meta.packingSize,
          unit: meta.unit,
          conversion: meta.pcsPerCase,
          weight: rawQtyStr,
          batchNumber: batch,
          godown: godown === 'Main Location' ? 'RAIPUR GODOWN' : `${godown.toUpperCase()} GODOWN`,
          quantity: totalPcs,
          cases: cases,
          purchaseCost: unitCostVal,
          costRate: rate,
          totalCost: totalCostVal,
          mrp: rate > 0 ? Math.round(rate * 1.35) : 500
        });
      }
    }
  }

  console.log(`Parsed ${eligibleLots.length} Stock Lots with active positive balance.`);
  const totalPieces = eligibleLots.reduce((acc, l) => acc + l.quantity, 0);
  const totalPetis = eligibleLots.reduce((acc, l) => acc + l.cases, 0);
  console.log(`Total Inventory Pieces: ${totalPieces}, Total Cases: ${totalPetis}`);

  // 3. WIPE OLD STOCK DATA (as explicitly instructed by user)
  console.log('--- PURGING OLD STOCK DATA ---');
  const delBoxes = await mongoose.connection.db.collection('stockboxes').deleteMany({});
  const delPurchases = await mongoose.connection.db.collection('purchases').deleteMany({});
  const delProducts = await mongoose.connection.db.collection('products').deleteMany({});
  console.log(`Deleted: ${delBoxes.deletedCount} StockBoxes, ${delPurchases.deletedCount} Purchases, ${delProducts.deletedCount} Products.`);

  // 4. INSERT FRESH MASTER PRODUCTS
  console.log('--- SEEDING CLEAN MASTER PRODUCTS ---');
  const productDocs = [];
  let prodIdx = 100001;
  for (const [_, p] of masterProducts.entries()) {
    productDocs.push({
      productCode: `PRD-${prodIdx++}`,
      name: p.name,
      category: p.category,
      hsnCode: p.hsnCode,
      unit: p.unit,
      packingSize: p.packingSize,
      conversion: p.conversion,
      alternateUnit: 'BOX',
      mrp: 500,
      minStockThreshold: 20,
      description: p.technicalName || `Tally Import (${p.rawU160})`,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  await mongoose.connection.db.collection('products').insertMany(productDocs);
  console.log(`Inserted ${productDocs.length} clean products into "products" collection.`);

  // Map product docs for ObjectId referencing
  const insertedProds = await mongoose.connection.db.collection('products').find({}).toArray();
  const prodIdMap = new Map();
  for (const ip of insertedProds) {
    prodIdMap.set(ip.name.toUpperCase().trim(), ip);
  }

  // 5. INSERT PURCHASES & STOCKBOXES
  console.log('--- SEEDING CLEAN PURCHASES & STOCKBOXES ---');
  let currentQrSeq = 1;
  let invIdx = 1;
  const CHUNK_SIZE = 5000;
  let allBoxDocs = [];

  for (const lot of eligibleLots) {
    const invoiceNumber = `VNK-TLY-${String(invIdx++).padStart(3, '0')}`;
    const pRecord = prodIdMap.get(lot.productName.toUpperCase().trim());

    const purchaseDoc = {
      invoiceNumber,
      purchaseDate: new Date('2026-06-01T00:00:00.000Z'),
      invoiceDate: new Date('2026-06-01T00:00:00.000Z'),
      manufacturer: 'VANIKI CROP SCIENCE PVT. LTD.',
      productName: lot.productName,
      technicalName: lot.technicalName,
      hsnCode: lot.hsnCode,
      category: lot.category,
      batchNumber: lot.batchNumber,
      packing: lot.packing,
      packingSize: lot.packingSize,
      unit: lot.unit,
      weight: lot.weight,
      quantity: lot.quantity,
      cases: lot.cases,
      conversion: lot.conversion,
      purchaseCost: lot.purchaseCost,
      costRate: lot.costRate,
      totalCost: lot.totalCost,
      mrp: lot.mrp,
      mfgDate: new Date('2026-06-01T00:00:00.000Z'),
      expDate: new Date('2028-06-01T00:00:00.000Z'),
      warehouseLocation: lot.godown,
      remarks: `Tally Live Sync: ${lot.godown} | Batch: ${lot.batchNumber} | Balance: ${lot.weight}`,
      status: 'barcode_generated',
      isLocked: true,
      tallySyncStatus: 'synced',
      tallyVoucherNumber: `TLY-${String(invIdx - 1).padStart(3, '0')}`,
      tallySyncedAt: new Date(),
      enteredByUsername: 'tally-live-sync',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertedPurchase = await mongoose.connection.db.collection('purchases').insertOne(purchaseDoc);
    const purchaseId = insertedPurchase.insertedId;

    // Generate individual StockBoxes with QR IDs
    for (let b = 0; b < lot.quantity; b++) {
      const qrId = `VNK-${currentQrSeq++}`;
      allBoxDocs.push({
        qrId,
        barcode: qrId,
        purchaseId,
        purchaseInvoice: invoiceNumber,
        productName: lot.productName,
        technicalName: lot.technicalName,
        manufacturer: 'VANIKI CROP SCIENCE PVT. LTD.',
        batchNumber: lot.batchNumber,
        packing: lot.packing,
        packingSize: lot.packingSize,
        unit: lot.unit,
        weight: lot.weight,
        hsnCode: lot.hsnCode,
        category: lot.category,
        cases: lot.cases,
        conversion: lot.conversion,
        purchaseCost: lot.purchaseCost,
        totalCost: lot.purchaseCost,
        costUnit: 'box',
        costRate: lot.costRate,
        mrp: lot.mrp,
        mfgDate: new Date('2026-06-01T00:00:00.000Z'),
        expDate: new Date('2028-06-01T00:00:00.000Z'),
        warehouseLocation: lot.godown,
        status: 'available',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [
          {
            stage: 'Purchase Received',
            title: 'Tally Inward Logged',
            description: `Imported from Tally Batch ${lot.batchNumber} (${lot.godown}) - ${lot.weight}`,
            performedBy: 'Tally Sync Service',
            timestamp: new Date()
          }
        ]
      });

      if (allBoxDocs.length >= CHUNK_SIZE) {
        await mongoose.connection.db.collection('stockboxes').insertMany(allBoxDocs);
        console.log(`Inserted chunk of ${allBoxDocs.length} boxes (total so far: ${currentQrSeq - 1})`);
        allBoxDocs = [];
      }
    }
  }

  if (allBoxDocs.length > 0) {
    await mongoose.connection.db.collection('stockboxes').insertMany(allBoxDocs);
    console.log(`Inserted final chunk of ${allBoxDocs.length} boxes.`);
    allBoxDocs = [];
  }

  console.log(`Successfully generated ${currentQrSeq - 1} StockBoxes across ${eligibleLots.length} Invoices!`);
  console.log('--- LIVE TALLY IMPORT COMPLETE ---');
  process.exit(0);
}

runCleanSync().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
