const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const mongoose = require('mongoose');

const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');

/**
 * Parses a Tally Stock Summary Excel file buffer and imports lots as Purchases and StockBoxes
 */
async function importTallyStockExcel(fileBuffer, originalFilename = 'stock.xls', { autoGenerateBoxes = true } = {}) {
  // Write buffer to temp file
  const tempPath = path.join(os.tmpdir(), `tally_import_${Date.now()}_${originalFilename}`);
  fs.writeFileSync(tempPath, fileBuffer);

  try {
    const pythonScript = `
import zipfile
import xml.etree.ElementTree as ET
import re
import json
from datetime import datetime

def parse_date(d_str):
    if not d_str: return None
    d_str = d_str.strip()
    for fmt in ['%d-%b-%y', '%d-%b-%Y', '%d/%m/%Y', '%Y-%m-%d']:
        try:
            return datetime.strptime(d_str, fmt).isoformat()
        except ValueError:
            pass
    return None

def parse_product_info(raw_name):
    raw_name = raw_name.strip()
    m = re.search(r'(\\d+(?:\\.\\d+)?)\\s*(LTR|LT|ML|GM|KG|BAG)', raw_name, re.IGNORECASE)
    if m:
        num = m.group(1)
        unit_str = m.group(2).upper()
        if unit_str == 'LT': unit_str = 'LTR'
        packing = f'{num} {unit_str}'
        unit = 'Ltr' if unit_str in ['LTR', 'LT', 'ML'] else 'kg'
    else:
        packing = '1 kg'
        unit = 'kg'
        
    cleaned_name = re.sub(r'/\\d+', '', raw_name)
    cleaned_name = re.sub(r'\\(\\d+\\)?', '', cleaned_name)
    cleaned_name = re.sub(r'\\s+', ' ', cleaned_name).strip()
    return cleaned_name, packing, unit

with zipfile.ZipFile('${tempPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', 'r') as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
            if t is not None and t.text:
                shared_strings.append(t.text)
            else:
                r_texts = [r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text for r in si.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}r') if r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') is not None and r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text]
                shared_strings.append(''.join(r_texts))

    sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = sheet_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
    
    current_hsn = '38089910'
    current_category = 'Crop Protection'
    current_product_raw = None
    entries = []
    
    for r_idx, row in enumerate(rows):
        cells = {}
        for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            r_ref = c.get('r')
            col = ''.join([ch for ch in r_ref if ch.isalpha()])
            t = c.get('t')
            v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            val = v.text if v is not None else ''
            if t == 's' and val.isdigit():
                val = shared_strings[int(val)]
            cells[col] = val.strip() if isinstance(val, str) else val
            
        a = cells.get('A', '')
        b = cells.get('B', '')
        c = cells.get('C', '')
        d = cells.get('D', '')
        e = cells.get('E', '')
        f = cells.get('F', '')
        g = cells.get('G', '')
        
        if a == '38089910':
            current_hsn = '38089910'
            current_category = 'Crop Protection'
            continue
        elif a == '5%':
            current_hsn = '31059090'
            current_category = 'Plant Nutrition & Growth'
            continue
            
        if d in ['DURG', 'Bori', 'Main Location'] or 'Mfg Date' in b:
            try:
                qty = float(e)
            except:
                qty = 0
            if qty <= 0:
                continue
                
            try:
                rate = float(f)
            except:
                rate = 0
            try:
                val = float(g)
            except:
                val = qty * rate
                
            batch_no = a.strip()
            item_hsn = current_hsn
            if batch_no == '34021110' or 'STICK' in (current_product_raw or '') or 'CLEAR' in (current_product_raw or ''):
                item_hsn = '34021110'
                if batch_no == '34021110':
                    batch_no = 'VNK-STK-001'
                    
            clean_name, packing, unit = parse_product_info(current_product_raw or 'Generic Product')
            mfg_str = b.replace('Mfg Date :', '').strip() if 'Mfg Date' in b else ''
            exp_str = c.replace('Expiry Date :', '').strip() if 'Expiry Date' in c else ''
            
            godown_name = d if d else 'Main Location'
            warehouse_location = 'RAIPUR GODOWN' if godown_name == 'Main Location' else (f'{godown_name.upper()} GODOWN')
            
            entries.append({
                'productName': clean_name,
                'rawName': current_product_raw,
                'batchNumber': batch_no,
                'packing': packing,
                'packingSize': packing,
                'unit': unit,
                'hsnCode': item_hsn,
                'category': current_category,
                'quantity': qty,
                'purchaseCost': rate,
                'costRate': rate,
                'totalCost': val,
                'mrp': round(rate * 1.35, 2) if rate > 0 else 500,
                'mfgDate': parse_date(mfg_str) or '2026-06-01T00:00:00',
                'expDate': parse_date(exp_str) or '2028-06-01T00:00:00',
                'warehouseLocation': warehouse_location,
                'godown': godown_name
            })
        elif a and a not in ['Particulars', 'VANIKI CROP SCIENCE PVT. LTD.', 'Stock Summary', 'Ring Road No.2 , Timber Market', 'Simran Complex, Bhanpuri Raipur', 'Contact : 9406161233,+91-9302228886', 'E-Mail : vaniki.crop@gmail.com', '1-Apr-26 to 26-Sep-26', 'Grand Total', '1']:
            current_product_raw = a

print(json.dumps(entries))
`;

    const output = execSync('python3', { input: pythonScript, maxBuffer: 20 * 1024 * 1024 }).toString();
    const lots = JSON.parse(output);

    // Find highest existing QR number (numeric max aggregation to prevent duplicate key collisions)
    const [top] = await StockBox.aggregate([
      { $match: { qrId: /^VNK-\d+$/ } },
      { $project: { num: { $toInt: { $substrBytes: ['$qrId', 4, 20] } } } },
      { $sort: { num: -1 } },
      { $limit: 1 }
    ]);
    let nextQrNum = (top?.num || 0) + 1;
    while (await StockBox.exists({ qrId: `VNK-${nextQrNum}` })) {
      nextQrNum++;
    }

    let createdPurchases = 0;
    let updatedPurchases = 0;
    let totalBoxesCreated = 0;

    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i];
      const invoiceNumber = `VNK-TLY-${String(i + 1).padStart(3, '0')}`;

      // Auto-register in product catalog
      const safeRegex = lot.productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let prod = await Product.findOne({ name: { $regex: `^${safeRegex}$`, $options: 'i' }, isDeleted: false });
      if (!prod) {
        await Product.create({
          productCode: `PRD-${String(100000 + i)}`,
          name: lot.productName,
          category: lot.category || 'Crop Protection',
          unit: lot.unit || 'kg',
          packingSize: lot.packingSize || null,
          hsnCode: lot.hsnCode || '38089910',
          mrp: lot.mrp || 500,
          minStockThreshold: 20,
          description: `Imported from Tally Stock Summary (${lot.godown})`
        });
      }

      const boxCount = Math.max(1, Math.round(lot.quantity));

      let purchase = await Purchase.findOne({ invoiceNumber });
      if (!purchase) {
        purchase = await Purchase.create({
          invoiceNumber,
          purchaseDate: new Date(lot.mfgDate || '2026-09-26'),
          invoiceDate: new Date(lot.mfgDate || '2026-09-26'),
          manufacturer: 'VANIKI CROP SCIENCE PVT. LTD.',
          productName: lot.productName,
          technicalName: lot.category,
          batchNumber: lot.batchNumber,
          packing: lot.packing,
          packingSize: lot.packingSize,
          unit: lot.unit,
          weight: lot.packing,
          hsnCode: lot.hsnCode,
          category: lot.category,
          quantity: boxCount,
          cases: boxCount,
          purchaseCost: lot.purchaseCost,
          costRate: lot.costRate,
          totalCost: lot.totalCost,
          mrp: lot.mrp,
          mfgDate: new Date(lot.mfgDate),
          expDate: new Date(lot.expDate),
          warehouseLocation: lot.warehouseLocation,
          remarks: `Tally Stock Balance: ${lot.godown} | Batch: ${lot.batchNumber}`,
          status: 'barcode_generated',
          tallySyncStatus: 'synced',
          tallyVoucherNumber: `TLY-${String(i + 1).padStart(3, '0')}`,
          tallySyncedAt: new Date(),
          enteredByUsername: 'tally-excel-import'
        });
        createdPurchases++;
      } else {
        // Update metadata
        purchase.productName = lot.productName;
        purchase.batchNumber = lot.batchNumber;
        purchase.warehouseLocation = lot.warehouseLocation;
        purchase.hsnCode = lot.hsnCode;
        purchase.totalCost = lot.totalCost;
        purchase.purchaseCost = lot.purchaseCost;
        purchase.tallySyncStatus = 'synced';
        await purchase.save();
        updatedPurchases++;
      }

      // Generate StockBoxes if none exist for this purchase
      const existingBoxesCount = await StockBox.countDocuments({ purchaseInvoice: invoiceNumber, isDeleted: false });
      if (existingBoxesCount === 0 && autoGenerateBoxes) {
        const boxDocs = [];
        for (let b = 0; b < boxCount; b++) {
          const qrId = `VNK-${nextQrNum++}`;
          boxDocs.push({
            qrId,
            barcode: qrId,
            purchaseId: purchase._id,
            purchaseInvoice: invoiceNumber,
            productName: lot.productName,
            technicalName: lot.category,
            manufacturer: 'VANIKI CROP SCIENCE PVT. LTD.',
            batchNumber: lot.batchNumber,
            weight: lot.packing,
            hsnCode: lot.hsnCode,
            packing: lot.packing,
            packingSize: lot.packingSize,
            cases: 1,
            purchaseCost: lot.purchaseCost,
            totalCost: lot.purchaseCost,
            costRate: lot.costRate,
            category: lot.category,
            unit: lot.unit,
            mrp: lot.mrp,
            mfgDate: new Date(lot.mfgDate),
            expDate: new Date(lot.expDate),
            warehouseLocation: lot.warehouseLocation,
            stickerStatus: 'not_printed',
            verificationStatus: 'verified',
            status: 'available',
            history: [
              {
                stage: 'Purchase Received',
                title: 'Stock Inward from Tally',
                description: `Stock inward lot for ${lot.productName} (Batch ${lot.batchNumber}) imported into ${lot.warehouseLocation}.`,
                performedBy: 'Tally Stock Sync',
                timestamp: new Date()
              },
              {
                stage: 'QR Generated',
                title: 'Box QR Code Assigned',
                description: `Assigned identifier ${qrId} for stock box verification and tracking.`,
                performedBy: 'Tally Stock Sync',
                timestamp: new Date()
              }
            ]
          });
        }

        await StockBox.insertMany(boxDocs);
        totalBoxesCreated += boxDocs.length;
      }
    }

    return {
      success: true,
      totalLots: lots.length,
      createdPurchases,
      updatedPurchases,
      totalBoxesCreated
    };
  } finally {
    try { fs.unlinkSync(tempPath); } catch (e) {}
  }
}

module.exports = { importTallyStockExcel };
