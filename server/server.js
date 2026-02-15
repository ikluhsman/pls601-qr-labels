import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const app = express();
const PORT = 4000;

app.use(express.json());

/* ---------------------------
   PATH SETUP (ESM SAFE)
---------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

/* ---------------------------
   SERVE BUILT FRONTEND
---------------------------- */

app.use(express.static(publicPath));

/* ---------------------------
   DATABASE INIT + MIGRATION
---------------------------- */

let db;

async function initDatabase() {
  db = await open({
    filename: process.env.DB_PATH || './labels.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await db.exec(`
      ALTER TABLE labels ADD COLUMN printed INTEGER DEFAULT 0;
    `);
  } catch {
    // column already exists
  }

  console.log('Database initialized');
}

/* ---------------------------
   API ROUTES
---------------------------- */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* TEST GRID */

app.get('/api/test-grid', async (req, res) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);

    const LABEL = 72;
    const COLS = 7;
    const ROWS = 9;

    const MARGIN_L = 25.5;
    const MARGIN_T = 36.85;
    const GAP_X = 9.5;
    const GAP_Y = 8.79;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = MARGIN_L + col * (LABEL + GAP_X);
        const y =
          792 -
          MARGIN_T -
          (row + 1) * LABEL -
          row * GAP_Y;

        page.drawRectangle({
          x,
          y,
          width: LABEL,
          height: LABEL,
          borderWidth: 0.5
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).send('Test grid failed');
  }
});

/* GENERATE SHEET */

app.post('/api/generate-sheet', async (req, res) => {
  try {
    const { codes } = req.body;

    if (!codes || !codes.length) {
      return res.status(400).json({ error: 'No codes provided' });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const LABEL = 72;
    const COLS = 7;
    const ROWS = 9;

    const MARGIN_L = 25.5;
    const MARGIN_T = 36.85;
    const GAP_X = 9.5;
    const GAP_Y = 8.79;

    let index = 0;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (index >= codes.length) break;

        const code = codes[index];

        const x = MARGIN_L + col * (LABEL + GAP_X);
        const y =
          792 -
          MARGIN_T -
          (row + 1) * LABEL -
          row * GAP_Y;

        const qrDataUrl = await QRCode.toDataURL(code, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 256
        });

        const qrBytes = Buffer.from(
          qrDataUrl.split(',')[1],
          'base64'
        );

        const qrImage = await pdfDoc.embedPng(qrBytes);

        const inset = 6;

        page.drawImage(qrImage, {
          x: x + inset,
          y: y + inset + 6,
          width: LABEL - inset * 2,
          height: LABEL - inset * 2 - 10
        });

        page.drawText(code, {
          x: x + 6,
          y: y + 4,
          size: 6,
          font
        });

        index++;
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sheet generation failed' });
  }
});

/* ALLOCATE */

app.post('/api/allocate-batch', async (req, res) => {
  try {
    const { prefix = 'T', count = 1 } = req.body;

    const last = await db.get(
      `SELECT id FROM labels ORDER BY id DESC LIMIT 1`
    );

    let nextId = last ? last.id + 1 : 1;
    const inserted = [];

    for (let i = 0; i < count; i++) {
      const padded = String(nextId).padStart(6, '0');
      const code = `${prefix}-${padded}`;

      await db.run(
        `INSERT INTO labels (code, printed) VALUES (?, 0)`,
        code
      );

      inserted.push(code);
      nextId++;
    }

    res.json({ codes: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).send('Allocation failed');
  }
});

/* ---------------------------
   SPA FALLBACK (MUST BE LAST)
---------------------------- */

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

/* ---------------------------
   START SERVER
---------------------------- */

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});

