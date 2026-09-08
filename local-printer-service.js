const http = require('http');
const { spawn } = require('child_process');

const PORT = 9191;
const PRINTER_NAME = 'TE244';

function buildTSPLForPair(leftBox, rightBox) {
  let cmd = `SIZE 105 mm, 25 mm\nGAP 2 mm, 0 mm\nDIRECTION 1\nSPEED 2\nDENSITY 12\nCLS\n`;

  // Left Label
  if (leftBox) {
    const pName = (leftBox.productName || 'PRODUCT').substring(0, 14);
    const batch = (leftBox.batchNumber || '').substring(0, 12);
    const wt = (leftBox.weight || leftBox.packing || '1 kg').substring(0, 14);
    const qr = leftBox.qrId || 'VNK-00';

    cmd += `TEXT 20,12,"2",0,1,1,"VANIKI CROP SCIENCE"\n`;
    cmd += `BAR 20,35,360,2\n`;
    cmd += `TEXT 20,48,"3",0,1,1,"${pName}"\n`;
    cmd += `TEXT 20,82,"2",0,1,1,"Batch: ${batch}"\n`;
    cmd += `TEXT 20,112,"2",0,1,1,"Wt: ${wt}"\n`;
    cmd += `TEXT 20,146,"3",0,1,1,"ID: ${qr}"\n`;
    cmd += `QRCODE 260,48,M,5,A,0,M2,S7,"${qr}"\n`;
  }

  // Right Label (Offset +430 dots)
  if (rightBox) {
    const pName = (rightBox.productName || 'PRODUCT').substring(0, 14);
    const batch = (rightBox.batchNumber || '').substring(0, 12);
    const wt = (rightBox.weight || rightBox.packing || '1 kg').substring(0, 14);
    const qr = rightBox.qrId || 'VNK-00';

    cmd += `TEXT 450,12,"2",0,1,1,"VANIKI CROP SCIENCE"\n`;
    cmd += `BAR 450,35,360,2\n`;
    cmd += `TEXT 450,48,"3",0,1,1,"${pName}"\n`;
    cmd += `TEXT 450,82,"2",0,1,1,"Batch: ${batch}"\n`;
    cmd += `TEXT 450,112,"2",0,1,1,"Wt: ${wt}"\n`;
    cmd += `TEXT 450,146,"3",0,1,1,"ID: ${qr}"\n`;
    cmd += `QRCODE 690,48,M,5,A,0,M2,S7,"${qr}"\n`;
  }

  cmd += `PRINT 1,1\n`;
  return cmd;
}

function printTSPL(tsplData) {
  return new Promise((resolve, reject) => {
    const child = spawn('lp', ['-d', PRINTER_NAME, '-o', 'raw']);
    child.stdin.write(tsplData);
    child.stdin.end();

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`lp exited with code ${code}`));
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS & Chrome Private Network Access headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/status' || url.pathname === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, printer: PRINTER_NAME, status: 'ready', roll: '2-Across 50x25mm' }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/print-boxes') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const boxes = data.boxes || [];

        if (boxes.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'No boxes provided' }));
          return;
        }

        // Pair boxes into 2-Across rows
        let fullTSPL = '';
        for (let i = 0; i < boxes.length; i += 2) {
          fullTSPL += buildTSPLForPair(boxes[i], boxes[i + 1] || null);
        }

        await printTSPL(fullTSPL);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: boxes.length, message: `Successfully sent ${boxes.length} stickers to ${PRINTER_NAME}` }));
      } catch (err) {
        console.error('Print error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vaniki TSC TE244 Print Service listening on http://127.0.0.1:${PORT}`);
});
