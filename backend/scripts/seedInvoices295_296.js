const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warehouse_db';

const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const Product = require('../models/Product');

async function seedInvoices295And296() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

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

  // Helper function to upsert an invoice and remove any duplicates
  async function upsertInvoice(invoiceNo, data) {
    console.log(`\n=== Upserting Invoice #${invoiceNo} ===`);
    const existing = await SalesInvoice.find({ invoiceNo });
    if (existing.length > 1) {
      console.log(`Found ${existing.length} records for invoice #${invoiceNo}. Removing duplicates...`);
      for (let i = 1; i < existing.length; i++) {
        await SalesInvoice.deleteOne({ _id: existing[i]._id });
      }
    }

    const saved = await SalesInvoice.findOneAndUpdate(
      { invoiceNo },
      { $set: data },
      { upsert: true, new: true, runValidators: false }
    );
    console.log(`Invoice #${saved.invoiceNo} successfully updated/inserted:`);
    console.log(`  - Dealer: ${saved.dealerName}`);
    console.log(`  - Total Amount: ₹${saved.totalAmount}`);
    console.log(`  - Destination: ${saved.destination}`);
    console.log(`  - Dispatch: ${saved.despatchedThrough}`);
    console.log(`  - Items Count: ${saved.items.length}`);
    return saved;
  }

  // ==========================================
  // INVOICE #295 (14 Peti, ₹45,524.00)
  // ==========================================
  await upsertInvoice('295', {
    invoiceNo: '295',
    orderId: 'ORD-295001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-08T00:00:00.000Z'),
    destination: 'BORI',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 38580.00,
    totalTaxAmount: 6944.40,
    totalAmount: 45524.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'PAJERO 1LTR',
        batchNumber: 'SNG-PAJ001',
        quantity: 20, // 2 cases x 10 = 20 pcs (20 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 840.00,
        taxRate: 18,
        total: 16800.00
      },
      {
        productName: 'VALID 1LTR/40100030',
        batchNumber: 'VNK-VLD-002',
        quantity: 100, // 10 cases x 10 = 100 pcs (100 LTR)
        weight: '1 LTR',
        hsnCode: '38089910',
        price: 179.00,
        taxRate: 18,
        total: 17900.00
      },
      {
        productName: 'VALID 250ML/40025031',
        batchNumber: 'VNK-VLD-001',
        quantity: 80, // 2 cases x 40 = 80 pcs (20 LTR)
        weight: '250 ML',
        hsnCode: '38089910',
        price: 48.50, // 194.00 / 4 (per 250ml pc)
        taxRate: 18,
        total: 3880.00
      }
    ]
  });

  // ==========================================
  // INVOICE #296 (9 Peti, ₹44,949.00)
  // ==========================================
  await upsertInvoice('296', {
    invoiceNo: '296',
    orderId: 'ORD-296001',
    dealerId: dealer._id,
    dealerName: 'TAMRAKAR AGROTECH BORI (4)',
    garageName: 'TAMRAKAR AGROTECH BORI (4)',
    dealerAddress: 'BAZAR CHOWK BORI',
    dealerPhone: '9406161233',
    dealerGst: '22ANYPT1907C1ZX',
    invoiceDate: new Date('2026-10-08T00:00:00.000Z'),
    destination: 'CG07BH3555',
    vehicleNumber: 'CG07BH3555',
    despatchedThrough: 'SELF VEHICLE',
    subtotal: 38092.00,
    totalTaxAmount: 6856.56,
    totalAmount: 44949.00,
    source: 'warehouse',
    assignedToUser: 'warehouse1',
    orderStatus: 'new',
    status: 'pending',
    items: [
      {
        productName: 'VALID 500ML/40050032',
        batchNumber: 'VNK-VLD-002',
        quantity: 100, // 5 cases x 20 = 100 pcs (50 LTR)
        weight: '500 ML',
        hsnCode: '38089910',
        price: 97.00, // 194.00 / 2 (per 500ml pc)
        taxRate: 18,
        total: 9700.00
      },
      {
        productName: 'VIGEN 300ML/10030078',
        batchNumber: 'VN-VTG01',
        quantity: 80, // 4 cases x 20 = 80 pcs (24 LTR)
        weight: '300 ML',
        hsnCode: '38089910',
        price: 354.90, // 1183.00 * 0.3 (per 300ml pc)
        taxRate: 18,
        total: 28392.00
      }
    ]
  });

  console.log('\n=============================================');
  console.log('BOTH INVOICES (295, 296) SEEDED SUCCESSFULLY!');
  console.log('=============================================');
  await mongoose.disconnect();
}

seedInvoices295And296().catch(err => {
  console.error('Error seeding invoices:', err);
  process.exit(1);
});
