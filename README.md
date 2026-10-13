# Vaniki Stock Trace - Warehouse Inventory & QR Tracking

Full-stack warehouse management for goods inward, per-box QR identity, stock picking
against dealer bills, dispatch verification and delivery statements.

```
warehouse/
├── backend/                # Node/Express REST API, MongoDB (Mongoose), JWT auth, PDF + QR generation
├── frontend-web/           # React 18 + Vite admin/worker dashboard
├── mobile-app/             # Expo React Native scanner app
└── local-printer-service.js  # Optional local bridge for direct TSPL printing to a TSC TE244
```

## Architecture

```
backend/
├── server.js               # App wiring; listens only after MongoDB connects
├── config/db.js            # Connection + pool settings
├── middleware/
│   ├── auth.js             # JWT verification (401 on missing/expired/invalid) and token signing
│   ├── rbac.js             # Role gating: 'admin' vs. everyone else
│   └── errorHandler.js     # 404 + central error responder
├── models/                 # Mongoose schemas with query indexes
├── controllers/            # Request handling per domain
├── routes/                 # Route tables; auth and role gating declared here
└── smoke-test.js           # End-to-end API check
```

### Roles

Two effective roles. `admin` gets everything; every other role (`user`, `warehouse`,
`sales`, `manager`) is treated as warehouse staff.

| Area | Staff | Admin |
| --- | --- | --- |
| Login, dashboards, stock lookup, product history | yes | yes |
| Purchase entry, QR generation, sticker printing | yes | yes |
| Stock picking, dispatch scan-verify, delivery statements | yes | yes |
| Product / dealer / sales-invoice master data changes | no | yes |
| Deleting stock, dispatch approve or cancel | no | yes |
| User management, settings, audit log, backup/restore | no | yes |

Every `/api` route except `POST /api/auth/login` and `GET /api/health` requires a
valid bearer token.

## Getting started

Prerequisites: Node 18+, npm 9+, and MongoDB (local or Atlas).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET
npm run dev               # or: npm start
```

The server refuses to start if MongoDB is unreachable, so a failed boot is a
configuration problem, not a silent runtime failure. Health check:
`http://localhost:5060/api/health`.

Seeded accounts on first run (change these passwords immediately):

| Username | Password | Role |
| --- | --- | --- |
| admin | admin123 | admin |
| worker | worker123 | staff |

Run the end-to-end API check against a scratch database:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/wms_smoke PORT=5199 npm start &
API=http://localhost:5199/api npm run smoke
```

### 2. Web dashboard

```bash
cd frontend-web
npm install
npm run dev               # http://localhost:3000
```

Dev requests to `/api` are proxied to `http://localhost:5060`. Override with
`VITE_API_PROXY`, or point the built app at an absolute API with `VITE_API_URL`.

```bash
npm run build             # production build into dist/
```

### 3. Mobile scanner app

```bash
cd mobile-app
npm install
npm start                 # Expo Go, or npm run android / npm run ios
```

The API base URL defaults to the production host and can be overridden with
`EXPO_PUBLIC_API_URL`. The session (token plus cached user) is stored in
AsyncStorage, so the app stays logged in across restarts and only returns to the
login screen when the server rejects the token.

## Tech stack

- **Backend**: Node.js, Express, MongoDB/Mongoose, JWT, bcryptjs, PDFKit, qrcode, compression
- **Web**: React 18, Vite, Tailwind CSS, React Router, lucide-react, html5-qrcode (loaded on demand)
- **Mobile**: React Native, Expo, expo-camera, React Navigation, AsyncStorage

## License

MIT
