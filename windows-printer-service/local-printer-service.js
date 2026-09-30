const http = require('http');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 9191;
const CONFIG_PRINTER = process.env.PRINTER_NAME || 'TE244';
const IS_WIN = process.platform === 'win32';
const LOG_FILE = path.join(__dirname, 'service.log');

// Real-time logger: writes to console and appends to service.log
function log(message, level = 'INFO') {
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${dateStr}] [${level}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\r\n', 'utf8');
  } catch (e) {}
}

// Global error protection: ensure process NEVER crashes or exits unexpectedly
process.on('uncaughtException', (err) => {
  log(`[UNCAUGHT EXCEPTION] ${err.stack || err.message}`, 'ERROR');
});
process.on('unhandledRejection', (reason) => {
  log(`[UNHANDLED REJECTION] ${reason}`, 'ERROR');
});

const cachedDetectedPrinter = CONFIG_PRINTER;

function detectWindowsPrinter() {
  return cachedDetectedPrinter;
}

function getPetiWeight(box) {
  if (!box) return '10 LTR';
  if (box.petiWeight) return box.petiWeight;
  if (box.caseWtStr) return box.caseWtStr;

  // Calculate from packing and conversion if present
  const packing = box.packing || '';
  const conv = Number(box.conversion) || 0;
  if (packing && conv > 0) {
    const m = packing.match(/([\d.]+)\s*(ML|LTR|L|GM|G|KG)/i);
    if (m) {
      const val = parseFloat(m[1]);
      const unit = m[2].toUpperCase();
      if (unit === 'ML') {
        const total = (val * conv) / 1000;
        return `${Number(total.toFixed(2))} LTR`;
      } else if (unit === 'LTR' || unit === 'L') {
        return `${Number((val * conv).toFixed(2))} LTR`;
      } else if (unit === 'GM' || unit === 'G') {
        const total = (val * conv) / 1000;
        return `${Number(total.toFixed(2))} KG`;
      } else if (unit === 'KG') {
        return `${Number((val * conv).toFixed(2))} KG`;
      }
    }
  }

  if (box.weight && !box.weight.toUpperCase().includes('KGS') && !box.weight.includes('30.000')) {
    return box.weight;
  }
  return box.packing || '10 LTR';
}

function splitProductName(name, maxLen = 16) {
  if (!name) return { line1: 'PRODUCT', line2: '' };
  const clean = name.replace(/["\\]/g, '').trim();
  if (clean.length <= maxLen) {
    return { line1: clean, line2: '' };
  }

  let splitIdx = -1;
  const searchLen = Math.min(clean.length - 1, maxLen);
  for (let i = searchLen; i >= 6; i--) {
    const ch = clean[i];
    if (ch === ' ' || ch === '/' || ch === '-' || ch === '(') {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx > 0) {
    const line1 = clean.substring(0, splitIdx).trim();
    const rem = clean.substring(splitIdx).trim();
    const line2 = rem.substring(0, Math.min(maxLen, rem.length));
    return { line1, line2 };
  }

  const line1 = clean.substring(0, maxLen);
  const rem = clean.substring(maxLen).trim();
  const line2 = rem.substring(0, Math.min(maxLen, rem.length));
  return { line1, line2 };
}

// Build 2-Across 50x25mm Label TSPL
function buildTSPLForPair(leftBox, rightBox) {
  let cmd = `SIZE 105 mm, 25 mm\nGAP 2 mm, 0 mm\nDIRECTION 1\nSPEED 2\nDENSITY 12\nCLS\n`;

  // Left Label
  if (leftBox) {
    const { line1, line2 } = splitProductName(leftBox.productName, 16);
    const batch = (leftBox.batchNumber || '').replace(/["\\]/g, '').trim().substring(0, 14);
    let wt = leftBox.petiWeight || leftBox.caseWtStr || getPetiWeight(leftBox);
    if (leftBox.petiTag && !wt.includes('(')) {
      wt = `${wt}${leftBox.petiTag}`;
    }
    wt = wt.replace(/["\\]/g, '').trim().substring(0, 16);
    const qr = leftBox.qrId || 'VNK-00';

    cmd += `TEXT 20,8,"2",0,1,1,"VANIKI CROP SCIENCE"\n`;
    cmd += `BAR 20,28,360,2\n`;

    if (line2) {
      cmd += `TEXT 20,36,"2",0,1,1,"${line1}"\n`;
      cmd += `TEXT 20,62,"2",0,1,1,"${line2}"\n`;
      cmd += `TEXT 20,92,"2",0,1,1,"BA: ${batch}"\n`;
      cmd += `TEXT 20,122,"2",0,1,1,"Wt: ${wt}"\n`;
      cmd += `TEXT 20,152,"2",0,1,1,"ID: ${qr}"\n`;
    } else {
      cmd += `TEXT 20,40,"2",0,1,1,"${line1}"\n`;
      cmd += `TEXT 20,72,"2",0,1,1,"BA: ${batch}"\n`;
      cmd += `TEXT 20,104,"2",0,1,1,"Wt: ${wt}"\n`;
      cmd += `TEXT 20,136,"2",0,1,1,"ID: ${qr}"\n`;
    }
    cmd += `QRCODE 260,36,M,5,A,0,M2,S7,"${qr}"\n`;
  }

  // Right Label (Offset +430 dots)
  if (rightBox) {
    const { line1, line2 } = splitProductName(rightBox.productName, 16);
    const batch = (rightBox.batchNumber || '').replace(/["\\]/g, '').trim().substring(0, 14);
    let wt = rightBox.petiWeight || rightBox.caseWtStr || getPetiWeight(rightBox);
    if (rightBox.petiTag && !wt.includes('(')) {
      wt = `${wt}${rightBox.petiTag}`;
    }
    wt = wt.replace(/["\\]/g, '').trim().substring(0, 16);
    const qr = rightBox.qrId || 'VNK-00';

    cmd += `TEXT 450,8,"2",0,1,1,"VANIKI CROP SCIENCE"\n`;
    cmd += `BAR 450,28,360,2\n`;

    if (line2) {
      cmd += `TEXT 450,36,"2",0,1,1,"${line1}"\n`;
      cmd += `TEXT 450,62,"2",0,1,1,"${line2}"\n`;
      cmd += `TEXT 450,92,"2",0,1,1,"BA: ${batch}"\n`;
      cmd += `TEXT 450,122,"2",0,1,1,"Wt: ${wt}"\n`;
      cmd += `TEXT 450,152,"2",0,1,1,"ID: ${qr}"\n`;
    } else {
      cmd += `TEXT 450,40,"2",0,1,1,"${line1}"\n`;
      cmd += `TEXT 450,72,"2",0,1,1,"BA: ${batch}"\n`;
      cmd += `TEXT 450,104,"2",0,1,1,"Wt: ${wt}"\n`;
      cmd += `TEXT 450,136,"2",0,1,1,"ID: ${qr}"\n`;
    }
    cmd += `QRCODE 690,36,M,5,A,0,M2,S7,"${qr}"\n`;
  }

  cmd += `PRINT 1,1\n`;
  return cmd;
}

// Send TSPL raw bytes to printer (Cross-Platform)
function printTSPL(tsplData) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `vaniki_print_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
    fs.writeFileSync(tempPath, tsplData, 'utf8');

    const psScript = path.join(__dirname, 'raw-print.ps1');
    const fallbackScript = path.join(__dirname, 'windows-printer-service', 'raw-print.ps1');
    const targetScript = fs.existsSync(psScript) ? psScript : fallbackScript;

    if (IS_WIN) {
      log(`[PRINT DISPATCH] Transmitting to printer '${CONFIG_PRINTER}' via raw-print.ps1...`);
      const args = [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', targetScript,
        '-PrinterName', CONFIG_PRINTER,
        '-FilePath', tempPath,
        '-LogFile', LOG_FILE
      ];
      const child = spawn('powershell.exe', args, { windowsHide: true });
      let stderr = '';
      let stdout = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('close', code => {
        try { fs.unlinkSync(tempPath); } catch (e) {}
        if (code === 0) {
          log(`[PRINT SUCCESS] Sent successfully to printer!`);
          resolve({ printer: CONFIG_PRINTER, stdout });
        } else {
          log(`[PRINT WARN] Print exited code ${code}: ${stderr || stdout}`, 'WARN');
          reject(new Error(stderr || stdout || `Print failed with exit code ${code}`));
        }
      });
      child.on('error', err => {
        try { fs.unlinkSync(tempPath); } catch (e) {}
        log(`[PRINT ERROR] Failed to spawn PowerShell: ${err.message}`, 'ERROR');
        reject(err);
      });
    } else {
      const child = spawn('lp', ['-d', CONFIG_PRINTER, '-o', 'raw']);
      child.stdin.write(tsplData);
      child.stdin.end();
      child.on('close', code => {
        try { fs.unlinkSync(tempPath); } catch (e) {}
        if (code === 0) resolve({ printer: CONFIG_PRINTER });
        else reject(new Error(`lp exited code ${code}`));
      });
      child.on('error', err => {
        try { fs.unlinkSync(tempPath); } catch (e) {}
        reject(err);
      });
    }
  });
}

function sendJsonResponse(res, statusCode, body, origin) {
  const allowedOrigin = origin || '*';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '*';

  // CORS & Chrome Private Network Access (PNA) preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health / Status check (instant response from cached detection)
  if (req.method === 'GET' && (url.pathname === '/status' || url.pathname === '/health')) {
    const activePrinter = detectWindowsPrinter();
    sendJsonResponse(res, 200, {
      success: true,
      connected: true,
      printer: activePrinter || 'TE244',
      detectedPrinter: activePrinter,
      configPrinter: CONFIG_PRINTER,
      platform: process.platform,
      status: 'ready',
      roll: '2-Across 50x25mm'
    }, origin);
    return;
  }

  // Quick Test Print via browser GET /test-print
  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/test-print') {
    log(`[HTTP API] Received /test-print request from ${req.socket.remoteAddress}`);
    try {
      const testTSPL = buildTSPLForPair(
        { productName: 'TEST STICKER L', batchNumber: 'B-TEST01', weight: '500ml', qrId: 'VNK-TEST-01' },
        { productName: 'TEST STICKER R', batchNumber: 'B-TEST02', weight: '500ml', qrId: 'VNK-TEST-02' }
      );
      const result = await printTSPL(testTSPL);
      sendJsonResponse(res, 200, {
        success: true,
        message: `Test sticker sent successfully to printer: ${result.printer}`,
        result
      }, origin);
    } catch (err) {
      log(`[HTTP API ERROR] /test-print failed: ${err.message}`, 'ERROR');
      sendJsonResponse(res, 500, { success: false, error: err.message }, origin);
    }
    return;
  }

  // Tally Local Proxy (queries Tally running on localhost:9000 or 192.168.1.43:9000)
  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/tally-status') {
    const tallyCandidates = ['http://127.0.0.1:9000', 'http://192.168.1.43:9000', 'http://localhost:9000'];
    let found = null;

    for (const host of tallyCandidates) {
      try {
        const testXml = '<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>';
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 2500);
        const r = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: testXml,
          signal: controller.signal
        });
        clearTimeout(tId);
        if (r.ok) {
          const txt = await r.text();
          found = { host, online: true, preview: txt.slice(0, 200) };
          break;
        }
      } catch (e) {}
    }

    sendJsonResponse(res, 200, {
      success: !!found,
      online: !!found,
      activeHost: found ? found.host : null,
      candidates: tallyCandidates
    }, origin);
    return;
  }

  // Proxy arbitrary XML requests to local Tally instance
  if (req.method === 'POST' && url.pathname === '/tally-proxy') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const targetHost = url.searchParams.get('host') || 'http://192.168.1.43:9000';
        log(`[TALLY PROXY] Forwarding XML to ${targetHost}`);
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 15000);
        const tRes = await fetch(targetHost, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml;charset=utf-8' },
          body,
          signal: controller.signal
        });
        clearTimeout(tId);
        const xmlText = await tRes.text();
        res.writeHead(200, {
          'Content-Type': 'text/xml;charset=utf-8',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Private-Network': 'true'
        });
        res.end(xmlText);
      } catch (err) {
        log(`[TALLY PROXY ERROR] ${err.message}`, 'ERROR');
        sendJsonResponse(res, 502, { success: false, error: err.message }, origin);
      }
    });
    return;
  }

  // Main sticker printing endpoint called by web app
  if (req.method === 'POST' && url.pathname === '/print-boxes') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const boxes = data.boxes || [];

        log(`[HTTP API] Received /print-boxes request with ${boxes.length} box(es) from ${req.socket.remoteAddress}`);

        if (boxes.length === 0) {
          sendJsonResponse(res, 400, { success: false, message: 'No boxes provided' }, origin);
          return;
        }

        boxes.forEach((b, i) => {
          log(`  -> Box ${i + 1}/${boxes.length}: [${b.qrId || 'NO-ID'}] ${b.productName || 'PRODUCT'} (Batch: ${b.batchNumber || '-'}, Wt: ${b.weight || b.packing || '-'})`);
        });

        // Pair boxes into 2-Across rows
        let fullTSPL = '';
        for (let i = 0; i < boxes.length; i += 2) {
          fullTSPL += buildTSPLForPair(boxes[i], boxes[i + 1] || null);
        }

        const result = await printTSPL(fullTSPL);

        sendJsonResponse(res, 200, {
          success: true,
          count: boxes.length,
          printer: result.printer,
          message: `Successfully printed ${boxes.length} stickers on ${result.printer}`
        }, origin);
      } catch (err) {
        log(`[HTTP API ERROR] /print-boxes failed: ${err.message}`, 'ERROR');
        sendJsonResponse(res, 500, { success: false, error: err.message }, origin);
      }
    });
    return;
  }

  sendJsonResponse(res, 404, { error: 'Endpoint not found' }, origin);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`====================================================`);
    log(`[INFO] Port ${PORT} is ALREADY ACTIVE in the background.`);
    log(`====================================================`);
    process.exit(0);
  } else {
    log(`[SERVER FATAL ERROR] ${err.message}`, 'ERROR');
    process.exit(1);
  }
});

server.listen(PORT, () => {
  const detected = IS_WIN ? detectWindowsPrinter() : CONFIG_PRINTER;
  log('====================================================');
  log('  Vaniki TSC TE244 Direct Print Service');
  log(`  Listening on: http://127.0.0.1:${PORT} & http://localhost:${PORT}`);
  log(`  Target Printer: ${detected} (${IS_WIN ? 'Windows Spooler' : 'CUPS'})`);
  log(`  Label Specs: 2-Across (50x25mm per sticker, 105mm total)`);
  log(`  Log File: ${LOG_FILE}`);
  log('====================================================');
});
