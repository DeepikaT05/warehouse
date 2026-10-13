const mongoose = require('mongoose');
const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const StockBox = require('../models/StockBox');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

// Central Vaniki-Crop Mongo URI & API Configuration
const CENTRAL_MONGO_URI = process.env.CENTRAL_MONGO_URI || 'mongodb://127.0.0.1:27017/vaniki-crop';
const CENTRAL_API_URL = process.env.CENTRAL_API_URL || 'http://127.0.0.1:5000/api';
const CENTRAL_JWT_SECRET = process.env.CENTRAL_JWT_SECRET || 'vaniki_dev_jwt_secret_2026_change_me';
const CENTRAL_SUPERADMIN_ID = process.env.CENTRAL_SUPERADMIN_ID || '69d4c3ef71529a07bbf8add2';

let centralConnection = null;

/**
 * Get or initialize persistent native connection to central vaniki-crop database
 */
const getCentralConnection = async () => {
  if (centralConnection && centralConnection.readyState === 1) {
    return centralConnection;
  }
  try {
    centralConnection = await mongoose.createConnection(CENTRAL_MONGO_URI).asPromise();
    console.log('[B2B Sync] Successfully connected to central vaniki-crop MongoDB');
    return centralConnection;
  } catch (err) {
    console.error('[B2B Sync] Failed to connect to central MongoDB directly:', err.message);
    return null;
  }
};

/**
 * Generate a superAdmin JWT token to communicate with central API if needed
 */
const generateSuperAdminToken = () => {
  try {
    return jwt.sign(
      { userId: CENTRAL_SUPERADMIN_ID, role: 'superAdmin' },
      CENTRAL_JWT_SECRET,
      { expiresIn: '1d' }
    );
  } catch (err) {
    console.error('[B2B Sync] JWT generation error:', err.message);
    return '';
  }
};

/**
 * Sync B2B Invoices & Product Requests from Vaniki Crop system into Warehouse DB
 */
const syncB2BInvoices = async () => {
  const stats = {
    totalCentralInvoices: 0,
    created: 0,
    updated: 0,
    rejectedSynced: 0,
    errors: []
  };

  try {
    const conn = await getCentralConnection();
    let b2bInvoices = [];
    let productRequests = [];
    let storesMap = new Map();

    if (conn) {
      // Direct high-speed MongoDB querying
      const b2bInvoicesColl = conn.collection('b2binvoices');
      const storesColl = conn.collection('stores');
      const productRequestsColl = conn.collection('productrequests');

      b2bInvoices = await b2bInvoicesColl.find({}).sort({ createdAt: -1 }).toArray();
      const rawStores = await storesColl.find({}).toArray();
      productRequests = await productRequestsColl.find({}).toArray();

      rawStores.forEach(s => storesMap.set(s._id.toString(), s));
    } else {
      // Fallback via HTTP API using native fetch
      const token = generateSuperAdminToken();
      const res = await fetch(`${CENTRAL_API_URL}/b2b-invoices/super-admin/list?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resJson = await res.json();
      if (resJson && resJson.data) {
        b2bInvoices = resJson.data;
      }
    }

    stats.totalCentralInvoices = b2bInvoices.length;

    // Create lookup index for product requests by invoiceId and by batchId/buyerOrderNo
    const requestsByInvoiceId = new Map();
    const requestsByOrderNo = new Map();

    productRequests.forEach(req => {
      if (req.invoiceId) {
        requestsByInvoiceId.set(req.invoiceId.toString(), req);
      }
      if (req.batchId) {
        requestsByOrderNo.set(req.batchId.toString().trim(), req);
      }
    });

    for (const inv of b2bInvoices) {
      try {
        const centralInvId = inv._id.toString();
        const invoiceNo = (inv.invoiceNumber || '').trim();
        if (!invoiceNo) continue;

        // Determine Store / Dealer Details
        let storeObj = null;
        if (inv.storeId && typeof inv.storeId === 'object' && inv.storeId.name) {
          storeObj = inv.storeId;
        } else if (inv.storeId) {
          storeObj = storesMap.get(inv.storeId.toString());
        }

        const storeName = storeObj?.name || 'Vaniki Kisan Kendra';
        const storePhone = storeObj?.phone || storeObj?.mobile || '9407963966';
        const storeCity = storeObj?.address?.city || 'Bhilai';
        const storeState = storeObj?.address?.state || 'Chhattisgarh';
        const storeStreet = storeObj?.address?.street || 'Main Road';
        const storePincode = storeObj?.address?.pincode || '490001';
        const storeGst = storeObj?.gstin || '';

        // Match or create Dealer record in warehouse_db
        let dealer = await Dealer.findOne({
          $or: [
            { phone: storePhone },
            { dealerName: storeName }
          ]
        });

        if (!dealer) {
          dealer = await Dealer.create({
            dealerName: storeName,
            garageName: storeName,
            phone: storePhone,
            email: storeObj?.email || '',
            gstNumber: storeGst,
            address: storeStreet,
            city: storeCity,
            state: storeState,
            district: storeCity,
            pincode: storePincode
          });
        }

        // Map items
        const rawItems = Array.isArray(inv.items) ? inv.items : [];
        const mappedItems = rawItems.map(item => {
          const qty = Number(item.qty || item.quantity || 1);
          const price = Number(item.price || 0);
          const taxRate = Number(item.taxRate || 18);
          const taxAmount = Number(item.taxAmount || ((price * qty * taxRate) / 100));
          const total = Number(item.total || ((price * qty) + taxAmount));

          let weightStr = '1 unit';
          if (item.petiSize) {
            weightStr = `${item.petiSize} ${item.petiUnit || 'Liter'}`;
          } else if (item.productName && item.productName.includes('-')) {
            const parts = item.productName.split('-');
            weightStr = parts[parts.length - 1].trim();
          }

          return {
            productName: item.productName || 'General Product',
            batchNumber: item.batchNumber || `BATCH-${invoiceNo.replace(/[^0-9]/g, '') || '01'}`,
            quantity: qty,
            weight: weightStr,
            hsnCode: item.hsnCode || '38089190',
            price,
            taxRate,
            total
          };
        });

        // Check if invoice or linked product request is rejected
        const linkedReq = requestsByInvoiceId.get(centralInvId) || (inv.buyerOrderNo ? requestsByOrderNo.get(inv.buyerOrderNo.trim()) : null);
        const isCentralRejected = (linkedReq && linkedReq.status === 'rejected') || inv.paymentStatus === 'rejected';

        let rejectionReason = '';
        let rejectedAt = null;

        if (isCentralRejected) {
          rejectionReason = linkedReq?.superAdminNote || linkedReq?.notes || (inv.paymentStatus === 'rejected' ? 'Payment rejected by Superadmin' : 'Request rejected by Superadmin/Dealer');
          rejectedAt = linkedReq?.updatedAt || inv.updatedAt || new Date();
        }

        // Check existing warehouse SalesInvoice
        let existing = await SalesInvoice.findOne({
          $or: [
            { invoiceNo },
            { centralInvoiceId: centralInvId }
          ]
        });

        if (existing) {
          let hasChanges = false;

          // If central is rejected, and order is not already rejected/cancelled
          if (isCentralRejected && existing.orderStatus !== 'rejected' && existing.orderStatus !== 'cancelled') {
            existing.orderStatus = 'rejected';
            existing.status = 'rejected';
            existing.isRejected = true;
            existing.rejectionReason = rejectionReason;
            existing.rejectedAt = rejectedAt;
            existing.rejectedBy = 'Central SuperAdmin Portal';
            hasChanges = true;
            stats.rejectedSynced += 1;
          }

          // Update latest fields from central
          if (inv.tallySyncStatus && existing.tallySyncStatus !== inv.tallySyncStatus) {
            existing.tallySyncStatus = inv.tallySyncStatus;
            hasChanges = true;
          }
          if (inv.paymentStatus && existing.paymentStatus !== inv.paymentStatus) {
            existing.paymentStatus = inv.paymentStatus;
            hasChanges = true;
          }
          if (!existing.centralInvoiceId) {
            existing.centralInvoiceId = centralInvId;
            existing.source = 'b2b_portal';
            existing.isB2BOrder = true;
            hasChanges = true;
          }

          if (hasChanges) {
            await existing.save();
            stats.updated += 1;
          }
        } else {
          // Create new SalesInvoice in warehouse_db
          const newOrderStatus = isCentralRejected ? 'rejected' : 'new';
          const newStatus = isCentralRejected ? 'rejected' : 'pending';

          await SalesInvoice.create({
            invoiceNo,
            orderId: inv.buyerOrderNo || `REQ-${invoiceNo}`,
            dealerId: dealer._id,
            dealerName: dealer.dealerName,
            garageName: dealer.garageName,
            dealerAddress: `${dealer.address}, ${dealer.city}, ${dealer.state}`,
            dealerPhone: dealer.phone,
            dealerGst: dealer.gstNumber,
            invoiceDate: inv.invoiceDate || new Date(),
            items: mappedItems,
            assignedToUser: 'warehouse1',
            orderStatus: newOrderStatus,
            status: newStatus,

            // Central B2B Fields
            centralInvoiceId: centralInvId,
            centralStoreId: storeObj?._id ? storeObj._id.toString() : (inv.storeId ? inv.storeId.toString() : ''),
            buyerOrderNo: inv.buyerOrderNo || '',
            buyerOrderDate: inv.buyerOrderDate || null,
            dispatchDocNo: inv.dispatchDocNo || '',
            despatchedThrough: inv.despatchedThrough || 'Vaniki Fleet / Transport',
            destination: inv.destination || storeCity,
            termsOfDelivery: inv.termsOfDelivery || 'Door Delivery',
            paymentTerms: inv.paymentTerms || 'Immediate / On Delivery',
            paymentStatus: inv.paymentStatus || 'unpaid',
            tallySyncStatus: inv.tallySyncStatus || 'synced',
            subtotal: inv.subtotal || 0,
            totalTaxAmount: inv.totalTaxAmount || 0,
            totalAmount: inv.totalAmount || 0,
            source: 'b2b_portal',
            isB2BOrder: true,
            b2bPdfUrl: `https://vanikicrop.com/api/b2b-invoices/download/${centralInvId}`,
            b2bXmlUrl: `https://vanikicrop.com/api/tally/download-xml/${centralInvId}`,

            // Rejection Details
            isRejected: isCentralRejected,
            rejectionReason: isCentralRejected ? rejectionReason : '',
            rejectedAt: isCentralRejected ? rejectedAt : null,
            rejectedBy: isCentralRejected ? 'Central SuperAdmin Portal' : ''
          });

          stats.created += 1;
          if (isCentralRejected) {
            stats.rejectedSynced += 1;
          }
        }
      } catch (itemErr) {
        console.error(`[B2B Sync] Error processing invoice #${inv.invoiceNumber}:`, itemErr.message);
        stats.errors.push({ invoiceNo: inv.invoiceNumber, error: itemErr.message });
      }
    }

    console.log(`[B2B Sync] Finished sync. Invoices: ${stats.totalCentralInvoices}, Created: ${stats.created}, Updated: ${stats.updated}, Rejected: ${stats.rejectedSynced}`);
    return { success: true, stats };
  } catch (err) {
    console.error('[B2B Sync] Fatal error during sync:', err.message);
    return { success: false, message: err.message, stats };
  }
};

/**
 * Cancel an order locally from warehouse app with reason and release picked stock
 */
const cancelOrderLocally = async (orderId, reason, actor = 'Warehouse Admin') => {
  const order = await SalesInvoice.findById(orderId);
  if (!order) {
    throw new Error('Order not found.');
  }

  if (order.orderStatus === 'completed' || order.status === 'dispatched') {
    throw new Error('Cannot cancel an order that has already been dispatched and completed.');
  }

  const previousStatus = order.orderStatus;
  order.orderStatus = 'cancelled';
  order.status = 'cancelled';
  order.isCancelled = true;
  order.cancellationReason = reason || 'Order cancelled by warehouse operator';
  order.cancelledAt = new Date();
  order.cancelledBy = actor;

  // Release any picked boxes back to available stock
  if (order.pickedItems && order.pickedItems.length > 0) {
    const pickedQrIds = order.pickedItems.map(p => p.qrId);
    await StockBox.updateMany(
      { qrId: { $in: pickedQrIds }, status: 'reserved' },
      {
        $set: { status: 'available' },
        $push: {
          history: {
            stage: 'Order Cancelled',
            title: 'Stock Released',
            description: `Released from cancelled Order #${order.invoiceNo}. Reason: ${order.cancellationReason}`,
            performedBy: actor,
            timestamp: new Date()
          }
        }
      }
    );
  }

  await order.save();

  await AuditLog.create({
    action: 'ORDER_CANCELLED',
    user: actor,
    role: 'warehouse',
    module: 'Orders',
    details: `Order #${order.invoiceNo} cancelled (was: ${previousStatus}). Reason: ${order.cancellationReason}`
  });

  return order;
};

module.exports = {
  syncB2BInvoices,
  cancelOrderLocally,
  generateSuperAdminToken,
  getCentralConnection
};
