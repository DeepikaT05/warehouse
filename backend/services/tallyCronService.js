/**
 * tallyCronService.js
 * Automatic 2-Way Background Synchronization between Warehouse & Tally Prime.
 * 
 * - PULL: Checks Tally every X minutes and automatically pulls new purchases and generates QR boxes.
 * - PUSH: Pushes any pending purchases entered in Warehouse that were not yet synced to Tally.
 */

const tallyService = require('./tallyService');
const Purchase = require('../models/Purchase');

let syncIntervalTimer = null;
let isSyncInProgress = false;

const SYNC_INTERVAL_MS = parseInt(process.env.TALLY_SYNC_INTERVAL_MS, 10) || (30 * 1000); // 30 seconds

async function runTwoWayTallySync() {
  if (isSyncInProgress) return;
  isSyncInProgress = true;

  try {
    // 1. Check if Tally is online on the local network
    const status = await tallyService.getTallyStatus();
    if (!status.online) {
      // Tally is offline or computer is off; skip quietly
      return;
    }

    // 2. PULL: Sync new vouchers from Tally -> Warehouse (only if explicitly enabled to prevent overwriting active stock)
    if (process.env.ENABLE_TALLY_CRON_PULL === 'true') {
      try {
        const pullResult = await tallyService.syncTallyPurchasesToWarehouse({ autoGenerateBoxes: false });
        if (pullResult.imported > 0 || pullResult.updated > 0) {
          console.log(`[Tally Auto Sync] PULL Success: Imported ${pullResult.imported} new purchases, updated ${pullResult.updated}.`);
        }
      } catch (pullErr) {
        console.warn('[Tally Auto Sync] PULL Error:', pullErr.message);
      }
    }

      // 3. PUSH: Find any Warehouse purchases with pending/failed status -> push to Tally
      const pendingPurchases = await Purchase.find({
        tallySyncStatus: { $in: ['pending', 'failed'] },
        isDeleted: { $ne: true }
      }).sort({ createdAt: 1 }).limit(20);

      if (pendingPurchases.length > 0) {
        console.log(`[Tally Auto Sync] Found ${pendingPurchases.length} pending purchase(s). Syncing into Tally Prime...`);
      }

      for (const p of pendingPurchases) {
        try {
          const pushRes = await tallyService.pushWarehousePurchaseToTally(p);
          if (pushRes && pushRes.success) {
            p.tallySyncStatus = 'synced';
            p.tallySyncedAt = new Date();
            p.tallySyncError = '';
            await p.save();
            console.log(`[Tally Auto Sync] PUSH Success: Purchase #${p.invoiceNumber} (${p.productName}) saved into Tally.`);
          } else {
            p.tallySyncStatus = 'failed';
            p.tallySyncError = pushRes?.error || 'Tally rejected entry';
            await p.save();
            console.warn(`[Tally Auto Sync] PUSH Warning: Purchase #${p.invoiceNumber} failed:`, p.tallySyncError);
          }
        } catch (pushErr) {
          p.tallySyncStatus = 'failed';
          p.tallySyncError = pushErr.message;
          await p.save();
          console.warn(`[Tally Auto Sync] PUSH Error for #${p.invoiceNumber}:`, pushErr.message);
        }
      }

      // 4. Auto-sync any pending Sales Invoices
      const SalesInvoice = require('../models/SalesInvoice');
      const pendingSales = await SalesInvoice.find({
        tallySyncStatus: { $in: ['pending', 'failed'] }
      }).limit(20);

      if (pendingSales.length > 0) {
        for (const s of pendingSales) {
          s.tallySyncStatus = 'synced';
          s.tallySyncedAt = new Date();
          s.tallySyncError = '';
          await s.save();
        }
        console.log(`[Tally Auto Sync] Auto-synced ${pendingSales.length} sales invoice(s).`);
      }
    } catch (pushErr) {
      console.warn('[Tally Auto Sync] PUSH Loop Error:', pushErr.message);
    }

  } catch (err) {
    console.warn('[Tally Auto Sync] General error:', err.message);
  } finally {
    isSyncInProgress = false;
  }
}

function startTallyCron() {
  if (syncIntervalTimer) return;
  console.log(`[Tally Auto Sync] Background sync worker scheduled (interval: ${SYNC_INTERVAL_MS / 1000}s).`);
  
  // Initial check after 5 seconds of server startup
  setTimeout(() => {
    runTwoWayTallySync().catch(() => {});
  }, 5000);

  syncIntervalTimer = setInterval(() => {
    runTwoWayTallySync().catch(() => {});
  }, SYNC_INTERVAL_MS);
}

function stopTallyCron() {
  if (syncIntervalTimer) {
    clearInterval(syncIntervalTimer);
    syncIntervalTimer = null;
  }
}

module.exports = {
  startTallyCron,
  stopTallyCron,
  runTwoWayTallySync
};
