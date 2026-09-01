const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vaniki_stock_trace';
    const conn = await mongoose.connect(connStr);
    console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB Error] Failed to connect: ${error.message}`);
    console.log(`[MongoDB Info] Server running. Please make sure MongoDB is running locally on mongodb://127.0.0.1:27017`);
  }
};

module.exports = connectDB;
