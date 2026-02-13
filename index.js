const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const sessionsPath = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsPath)) fs.mkdirSync(sessionsPath);

const licensesFile = path.join(__dirname, 'licenses.json');

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// LICENSE VERIFY
app.post('/verify-license', (req, res) => {
  const { license } = req.body;
  const licenses = loadJSON(licensesFile);

  if (!licenses[license] || licenses[license].used) {
    return res.json({ success: false });
  }

  licenses[license].used = true;
  saveJSON(licensesFile, licenses);

  res.json({ success: true });
});

// PAIRING
app.post('/pair', async (req, res) => {
  const { phoneNumber } = req.body;
  const cleaned = phoneNumber.replace(/\D/g, '');
  const userSession = path.join(sessionsPath, cleaned);

  if (!fs.existsSync(userSession)) fs.mkdirSync(userSession);

  const { state, saveCreds } = await useMultiFileAuthState(userSession);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ qr }) => {
    if (qr) {
      const qrData = await QRCode.toDataURL(qr);
      res.json({ success: true, qr: qrData });
    }
  });
});

// VIEW SESSIONS
app.get('/sessions', (req, res) => {
  const sessions = fs.readdirSync(sessionsPath);
  res.json(sessions);
});

app.listen(3000, () => {
  console.log("🚀 ALMEER XMD PANEL RUNNING ON PORT 3000");
});