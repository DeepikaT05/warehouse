const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');

const TALLY_HOST = process.env.TALLY_HOST || '192.168.1.250';
const TALLY_PORT = process.env.TALLY_PORT || 9000;
const TALLY_COMPANY = process.env.TALLY_COMPANY || 'VANIKI CROP SCIENCE PVT. LTD.';
const TALLY_URL = `http://${TALLY_HOST}:${TALLY_PORT}`;

function escapeXml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTallyDate(date) {
  const d = new Date(date || Date.now());
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// Generate next sequential QR ID (numeric max aggregation to prevent duplicate key collisions)
async function generateNextQrId() {
  const [top] = await StockBox.aggregate([
    { $match: { qrId: /^VNK-\d+$/ } },
    { $project: { num: { $toInt: { $substrBytes: ['$qrId', 4, 20] } } } },
    { $sort: { num: -1 } },
    { $limit: 1 }
  ]);
  let nextNum = (top?.num || 0) + 1;
  while (await StockBox.exists({ qrId: `VNK-${nextNum}` })) {
    nextNum++;
  }
  return nextNum;
}

/**
 * Check Tally connection and detect active company
 */
async function getTallyStatus() {
  const pingXml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>All Masters</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(TALLY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': String(Buffer.byteLength(pingXml))
      },
      body: pingXml,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await res.text();
    const companyMatch = text.match(/<SVCURRENTCOMPANY>([^<]+)<\/SVCURRENTCOMPANY>/i);
    const activeCompany = companyMatch ? companyMatch[1].trim() : '';

    return {
      online: true,
      url: TALLY_URL,
      host: TALLY_HOST,
      port: TALLY_PORT,
      configuredCompany: TALLY_COMPANY,
      activeCompany: activeCompany || TALLY_COMPANY,
      companyMatched: activeCompany ? activeCompany.toLowerCase().includes('vaniki') : true
    };
  } catch (err) {
    return {
      online: false,
      url: TALLY_URL,
      host: TALLY_HOST,
      port: TALLY_PORT,
      configuredCompany: TALLY_COMPANY,
      error: err.message
    };
  }
}

function getPackingConversion(packing) {
  if (!packing) return 10;
  const p = packing.toString().toUpperCase().trim();
  if (p.includes('160 GM') || p.includes('160GM') || p.includes('CURVE')) return 8;
  if (p.includes('1 LTR') || p.includes('1 LT') || p.includes('1 KG') || p.includes('1KG')) return 10;
  if (p.includes('500 ML') || p.includes('500 GM') || p.includes('500GM') || p.includes('500ML')) return 20;
  if (p.includes('250 ML') || p.includes('250 GM') || p.includes('250GM') || p.includes('250ML')) return 40;
  if (p.includes('100 ML') || p.includes('100 GM') || p.includes('100GM') || p.includes('100ML')) return 50;
  if (p.includes('150 ML') || p.includes('200 ML')) return 20;
  if (p.includes('300 ML') || p.includes('300 GM') || p.includes('400 ML') || p.includes('800 ML')) return 20;
  if (p.includes('4 KG') || p.includes('5 KG') || p.includes('4KG') || p.includes('5KG')) return 4;
  if (p.includes('8 GM') || p.includes('15 ML') || p.includes('30 GM') || p.includes('50 GM') || p.includes('75 GM')) return 100;
  return 10;
}

/**
 * Fetch all Stock Items from Tally with their CONVERSION factor (1 Peti = ? Pieces)
 */
async function fetchTallyStockItems() {
  const exportXml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${escapeXml(TALLY_COMPANY)}</SVCURRENTCOMPANY>
          <ACCOUNTTYPE>Stock Items</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(TALLY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'Content-Length': String(Buffer.byteLength(exportXml))
      },
      body: exportXml,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const xml = await res.text();
    const itemChunks = xml.split('<STOCKITEM ').slice(1);
    const stockItems = [];

    for (const chunk of itemChunks) {
      const getTag = (tag) => {
        const m = chunk.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'));
        return m ? m[1].trim() : '';
      };

      const name = getTag('NAME') || chunk.match(/NAME="([^"]+)"/i)?.[1] || '';
      if (!name) continue;

      const baseUnit = getTag('BASEUNITS');
      const addlUnit = getTag('ADDITIONALUNITS');
      const convRaw = getTag('CONVERSION');
      const denomRaw = getTag('DENOMINATOR');

      let conversion = 0;
      if (convRaw) {
        const convVal = parseFloat(convRaw);
        const denomVal = parseFloat(denomRaw) || 1;
        if (!isNaN(convVal) && convVal > 0) {
          conversion = Math.round(convVal / denomVal);
        }
      }

      stockItems.push({
        name,
        baseUnit,
        alternateUnit: addlUnit || 'BOX',
        conversion
      });
    }

    return stockItems;
  } catch (err) {
    console.warn('[Tally] Could not fetch stock items:', err.message);
    return [];
  }
}

/**
 * Fetch all Purchase Vouchers from Tally
 */
async function fetchTallyPurchases() {
  const exportXml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${escapeXml(TALLY_COMPANY)}</SVCURRENTCOMPANY>
          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(TALLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=utf-8',
      'Content-Length': String(Buffer.byteLength(exportXml))
    },
    body: exportXml,
    signal: controller.signal
  });
  clearTimeout(timeout);

  const xml = await res.text();
  const voucherChunks = xml.split('<VOUCHER ').slice(1);
  const purchases = [];

  for (const v of voucherChunks) {
    const getTag = (tag) => {
      const m = v.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'));
      return m ? m[1].trim() : '';
    };

    const vchType = getTag('VCHTYPE');
    if (vchType && !/purchase/i.test(vchType)) continue;

    const dateRaw = getTag('DATE');
    let purchaseDate = new Date();
    if (dateRaw && dateRaw.length === 8) {
      const y = dateRaw.substring(0, 4);
      const m = dateRaw.substring(4, 6);
      const d = dateRaw.substring(6, 8);
      purchaseDate = new Date(`${y}-${m}-${d}`);
    }

    const vchNumber = getTag('VOUCHERNUMBER');
    let reference = getTag('REFERENCE');
    if (!reference || reference.includes('<')) {
      reference = `PUR-${vchNumber}`;
    }
    reference = reference.trim();

    const partyName = getTag('PARTYNAME') || getTag('PARTYLEDGERNAME') || 'Direct Supplier';
    const guid = getTag('GUID');

    // Extract inventory entries
    const invChunks = v.split('<ALLINVENTORYENTRIES.LIST>').slice(1);
    const items = [];

    for (const chunk of invChunks) {
      const getItemTag = (tag) => {
        const m = chunk.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'));
        return m ? m[1].trim() : '';
      };

      const stockItem = getItemTag('STOCKITEMNAME');
      if (!stockItem) continue;

      const rateStr = getItemTag('RATE');
      const rateMatch = rateStr.match(/([\d.]+)/);
      const costRate = rateMatch ? parseFloat(rateMatch[1]) : 0;

      const qtyStr = getItemTag('ACTUALQTY') || getItemTag('BILLEDQTY');
      let quantity = 1;
      let unit = 'kg';
      let parsedCases = 0;

      if (qtyStr.includes('=')) {
        const parts = qtyStr.split('=');
        for (const pt of parts) {
          const mCase = pt.match(/([\d.]+)\s*(?:BOX|PETI|CASE|BAG|PKT|CTN)/i);
          if (mCase) parsedCases = parseFloat(mCase[1]);
          const mQty = pt.match(/([\d.]+)\s*([a-zA-Z]*)/);
          if (mQty && !/(?:BOX|PETI|CASE|BAG|PKT|CTN)/i.test(mQty[2])) {
            quantity = parseFloat(mQty[1]);
            unit = mQty[2] ? mQty[2].toLowerCase() : 'kg';
          }
        }
      } else {
        const qtyMatch = qtyStr.match(/([\d.]+)\s*([a-zA-Z]*)/);
        quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
        unit = qtyMatch && qtyMatch[2] ? qtyMatch[2].toLowerCase() : 'kg';
      }

      const amountStr = getItemTag('AMOUNT');
      const totalAmount = Math.abs(parseFloat(amountStr) || 0);

      const batchName = getItemTag('BATCHNAME') || `VNK-B${formatTallyDate(purchaseDate)}`;
      const godown = getItemTag('GODOWNNAME') || 'RAIPUR GODOWN';
      const mfdRaw = getItemTag('MFDON');
      let mfgDate = purchaseDate;
      if (mfdRaw && mfdRaw.length === 8) {
        mfgDate = new Date(`${mfdRaw.substring(0, 4)}-${mfdRaw.substring(4, 6)}-${mfdRaw.substring(6, 8)}`);
      }

      const itemPacking = unit === 'ltr' ? '1 Ltr' : '1 kg';
      const directConv = (parsedCases > 0 && quantity > parsedCases) ? Math.round(quantity / parsedCases) : 0;

      items.push({
        productName: stockItem,
        quantity,
        cases: parsedCases || 0,
        conversion: directConv || 0,
        unit,
        packing: itemPacking,
        weight: itemPacking,
        costRate,
        totalAmount,
        batchNumber: batchName,
        warehouseLocation: godown,
        mfgDate
      });
    }

    if (items.length > 0) {
      purchases.push({
        invoiceNumber: reference,
        vchNumber,
        partyName,
        purchaseDate,
        guid,
        items
      });
    }
  }

  return purchases;
}

/**
 * Sync all purchases from Tally into Warehouse MongoDB
 */
async function syncTallyPurchasesToWarehouse({ autoGenerateBoxes = true } = {}) {
  // Fetch stock items from Tally first to get official CONVERSION definitions
  const [tallyPurchases, tallyStockItems] = await Promise.all([
    fetchTallyPurchases(),
    fetchTallyStockItems()
  ]);

  const tallyItemMap = new Map();
  (tallyStockItems || []).forEach(it => {
    if (it.name) tallyItemMap.set(it.name.trim().toUpperCase(), it);
  });

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  let nextQrNum = await generateNextQrId();

  for (const tp of tallyPurchases) {
    try {
      // Check if purchase invoice already exists in DB
      let existing = await Purchase.findOne({ invoiceNumber: tp.invoiceNumber, isDeleted: false });

      if (existing) {
        // Update Tally metadata
        existing.tallySyncStatus = 'synced';
        existing.tallyVoucherNumber = tp.vchNumber;
        existing.tallyGuid = tp.guid;
        existing.tallySyncedAt = new Date();
        await existing.save();
        updated++;
        continue;
      }

      // Auto-register products into Product Master with CONVERSION from Tally
      for (const item of tp.items) {
        const pName = item.productName.trim();
        const safeRegex = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tItem = tallyItemMap.get(pName.toUpperCase());
        const itemConv = (tItem && tItem.conversion > 0) ? tItem.conversion : (item.conversion > 0 ? item.conversion : getPackingConversion(item.packing || item.weight));

        let prod = await Product.findOne({ name: { $regex: `^${safeRegex}$`, $options: 'i' }, isDeleted: false });
        if (!prod) {
          const code = `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
          await Product.create({
            productCode: code,
            name: pName,
            category: 'Crop Protection',
            unit: item.unit.includes('ltr') ? 'Ltr' : 'kg',
            packingSize: item.packing || null,
            conversion: itemConv,
            alternateUnit: tItem?.alternateUnit || 'BOX',
            mrp: item.costRate ? Math.round(item.costRate * 1.4) : 500,
            minStockThreshold: 20,
            description: `Auto-imported from Tally Invoice #${tp.invoiceNumber}`
          });
        } else if ((!prod.conversion || prod.conversion <= 0) && itemConv > 0) {
          prod.conversion = itemConv;
          prod.alternateUnit = tItem?.alternateUnit || prod.alternateUnit || 'BOX';
          await prod.save();
        }
      }

      // Filter out invalid items with 0 or negative quantity (NEVER import negative stock!)
      const validItems = (tp.items || []).filter(it => Number(it.quantity) > 0);
      if (validItems.length === 0) {
        skipped++;
        continue;
      }

      // Create primary Purchase record
      const firstItem = validItems[0];
      const totalQty = validItems.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const totalCost = validItems.reduce((sum, it) => sum + (it.totalAmount || 0), 0);

      // Determine final conversion for this purchase
      const tItem = tallyItemMap.get(firstItem.productName.trim().toUpperCase());
      let finalConversion = 0;
      if (tItem && tItem.conversion > 0) {
        finalConversion = tItem.conversion;
      } else if (firstItem.conversion > 0) {
        finalConversion = firstItem.conversion;
      } else {
        const prod = await Product.findOne({ name: { $regex: `^${firstItem.productName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, isDeleted: false });
        finalConversion = prod?.conversion || getPackingConversion(firstItem.packing || firstItem.weight);
      }

      // Calculate Peti count cleanly using conversion (NEVER arbitrary division)
      let calculatedCases = 1;
      if (firstItem.cases && firstItem.cases > 0) {
        calculatedCases = firstItem.cases;
      } else if (finalConversion > 0) {
        calculatedCases = Math.max(1, Math.ceil(totalQty / finalConversion));
      }

      const newPurchase = await Purchase.create({
        invoiceNumber: tp.invoiceNumber,
        purchaseDate: tp.purchaseDate,
        invoiceDate: tp.purchaseDate,
        manufacturer: tp.partyName,
        productName: firstItem.productName,
        batchNumber: firstItem.batchNumber,
        packing: firstItem.packing || null,
        packingSize: firstItem.packing || null,
        unit: firstItem.unit || 'kg',
        weight: firstItem.weight || firstItem.packing || null,
        quantity: totalQty,
        cases: calculatedCases,
        conversion: finalConversion,
        alternateUnit: tItem?.alternateUnit || 'BOX',
        purchaseCost: firstItem.costRate,
        costRate: firstItem.costRate,
        totalCost,
        mrp: firstItem.costRate ? Math.round(firstItem.costRate * 1.4) : 500,
        mfgDate: firstItem.mfgDate,
        warehouseLocation: firstItem.warehouseLocation,
        remarks: `Auto-synced from Tally (Voucher #${tp.vchNumber})`,
        status: autoGenerateBoxes ? 'barcode_generated' : 'submitted',
        tallySyncStatus: 'synced',
        tallyVoucherNumber: tp.vchNumber,
        tallyGuid: tp.guid,
        tallySyncedAt: new Date(),
        enteredByUsername: 'tally-auto-sync'
      });

      // Auto-generate StockBoxes with QR IDs (ONLY for valid positive quantities)
      if (autoGenerateBoxes) {
        const boxDocs = [];
        for (const item of validItems) {
          const qty = Math.min(item.quantity, 1000); // cap per item batch for sanity
          for (let i = 0; i < qty; i++) {
            const qrId = `VNK-${nextQrNum++}`;
            boxDocs.push({
              qrId,
              barcode: qrId,
              purchaseId: newPurchase._id,
              purchaseInvoice: tp.invoiceNumber,
              productName: item.productName,
              technicalName: item.technicalName || '',
              manufacturer: tp.partyName || 'VANIKI CROP SCIENCE PVT. LTD.',
              batchNumber: item.batchNumber || `VNK-B${formatTallyDate(tp.purchaseDate)}`,
              packing: item.packing || null,
              packingSize: item.packing || null,
              unit: item.unit || 'kg',
              cases: newPurchase.cases || 1,
              conversion: finalConversion,
              weight: item.weight || item.packing || null,
              mfgDate: item.mfgDate || new Date(),
              expDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              mrp: item.costRate ? Math.round(item.costRate * 1.4) : 500,
              purchaseCost: item.costRate || 0,
              totalCost: (item.costRate || 0) * 1,
              warehouseLocation: item.warehouseLocation || 'RAIPUR GODOWN',
              status: 'available',
              inwardDate: tp.purchaseDate || new Date(),
              history: [
                {
                  stage: 'Purchase Received',
                  title: 'Purchase Bill Logged',
                  description: `Received via Purchase Invoice #${tp.invoiceNumber} from ${tp.partyName}`,
                  performedBy: 'Tally Auto Sync',
                  timestamp: new Date()
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
                  description: `Stored at ${item.warehouseLocation || 'RAIPUR GODOWN'}`,
                  performedBy: 'Tally Auto Sync',
                  timestamp: new Date()
                }
              ]
            });
          }
        }

        if (boxDocs.length > 0) {
          await StockBox.insertMany(boxDocs, { ordered: false });
        }
      }

      imported++;
    } catch (err) {
      console.error(`[Tally Sync] Error processing invoice ${tp.invoiceNumber}:`, err);
      errors.push({ invoiceNumber: tp.invoiceNumber, error: err.message });
    }
  }

  return {
    totalTallyPurchases: tallyPurchases.length,
    imported,
    updated,
    skipped,
    errors
  };
}

/**
 * Push a Warehouse Purchase into Tally as a Purchase Voucher
 */
async function pushWarehousePurchaseToTally(purchaseIdOrData) {
  let purchase = purchaseIdOrData;
  if (typeof purchaseIdOrData === 'string') {
    purchase = await Purchase.findById(purchaseIdOrData);
    if (!purchase) throw new Error('Purchase record not found');
  }

  const partyName = purchase.manufacturer || 'Direct Supplier';
  const invoiceNum = purchase.invoiceNumber;
  const dateStr = formatTallyDate(purchase.purchaseDate || purchase.invoiceDate);
  const mfgDateStr = formatTallyDate(purchase.mfgDate || purchase.purchaseDate);

  // Map Godown to exact Tally godown names (Main Location, DURG, Bori)
  const mapGodown = (locStr) => {
    const s = String(locStr || '').toLowerCase();
    if (s.includes('durg')) return 'DURG';
    if (s.includes('bori')) return 'Bori';
    return 'Main Location';
  };

  const mapUnit = (uStr) => {
    const s = String(uStr || 'kg').trim().toUpperCase();
    if (s === 'KG') return 'KGS';
    if (s === 'L' || s === 'LITER' || s === 'LITRE') return 'LTR';
    return s;
  };

  // Check if multiple items exist under this purchase in StockBox
  const boxes = await StockBox.find({ purchaseId: purchase._id, isDeleted: { $ne: true } }).lean();
  let itemsToSync = [];

  if (boxes.length > 0) {
    const groupMap = new Map();
    for (const b of boxes) {
      const gName = mapGodown(b.warehouseLocation || purchase.warehouseLocation);
      const bBatch = b.batchNumber || purchase.batchNumber || `VNK-B${dateStr}`;
      const pName = b.productName || purchase.productName;
      const key = `${pName}__${bBatch}__${gName}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          productName: pName,
          batchNumber: bBatch,
          godown: gName,
          unit: mapUnit(b.unit || purchase.unit),
          costRate: Number(b.costRate || b.purchaseCost || purchase.costRate || purchase.purchaseCost || 0),
          qty: 0,
          mfgDate: b.mfgDate || purchase.mfgDate
        });
      }
      groupMap.get(key).qty += 1;
    }
    itemsToSync = Array.from(groupMap.values()).map(it => ({
      ...it,
      amount: Math.round(it.qty * it.costRate * 100) / 100
    }));
  } else {
    const gName = mapGodown(purchase.warehouseLocation);
    const costRate = Number(purchase.purchaseCost || purchase.costRate || 0);
    const qty = Number(purchase.quantity || 1);
    itemsToSync = [{
      productName: purchase.productName,
      batchNumber: purchase.batchNumber || `VNK-B${dateStr}`,
      godown: gName,
      unit: mapUnit(purchase.unit),
      costRate,
      qty,
      amount: purchase.totalCost || Math.round(qty * costRate * 100) / 100,
      mfgDate: purchase.mfgDate
    }];
  }

  const grandTotal = itemsToSync.reduce((acc, it) => acc + it.amount, 0) || Number(purchase.totalCost) || 0;

  // Build stock items creation XML
  const stockItemsXml = [...new Set(itemsToSync.map(i => i.productName))].map(pName => {
    const itemMeta = itemsToSync.find(i => i.productName === pName);
    return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${escapeXml(pName)}" ACTION="Create">
            <NAME>${escapeXml(pName)}</NAME>
            <BASEUNITS>${escapeXml(itemMeta.unit)}</BASEUNITS>
            <ISBATCHWISEON>Yes</ISBATCHWISEON>
            <ISMFGON>Yes</ISMFGON>
          </STOCKITEM>
        </TALLYMESSAGE>`;
  }).join('\n');

  // Build inventory entries XML
  const inventoryEntriesXml = itemsToSync.map(it => `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(it.productName)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <RATE>${it.costRate.toFixed(2)}/${escapeXml(it.unit)}</RATE>
              <AMOUNT>-${it.amount.toFixed(2)}</AMOUNT>
              <ACTUALQTY> ${it.qty} ${escapeXml(it.unit)}</ACTUALQTY>
              <BILLEDQTY> ${it.qty} ${escapeXml(it.unit)}</BILLEDQTY>
              <BATCHALLOCATIONS.LIST>
                <GODOWNNAME>${escapeXml(it.godown)}</GODOWNNAME>
                <BATCHNAME>${escapeXml(it.batchNumber)}</BATCHNAME>
                <MFDON>${formatTallyDate(it.mfgDate || purchase.purchaseDate)}</MFDON>
                <AMOUNT>-${it.amount.toFixed(2)}</AMOUNT>
                <ACTUALQTY> ${it.qty} ${escapeXml(it.unit)}</ACTUALQTY>
                <BILLEDQTY> ${it.qty} ${escapeXml(it.unit)}</BILLEDQTY>
              </BATCHALLOCATIONS.LIST>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>PURCHASE</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${it.amount.toFixed(2)}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>`).join('\n');

  const xmlPayload = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(TALLY_COMPANY)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <!-- Auto-create Party Ledger under Sundry Creditors -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(partyName)}" ACTION="Create">
            <NAME>${escapeXml(partyName)}</NAME>
            <PARENT>Sundry Creditors</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <AFFECTSSTOCK>No</AFFECTSSTOCK>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- Auto-create Stock Items if missing -->
        ${stockItemsXml}

        <!-- Create Purchase Voucher -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <REFERENCE>${escapeXml(invoiceNum)}</REFERENCE>
            <REFERENCEDATE>${dateStr}</REFERENCEDATE>
            <PARTYLEDGERNAME>${escapeXml(partyName)}</PARTYLEDGERNAME>
            <PARTYNAME>${escapeXml(partyName)}</PARTYNAME>
            <BASICBUYERNAME>${escapeXml(TALLY_COMPANY)}</BASICBUYERNAME>
            <STATENAME>Chhattisgarh</STATENAME>
            <ISINVOICE>Yes</ISINVOICE>

            <!-- Party Credit Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${grandTotal.toFixed(2)}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeXml(invoiceNum)}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>${grandTotal.toFixed(2)}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>

            <!-- Stock Items Debit with Batches & Godowns -->
            ${inventoryEntriesXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  const res = await fetch(TALLY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=utf-8',
      'Content-Length': String(Buffer.byteLength(xmlPayload))
    },
    body: xmlPayload,
    signal: controller.signal
  });
  clearTimeout(timeout);

  const respText = await res.text();
  const hasCreated = /<CREATED>\s*([1-9]\d*)\s*<\/CREATED>/i.test(respText);
  const hasAltered = /<ALTERED>\s*([1-9]\d*)\s*<\/ALTERED>/i.test(respText);
  const hasError = respText.match(/<LINEERROR>([^<]+)<\/LINEERROR>/i);

  if (hasCreated || hasAltered) {
    if (purchase._id) {
      await Purchase.findByIdAndUpdate(purchase._id, {
        tallySyncStatus: 'synced',
        tallySyncedAt: new Date(),
        tallySyncError: ''
      });
    }
    return { success: true, message: 'Purchase successfully saved to Tally' };
  } else {
    const errorMsg = hasError ? hasError[1] : 'Tally rejected purchase entry';
    if (purchase._id) {
      await Purchase.findByIdAndUpdate(purchase._id, {
        tallySyncStatus: 'failed',
        tallySyncError: errorMsg
      });
    }
    return { success: false, error: errorMsg };
  }
}

module.exports = {
  getTallyStatus,
  fetchTallyPurchases,
  syncTallyPurchasesToWarehouse,
  pushWarehousePurchaseToTally,
  TALLY_URL,
  TALLY_COMPANY
};
