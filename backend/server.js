require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const stockRoutes = require('./routes/stockRoutes');
const dealerRoutes = require('./routes/dealerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const userWarehouseRoutes = require('./routes/userWarehouseRoutes');
const searchRoutes = require('./routes/searchRoutes');
const { seedUsers } = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 5060;

// Connect Database & Seed default accounts
connectDB().then(() => {
  seedUsers().catch(err => console.error('Seed error:', err));
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userWarehouseRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/search', searchRoutes);




// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    application: 'Vaniki Stock Trace - Warehouse WMS API',
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Vaniki Stock Trace API Server running on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
