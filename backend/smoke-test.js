/**
 * End-to-end smoke test for the warehouse API.
 * Usage: API=http://localhost:5060/api node smoke-test.js
 * Run it against a scratch database - it creates real records.
 */
const assert = require('assert');

const API = process.env.API || `http://localhost:${process.env.PORT || 5060}/api`;
let token = '';

const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
};

const step = async (name, fn) => {
  const out = await fn();
  console.log(`  ok  ${name}`);
  return out;
};

(async () => {
  console.log(`Smoke testing ${API}`);

  await step('health reports a connected database', async () => {
    const r = await call('GET', '/health');
    assert.strictEqual(r.body.database, 'connected');
  });

  await step('protected route rejects a missing token', async () => {
    const r = await call('GET', '/stock');
    assert.strictEqual(r.status, 401);
  });

  await step('protected route rejects a garbage token', async () => {
    token = 'mobile_wms_session_token';
    const r = await call('GET', '/user/dashboard-summary');
    token = '';
    assert.strictEqual(r.status, 401, 'a bogus token must not be accepted');
  });

  await step('login rejects a wrong password', async () => {
    const r = await call('POST', '/auth/login', { username: 'admin', password: 'nope' });
    assert.strictEqual(r.status, 401);
  });

  await step('login issues a token', async () => {
    const r = await call('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    assert.strictEqual(r.body.user.role, 'admin');
    token = r.body.token;
  });

  await step('the token survives a round trip through /auth/me', async () => {
    const r = await call('GET', '/auth/me');
    assert.strictEqual(r.body.user.username, 'admin');
  });

  const stamp = Date.now();
  const purchase = await step('purchase entry is created', async () => {
    const r = await call('POST', '/user/purchases', {
      invoiceNumber: `SMOKE-${stamp}`,
      manufacturer: 'Smoke Chemicals Ltd',
      productName: 'Smoke Test Fungicide',
      batchNumber: `B-${stamp}`,
      quantity: 3,
      packingSize: '1 kg'
    });
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    return r.body.purchase;
  });

  const boxes = await step('three unique QR boxes are generated', async () => {
    const r = await call('POST', `/user/purchases/${purchase._id}/generate-codes`);
    assert.strictEqual(r.body.boxes.length, 3, JSON.stringify(r.body));
    assert.strictEqual(new Set(r.body.boxes.map(b => b.qrId)).size, 3, 'QR ids must be unique');
    return r.body.boxes;
  });

  await step('scanning a box marks it verified and available', async () => {
    const r = await call('POST', '/user/stock/verify-scan', { barcode: boxes[0].qrId });
    assert.strictEqual(r.body.verified, true, JSON.stringify(r.body));
    assert.strictEqual(r.body.box.status, 'available');
  });

  await step('scanning an unknown barcode fails cleanly', async () => {
    const r = await call('POST', '/user/stock/verify-scan', { barcode: 'VNK-DOES-NOT-EXIST' });
    assert.strictEqual(r.body.verified, false);
    assert.strictEqual(r.body.code, 'BARCODE_NOT_FOUND');
  });

  const dealer = await step('dealer is created', async () => {
    const r = await call('POST', '/dealers', {
      dealerName: `Smoke Dealer ${stamp}`,
      garageName: 'Smoke Garage',
      phone: '9999999999',
      address: '1 Test Road',
      state: 'Gujarat',
      district: 'Test',
      city: 'Testville',
      pincode: '380001'
    });
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    return r.body.dealer;
  });

  const order = await step('sales invoice is created', async () => {
    const r = await call('POST', '/invoices', {
      invoiceNo: `SI-${stamp}`,
      dealerId: dealer._id,
      items: [{ productName: 'Smoke Test Fungicide', batchNumber: `B-${stamp}`, quantity: 2 }]
    });
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    return r.body.salesInvoice;
  });

  await step('picking accepts the two ordered boxes', async () => {
    await call('POST', `/user/orders/${order._id}/start-picking`);
    for (const box of boxes.slice(0, 2)) {
      const r = await call('POST', `/user/orders/${order._id}/scan-item`, { barcode: box.qrId });
      assert.strictEqual(r.body.valid, true, JSON.stringify(r.body));
    }
  });

  await step('picking refuses a third box beyond the ordered quantity', async () => {
    const r = await call('POST', `/user/orders/${order._id}/scan-item`, { barcode: boxes[2].qrId });
    assert.strictEqual(r.body.valid, false);
    assert.strictEqual(r.body.code, 'QUANTITY_EXCEEDED', JSON.stringify(r.body));
  });

  await step('order is marked sent to dealer (regression: used to 500)', async () => {
    const r = await call('POST', `/user/orders/${order._id}/mark-sent`, {
      transportName: 'Smoke Transport',
      vehicleNumber: 'GJ-01-AA-1111',
      driverName: 'Test Driver',
      driverPhone: '8888888888'
    });
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    assert.strictEqual(r.body.order.orderStatus, 'sent_to_dealer');
  });

  await step('dispatched boxes are no longer available', async () => {
    const r = await call('GET', `/stock/qr/${boxes[0].qrId}`);
    assert.strictEqual(r.body.box.status, 'dispatched', JSON.stringify(r.body.box.status));
  });

  const dispatch = await step('dispatch record exists for the order', async () => {
    const r = await call('GET', '/dispatches');
    const d = r.body.dispatches.find(x => x.salesInvoiceNo === order.invoiceNo);
    assert.ok(d, 'dispatch record was not created');
    return d;
  });

  await step('cancelling a dispatch restores its boxes (regression: enum used to reject)', async () => {
    const r = await call('POST', `/dispatches/${dispatch._id}/cancel`);
    assert.strictEqual(r.body.success, true, JSON.stringify(r.body));
    const box = await call('GET', `/stock/qr/${boxes[0].qrId}`);
    assert.strictEqual(box.body.box.status, 'available');
  });

  await step('a non-admin cannot reach admin routes', async () => {
    const adminToken = token;
    const login = await call('POST', '/auth/login', { username: 'worker', password: 'worker123' });
    token = login.body.token;
    const r = await call('GET', '/admin/users');
    token = adminToken;
    assert.strictEqual(r.status, 403, `expected 403, got ${r.status}`);
  });

  console.log('\nAll smoke tests passed.');
})().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err.message);
  process.exit(1);
});
