# Warehouse Inventory & Barcode/QR Tracking System (Vaniki Stock Trace)

A complete, full-stack inventory management, stock verification, and barcode/QR code tracking solution. This repository contains a **Node.js/Express Backend API**, a **React (Vite) Web Application**, and an **Expo React Native Mobile App**.

---

## 🏗️ Architecture & Components

```
warehouse/
├── backend/           # Node.js & Express REST API, MongoDB Mongoose Models, JWT Auth, PDF/QR Generators
├── frontend-web/      # React 18 + Vite Web Dashboard (Admin Panel, Dealer Portal, Barcode Printing, Analytics)
└── mobile-app/        # Expo React Native App (Live Camera Barcode/QR Scanner, Stock Verification, Verification History)
```

---

## ✨ Features

### 🏢 Web Dashboard (`frontend-web`)
- **Admin Panel**: Manage warehouse stock, items, dealers, and movement history.
- **Barcode & QR Generator**: Create and print scannable barcode and QR code stickers for products.
- **Stock Tracking & Verification**: Live status updates (Verified, Pending, In Transit, Flagged).
- **Analytics & History**: Comprehensive product history logs and inventory reports using Recharts.

### 📱 Mobile App (`mobile-app`)
- **Camera QR/Barcode Scanner**: Instant scanning via `expo-camera` / `expo-barcode-scanner`.
- **Real-Time Stock Verification**: Verify inventory items directly on the warehouse floor.
- **Scan Logs**: View recent scans, item details, and status indicators.

### ⚙️ Backend API (`backend`)
- **Authentication**: JWT-based secure authentication and role middleware (Admin, Worker, Dealer).
- **Database**: MongoDB integration via Mongoose schemas for items, stock logs, users, and dealers.
- **PDF & QR Engine**: Backend PDF label generation (`pdfkit`) and QR code rendering (`qrcode`).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas Connection URI

---

### 1. Backend Setup

```bash
cd backend
npm install
```

Configure your environment variables by creating a `.env` file in `backend/`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/warehouse_db
JWT_SECRET=your_jwt_secret_key
```

Start the backend server:
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

---

### 2. Web Frontend Setup

```bash
cd frontend-web
npm install
```

Start the web application:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

To build for production:
```bash
npm run build
```

---

### 3. Mobile App Setup

```bash
cd mobile-app
npm install
```

Start the Expo development server:
```bash
npm start
```
Scan the QR code with **Expo Go** (Android / iOS) or run on an emulator (`npm run android` / `npm run ios`).

---

## 🛠️ Tech Stack

- **Frontend Web**: React 18, Vite, Tailwind CSS, Lucide React, Recharts, React Router
- **Mobile**: React Native, Expo, Expo Camera, React Navigation
- **Backend**: Node.js, Express.js, MongoDB / Mongoose, JWT, BcryptJS, PDFKit, QR Code
- **Deployment**: Vite build artifact, Expo EAS bundle

---

## 📜 License

This project is licensed under the MIT License.
