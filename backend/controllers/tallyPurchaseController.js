const tallyService = require('../services/tallyService');
const { importTallyStockExcel } = require('../services/tallyExcelService');
const Purchase = require('../models/Purchase');

exports.getTallyStatus = async (req, res) => {
  try {
    const status = await tallyService.getTallyStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.syncFromTally = async (req, res) => {
  try {
    const { autoGenerateBoxes = true } = req.body || {};
    const result = await tallyService.syncTallyPurchasesToWarehouse({ autoGenerateBoxes });
    res.json({
      success: true,
      message: `Tally sync complete: ${result.imported} new purchases imported, ${result.updated} updated.`,
      result
    });
  } catch (err) {
    console.error('[Tally Sync Controller Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.syncTallyXml = async (req, res) => {
  try {
    const { xmlString, autoGenerateBoxes = true } = req.body || {};
    if (!xmlString) {
      return res.status(400).json({ success: false, message: 'No Tally XML provided' });
    }

    const purchases = tallyService.parseTallyPurchasesXml ? tallyService.parseTallyPurchasesXml(xmlString) : [];
    // Or if tallyService has sync:
    const result = await tallyService.syncPurchasesArrayToWarehouse ? await tallyService.syncPurchasesArrayToWarehouse(purchases, { autoGenerateBoxes }) : { imported: 0, updated: 0 };
    res.json({
      success: true,
      message: `Tally XML sync complete: ${result.imported} imported, ${result.updated} updated.`,
      result
    });
  } catch (err) {
    console.error('[Tally XML Sync Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadTallyFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Please upload a Tally file (.xls, .xlsx, .xml)' });
    }

    const filename = file.originalname || 'stock.xls';
    console.log(`[Tally Upload] Received file: ${filename} (${(file.size / 1024).toFixed(1)} KB)`);

    const result = await importTallyStockExcel(file.buffer, filename, { autoGenerateBoxes: true });
    res.json({
      success: true,
      message: `Imported ${result.createdPurchases} new purchases and generated ${result.totalBoxesCreated} QR StockBoxes successfully!`,
      ...result
    });
  } catch (err) {
    console.error('[Tally File Upload Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.pushToTally = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase invoice not found' });
    }

    const result = await tallyService.pushWarehousePurchaseToTally(purchase);
    if (result.success) {
      res.json({ success: true, message: result.message || 'Saved to Tally successfully' });
    } else {
      res.status(400).json({ success: false, message: result.error || 'Failed to save to Tally' });
    }
  } catch (err) {
    console.error('[Tally Push Controller Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
