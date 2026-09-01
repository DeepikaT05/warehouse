const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const SalesInvoice = require('../models/SalesInvoice');
const Dispatch = require('../models/Dispatch');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');

// Helper to generate sequential QR ID (e.g. VNK-00000001)
const generateNextQrId = async () => {
  const lastBox = await StockBox.findOne({}, { qrId: 1 }).sort({ createdAt: -1 });
  let nextNum = 1;
  if (lastBox && lastBox.qrId) {
    const match = lastBox.qrId.match(/VNK-(\d+)/i);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  return nextNum;
};

// -------------------------------------------------------------
// 1. PURCHASE ENTRY & STOCK INWARD MODULE
// -------------------------------------------------------------
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ isDeleted: false }).sort({ createdAt: -1 });
    return res.json({ success: true, purchases });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createPurchase = async (req, res) => {
  try {
    const {
      invoiceNumber,
      purchaseDate,
      manufacturer,
      invoiceDate,
      transport,
      lrNumber,
      productName,
      category,
      batchNumber,
      packingSize,
      unit,
      quantity,
      weight,
      purchaseCost,
      mrp,
      mfgDate,
      expDate,
      billFileUrl,
      remarks,
      isDraft
    } = req.body;

    if (!invoiceNumber || !manufacturer || !productName || !batchNumber || !quantity) {
      return res.status(400).json({ success: false, message: 'Please fill all required purchase entry fields.' });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer.' });
    }

    const status = isDraft ? 'draft' : 'submitted';

    const purchase = await Purchase.create({
      invoiceNumber,
      purchaseDate: purchaseDate || Date.now(),
      manufacturer,
      invoiceDate: invoiceDate || Date.now(),
      transport: transport || '',
      lrNumber: lrNumber || '',
      productName,
      category: category || 'Crop Protection',
      batchNumber,
      packingSize: packingSize || '1 kg',
      unit: unit || 'kg',
      quantity: qty,
      weight: weight || packingSize || '1 kg',
      purchaseCost: Number(purchaseCost) || 0,
      mrp: Number(mrp) || 0,
      mfgDate: mfgDate || Date.now(),
      expDate: expDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      billFileUrl: billFileUrl || '',
      remarks: remarks || '',
      status,
      isLocked: !isDraft,
      createdBy: req.user?.id,
      enteredByUsername: req.user?.username || 'warehouse1'
    });

    await AuditLog.create({
      action: isDraft ? 'PURCHASE_DRAFT_CREATED' : 'PURCHASE_SUBMITTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'PurchaseEntry',
      details: `Logged Purchase #${invoiceNumber} (${qty} boxes of ${productName}, batch ${batchNumber})`
    });

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Purchase entry saved as draft.' : 'Purchase entry submitted! Ready for QR code generation.',
      purchase
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase || purchase.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase record not found.' });
    }
    const boxes = await StockBox.find({ purchaseId: purchase._id, isDeleted: false });
    return res.json({ success: true, purchase, boxes });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const finalizePurchaseSubmit = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found.' });

    purchase.status = 'submitted';
    purchase.isLocked = true;
    await purchase.save();

    await AuditLog.create({
      action: 'PURCHASE_SUBMITTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'PurchaseEntry',
      details: `Finalized and locked purchase #${purchase.invoiceNumber}`
    });

    return res.json({ success: true, message: 'Purchase entry finalized and locked successfully.', purchase });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 2. BARCODE & QR CODE GENERATION & STICKER PRINTING MODULE
// -------------------------------------------------------------
const generatePurchaseQrCodes = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found.' });

    const existingBoxes = await StockBox.countDocuments({ purchaseId: purchase._id });
    if (existingBoxes > 0) {
      const boxes = await StockBox.find({ purchaseId: purchase._id });
      return res.json({
        success: true,
        message: 'QR codes already generated for this purchase entry.',
        boxes
      });
    }

    let currentSeq = await generateNextQrId();
    const createdBoxes = [];

    for (let i = 0; i < purchase.quantity; i++) {
      const formattedSeq = String(currentSeq + i);
      const qrId = `VNK-${formattedSeq}`;
      const barcode = `VNK-${formattedSeq}`;

      const box = new StockBox({
        qrId,
        barcode,
        purchaseId: purchase._id,
        productName: purchase.productName,
        manufacturer: purchase.manufacturer,
        batchNumber: purchase.batchNumber,
        category: purchase.category,
        unit: purchase.unit,
        packingSize: purchase.packingSize,
        weight: purchase.weight || purchase.packingSize,
        purchaseInvoice: purchase.invoiceNumber,
        purchaseCost: purchase.purchaseCost,
        mrp: purchase.mrp,
        mfgDate: purchase.mfgDate,
        expDate: purchase.expDate,
        warehouseLocation: 'Rack A1',
        stickerStatus: 'not_printed',
        verificationStatus: 'pending_verification',
        status: 'pending_verification',
        history: [
          {
            stage: 'Purchase Received',
            title: 'Purchase Bill Logged',
            description: `Received via Purchase Invoice #${purchase.invoiceNumber} from ${purchase.manufacturer}`,
            performedBy: req.user?.username || 'Warehouse Worker',
            timestamp: new Date()
          },
          {
            stage: 'QR Generated',
            title: 'Unique Barcode/QR Assigned',
            description: `Unique identity ${qrId} generated for box`,
            performedBy: req.user?.username || 'Warehouse Worker',
            timestamp: new Date()
          }
        ]
      });

      await box.save();
      createdBoxes.push(box);
    }

    purchase.status = 'barcode_generated';
    await purchase.save();

    await AuditLog.create({
      action: 'QR_CODES_GENERATED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'QRGenerator',
      details: `Generated ${createdBoxes.length} barcode/QR stickers for Purchase #${purchase.invoiceNumber}`
    });

    return res.status(201).json({
      success: true,
      message: `Successfully generated ${createdBoxes.length} unique barcode/QR IDs!`,
      totalBoxes: createdBoxes.length,
      boxes: createdBoxes
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const recordStickerPrint = async (req, res) => {
  try {
    const { id } = req.params; // box ID or qrId
    const box = await StockBox.findOne({ $or: [{ _id: id }, { qrId: id }] });
    if (!box) return res.status(404).json({ success: false, message: 'Stock box not found.' });

    const isReprint = box.printCount > 0;
    box.printCount += 1;
    box.stickerStatus = isReprint ? 'reprinted' : 'printed';

    box.history.push({
      stage: isReprint ? 'Sticker Reprinted' : 'Sticker Printed',
      title: isReprint ? `Sticker Reprinted (Count: ${box.printCount})` : 'Sticker Printed',
      description: 'Printed barcode sticker label for physical box application',
      performedBy: req.user?.username || 'Warehouse Worker',
      timestamp: new Date()
    });

    await box.save();

    await AuditLog.create({
      action: isReprint ? 'STICKER_REPRINTED' : 'STICKER_PRINTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StickerPrinter',
      details: `Printed sticker label for QR ${box.qrId}`
    });

    return res.json({ success: true, message: `Sticker print recorded for ${box.qrId}`, box });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 3. INITIAL STOCK VERIFICATION & SEARCH MODULE
// -------------------------------------------------------------
const getStockBoxes = async (req, res) => {
  try {
    const { search, product, batch, status } = req.query;
    const filter = { isDeleted: false };

    if (product) filter.productName = { $regex: product, $options: 'i' };
    if (batch) filter.batchNumber = { $regex: batch, $options: 'i' };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { qrId: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } },
        { purchaseInvoice: { $regex: search, $options: 'i' } }
      ];
    }

    const boxes = await StockBox.find(filter).sort({ createdAt: -1 });

    const summary = {
      total: await StockBox.countDocuments({ isDeleted: false }),
      pendingVerification: await StockBox.countDocuments({ isDeleted: false, verificationStatus: 'pending_verification' }),
      available: await StockBox.countDocuments({ isDeleted: false, status: 'available' }),
      dispatched: await StockBox.countDocuments({ isDeleted: false, status: 'dispatched' })
    };

    return res.json({ success: true, boxes, summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const verifyInitialStockScan = async (req, res) => {
  try {
    const { barcode } = req.body;
    if (!barcode) {
      return res.status(400).json({ success: false, verified: false, message: 'Barcode / QR ID is required.' });
    }

    const cleanCode = barcode.trim().toUpperCase();
    const box = await StockBox.findOne({
      $or: [{ qrId: cleanCode }, { barcode: cleanCode }],
      isDeleted: false
    });

    if (!box) {
      return res.json({
        success: false,
        verified: false,
        code: 'BARCODE_NOT_FOUND',
        title: 'Barcode Not Found',
        message: `No stock box record found for barcode '${cleanCode}'.`
      });
    }

    if (box.verificationStatus === 'verified' && box.status === 'available') {
      return res.json({
        success: true,
        verified: true,
        alreadyVerified: true,
        title: 'Already Verified',
        message: `Box ${box.qrId} is already verified and available in warehouse stock.`,
        box
      });
    }

    box.verificationStatus = 'verified';
    box.status = 'available';
    box.history.push({
      stage: 'Stock Verified',
      title: 'Initial Physical Stock Verified',
      description: 'Scanned & matched physical product entry with warehouse system',
      performedBy: req.user?.username || 'Warehouse Worker',
      timestamp: new Date()
    });

    await box.save();

    await AuditLog.create({
      action: 'INITIAL_STOCK_VERIFIED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StockVerification',
      details: `Verified stock box QR ${box.qrId}`
    });

    return res.json({
      success: true,
      verified: true,
      title: 'Stock Verified Successfully',
      message: `Box ${box.qrId} (${box.productName}, Batch: ${box.batchNumber}) verified and marked available for dispatch.`,
      box
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 4. ASSIGNED DEALER ORDERS / BILLS MODULE
// -------------------------------------------------------------
const getAssignedOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.orderStatus = status;

    const orders = await SalesInvoice.find(filter).sort({ createdAt: -1 }).populate('dealerId');
    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order / bill not found.' });

    if (order.orderStatus === 'new') {
      order.orderStatus = 'viewed';
      await order.save();
    }

    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 5. INTERACTIVE STOCK PICKING MODULE (SCAN STICKER VS BILL)
// -------------------------------------------------------------
const startStockPicking = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.orderStatus = 'picking_started';
    await order.save();

    await AuditLog.create({
      action: 'STOCK_PICKING_STARTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StockPicking',
      details: `Started picking stock for Order #${order.invoiceNo}`
    });

    return res.json({ success: true, message: `Stock picking started for Order #${order.invoiceNo}`, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const scanPickingItem = async (req, res) => {
  try {
    const { id } = req.params; // Order ID
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ success: false, valid: false, message: 'Barcode / QR ID is required.' });
    }

    const order = await SalesInvoice.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const cleanCode = barcode.trim().toUpperCase();

    // Find stock box by QR ID, Barcode, Product Name, or Product Code
    let box = await StockBox.findOne({
      $or: [{ qrId: cleanCode }, { barcode: cleanCode }],
      isDeleted: { $ne: true }
    });

    // If not found by QR/Barcode, check if input matches product name or product code for available stock
    if (!box) {
      const escapeRegex = (str) => String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      box = await StockBox.findOne({
        productName: { $regex: `^${escapeRegex(barcode.trim())}$`, $options: 'i' },
        status: 'available',
        isDeleted: { $ne: true }
      });
    }

    if (!box) {
      order.failedScanLogs.push({ barcode: cleanCode, errorReason: 'Product / QR ID not found in inventory.' });
      await order.save();
      return res.json({
        success: false,
        valid: false,
        code: 'BARCODE_NOT_FOUND',
        title: 'Product / QR ID Not Found',
        message: `Product or QR ID '${barcode}' does not exist in inventory or has no available stock.`
      });
    }

    // Check if already dispatched or picked in another order
    if (box.status === 'dispatched') {
      order.failedScanLogs.push({ barcode: cleanCode, errorReason: 'Product already dispatched previously.' });
      await order.save();
      return res.json({
        success: false,
        valid: false,
        code: 'ALREADY_DISPATCHED',
        title: 'Already Dispatched',
        message: `Box ${box.qrId} (${box.productName}) has already been dispatched.`
      });
    }

    // Check if already picked in this order
    const alreadyPicked = order.pickedItems.some(p => p.qrId === box.qrId);
    if (alreadyPicked) {
      return res.json({
        success: true,
        valid: true,
        alreadyPicked: true,
        title: 'Already Picked',
        message: `Box ${box.qrId} (${box.productName}) is already in the picked list for this order.`,
        box
      });
    }

    // Flexible Product Name & Product ID matching against order bill items
    const matchingLine = order.items.find(line => {
      const pNameMatch = line.productName.toLowerCase().trim() === box.productName.toLowerCase().trim();
      const pCodeMatch = line.productCode && box.productCode && line.productCode.toLowerCase().trim() === box.productCode.toLowerCase().trim();

      const lineBatch = (line.batchNumber || '').toLowerCase().trim();
      const boxBatch = (box.batchNumber || '').toLowerCase().trim();

      const batchMatch = !lineBatch || !boxBatch || lineBatch === boxBatch || lineBatch === 'any' || boxBatch === 'any';

      return (pNameMatch || pCodeMatch) && batchMatch;
    });

    if (!matchingLine) {
      order.failedScanLogs.push({
        barcode: cleanCode,
        errorReason: `Product (${box.productName}) not present in order bill.`
      });
      await order.save();
      return res.json({
        success: false,
        valid: false,
        code: 'PRODUCT_MISMATCH',
        title: 'Product Not in Bill Order',
        message: `Product "${box.productName}" (QR: ${box.qrId}) is NOT listed in Order #${order.invoiceNo}!`,
        box
      });
    }

    // Count currently picked for this line
    const currentLinePickedCount = order.pickedItems.filter(p =>
      p.productName.toLowerCase().trim() === matchingLine.productName.toLowerCase().trim()
    ).length;

    if (currentLinePickedCount >= matchingLine.quantity) {
      return res.json({
        success: false,
        valid: false,
        code: 'QUANTITY_EXCEEDED',
        title: 'Quantity Completed',
        message: `Required quantity (${matchingLine.quantity}) for ${matchingLine.productName} is already fully picked!`
      });
    }

    // Add box to picked list
    order.pickedItems.push({
      qrId: box.qrId,
      barcode: box.barcode,
      productName: box.productName,
      batchNumber: box.batchNumber,
      weight: box.weight,
      scannedAt: new Date(),
      scannedBy: req.user?.username || 'Warehouse Worker'
    });

    order.scannedCount = order.pickedItems.length;

    // Check total picked vs required
    const totalRequiredCount = order.items.reduce((acc, item) => acc + item.quantity, 0);
    if (order.pickedItems.length >= totalRequiredCount) {
      order.orderStatus = 'picking_completed';
    }

    await order.save();

    return res.json({
      success: true,
      valid: true,
      title: 'Item Picked Successfully',
      message: `Box ${box.qrId} added to picked list. (${order.pickedItems.length}/${totalRequiredCount} picked)`,
      box,
      totalPicked: order.pickedItems.length,
      totalRequired: totalRequiredCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const completeStockPicking = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.orderStatus = 'picking_completed';
    await order.save();

    await AuditLog.create({
      action: 'STOCK_PICKING_COMPLETED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StockPicking',
      details: `Completed stock picking for Order #${order.invoiceNo} (${order.pickedItems.length} items picked)`
    });

    return res.json({ success: true, message: 'Stock picking completed successfully!', order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 6. DISPATCH VERIFICATION & DELIVERY INVOICE PDF MODULE
// -------------------------------------------------------------
const getVerificationSummary = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const totalRequired = order.items.reduce((acc, item) => acc + item.quantity, 0);
    const totalPicked = order.pickedItems.length;
    const isComplete = totalPicked >= totalRequired;

    return res.json({
      success: true,
      order,
      summary: {
        totalRequired,
        totalPicked,
        isComplete,
        itemsRequired: order.items,
        itemsPicked: order.pickedItems,
        failedScanLogs: order.failedScanLogs
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const generateDeliveryInvoice = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const deliveryInvoiceNo = `DEL-INV-${Date.now().toString().slice(-6)}`;
    order.deliveryInvoiceNo = deliveryInvoiceNo;
    order.orderStatus = 'invoice_generated';
    await order.save();

    await AuditLog.create({
      action: 'DELIVERY_INVOICE_GENERATED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'DeliveryInvoice',
      details: `Generated Delivery Invoice #${deliveryInvoiceNo} for Order #${order.invoiceNo}`
    });

    return res.json({
      success: true,
      message: `Delivery Invoice #${deliveryInvoiceNo} generated successfully!`,
      deliveryInvoiceNo,
      order
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const markOrderSentToDealer = async (req, res) => {
  try {
    const { id } = req.params;
    const { transportName, vehicleNumber, driverName, driverPhone, lrNumber, remarks } = req.body;

    const order = await SalesInvoice.findById(id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.transportName = transportName || 'Direct Transport';
    order.vehicleNumber = vehicleNumber || 'N/A';
    order.driverName = driverName || 'N/A';
    order.driverPhone = driverPhone || 'N/A';
    order.lrNumber = lrNumber || 'N/A';
    order.dispatchedAt = new Date();
    order.orderStatus = 'sent_to_dealer';
    order.status = 'dispatched';
    await order.save();

    // Mark picked boxes as dispatched & create Dispatch record
    const scannedQrIds = order.pickedItems.map(p => p.qrId);
    const dispatchNo = `DSP-${Date.now().toString().slice(-6)}`;

    await Dispatch.create({
      dispatchNo,
      salesInvoiceNo: order.invoiceNo,
      dealerId: order.dealerId._id,
      scannedBoxQrIds,
      courierName: transportName || 'Direct Transport',
      vehicleNumber: vehicleNumber || 'N/A',
      driverName: driverName || 'N/A',
      driverMobile: driverPhone || 'N/A',
      deliveryDate: new Date(),
      remarks: remarks || '',
      verifiedBy: req.user?.username || 'Warehouse Worker',
      status: 'dispatched'
    });

    for (const qrId of scannedQrIds) {
      const box = await StockBox.findOne({ qrId });
      if (box) {
        box.status = 'dispatched';
        box.assignedInvoiceNo = order.invoiceNo;
        box.assignedDealerId = order.dealerId._id;
        box.history.push({
          stage: 'Dispatched',
          title: `Dispatched to Dealer ${order.dealerName}`,
          description: `Transport: ${transportName}, Vehicle: ${vehicleNumber}`,
          performedBy: req.user?.username || 'Warehouse Worker',
          timestamp: new Date()
        });
        await box.save();
      }
    }

    await AuditLog.create({
      action: 'PRODUCTS_SENT_TO_DEALER',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'Dispatch',
      details: `Dispatched products for Order #${order.invoiceNo} via ${transportName}`
    });

    return res.json({
      success: true,
      message: `Order #${order.invoiceNo} marked as Sent to Dealer. Waiting for dealer approval.`,
      order
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 7. DEALER APPROVAL & BILTY TRACKING MODULE
// -------------------------------------------------------------
const getDealerApprovalStatus = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    return res.json({
      success: true,
      order: {
        id: order._id,
        invoiceNo: order.invoiceNo,
        dealerName: order.dealerName,
        orderStatus: order.orderStatus,
        dealerApproved: order.dealerApproved,
        dealerApprovedAt: order.dealerApprovedAt,
        biltyUploaded: order.biltyUploaded,
        biltyUrl: order.biltyUrl,
        biltyUploadedAt: order.biltyUploadedAt,
        dispatchPhotoUrl: order.dispatchPhotoUrl,
        dispatchPhotoUploadedAt: order.dispatchPhotoUploadedAt,
        dealerRemarks: order.dealerRemarks
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 8. USER DASHBOARD & ACTIVITY SUMMARY MODULE
// -------------------------------------------------------------
const getUserDashboardSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayPurchases = await Purchase.countDocuments({ isDeleted: false, createdAt: { $gte: startOfDay } });
    const pendingBarcodeCount = await Purchase.countDocuments({ isDeleted: false, status: 'barcode_pending' });
    const pendingVerificationCount = await StockBox.countDocuments({ isDeleted: false, verificationStatus: 'pending_verification' });
    const newAssignedOrders = await SalesInvoice.countDocuments({ orderStatus: { $in: ['new', 'viewed'] } });
    const pickingInProgressCount = await SalesInvoice.countDocuments({ orderStatus: 'picking_started' });
    const pendingDealerApprovalCount = await SalesInvoice.countDocuments({ orderStatus: 'sent_to_dealer' });
    const completedTodayCount = await SalesInvoice.countDocuments({ orderStatus: 'completed', createdAt: { $gte: startOfDay } });

    return res.json({
      success: true,
      metrics: {
        todayPurchases,
        pendingBarcodeCount,
        pendingVerificationCount,
        newAssignedOrders,
        pickingInProgressCount,
        pendingDealerApprovalCount,
        completedTodayCount
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPurchases,
  createPurchase,
  getPurchaseById,
  finalizePurchaseSubmit,
  generatePurchaseQrCodes,
  recordStickerPrint,
  getStockBoxes,
  verifyInitialStockScan,
  getAssignedOrders,
  getOrderById,
  startStockPicking,
  scanPickingItem,
  completeStockPicking,
  getVerificationSummary,
  generateDeliveryInvoice,
  markOrderSentToDealer,
  getDealerApprovalStatus,
  getUserDashboardSummary
};
