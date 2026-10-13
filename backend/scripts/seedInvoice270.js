const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');

async function seedInvoice270() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected.');

  // Find Dealer TAMRAKAR AGROTECH
  let dealer = await Dealer.findOne({
    $or: [
      { dealerName: /TAMRAKAR AGROTECH/i },
      { phone: '9406161233' },
      { phone: '9826123456' }
    ]
  });

  if (!dealer) {
    dealer = await Dealer.create({
      dealerName: 'TAMRAKAR AGROTECH BORI (4)',
      garageName: 'TAMRAKAR AGROTECH BORI (4)',
      ownerName: 'TAMRAKAR',
      gstNumber: '22ANYPT1907C1ZX',
      phone: '9406161233',
      email: 'mohanishtamrakar5@gmail.com',
      address: 'BAZAR CHOWK BORI',
      state: 'Chhattisgarh',
      district: 'Durg',
      city: 'Bori',
      pincode: '491001'
    });
    console.log('[DEALER CREATED]:', dealer.dealerName);
  } else {
    console.log('[DEALER FOUND]:', dealer.dealerName, dealer._id);
  }

  const invoiceData = {
    invoiceNo: '270',
    orderId: `ORD-${Date.now().toString().slice(-6)}`,
    dealerId: dealer._id,
    dealerName: dealer.dealerName || 'TAMRAKAR AGROTECH BORI (4)',
    garageName: dealer.garageName || 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: dealer.address || 'BAZAR CHOWK BORI',
    dealerPhone: dealer.phone || '9406161233',
    dealerGst: dealer.gstNumber || '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
    destination: 'DURG',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 29636.80,
    totalTaxAmount: 5334.62,
    totalAmount: 34971.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'MATIX 266.4GM/10026003',
        batchNumber: 'VNK-MTX-001',
        quantity: 40, // 2 cases of 20 = 40 pieces (10.66 KGS)
        weight: '266 GM',
        hsnCode: '38089910',
        price: 1550,
        taxRate: 18,
        total: 16516.80
      },
      {
        productName: 'PAROLI 1LTR/20100008',
        batchNumber: 'VNK-PAR-001',
        quantity: 20, // 2 cases of 10 = 20 pieces (20.00 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 656,
        taxRate: 18,
        total: 13120.00
      }
    ]
  };

  const existingInvoice = await SalesInvoice.findOne({ invoiceNo: '270' });
  let savedInvoice;
  if (existingInvoice) {
    Object.assign(existingInvoice, invoiceData);
    savedInvoice = await existingInvoice.save();
    console.log('[INVOICE UPDATED]: Invoice #270 updated with both items successfully.');
  } else {
    savedInvoice = await SalesInvoice.create(invoiceData);
    console.log('[INVOICE CREATED]: Invoice #270 created successfully.');
  }

  console.log('Invoice Summary:');
  console.log(' - Invoice No:', savedInvoice.invoiceNo);
  console.log(' - Dealer:', savedInvoice.dealerName);
  console.log(' - Destination:', savedInvoice.destination);
  console.log(' - Total Amount: ₹' + savedInvoice.totalAmount);
  console.log(' - Items:');
  savedInvoice.items.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.productName} (Batch: ${item.batchNumber}) - Qty: ${item.quantity} Pcs, Weight: ${item.weight}`);
  });

  process.exit(0);
}

seedInvoice270().catch(err => {
  console.error('Error seeding invoice 270:', err);
  process.exit(1);
});
