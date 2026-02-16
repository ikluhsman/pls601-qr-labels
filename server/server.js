import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const app = express();
const PORT = 4000;

app.use(express.json());

/* ---------------------------
   PATH SETUP
---------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

app.use(express.static(publicPath));

/* ---------------------------
   DATABASE INIT
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

  console.log('Database initialized');
}

/* ---------------------------
   CONSTANTS (CALIBRATED)
---------------------------- */

const LABEL = 72;
const COLS = 7;
const ROWS = 9;
const LABELS_PER_PAGE = 63;

const MARGIN_L = 22.68;   // your final calibrated value
const MARGIN_T = 35.43;   // your final calibrated value
const GAP_X = 8.97;
const GAP_Y = 8.50;

/* ---------------------------
   HEALTH
---------------------------- */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ---------------------------
   TEST GRID
---------------------------- */

app.get('/api/test-grid', async (req, res) => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let counter = 1;

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
          borderWidth: 0.5,
          borderColor: rgb(0, 0, 0)
        });

        const cx = x + LABEL / 2;
        const cy = y + LABEL / 2;

        page.drawLine({
          start: { x: cx - 6, y: cy },
          end: { x: cx + 6, y: cy },
          thickness: 0.5,
          color: rgb(0, 0, 0)
        });

        page.drawLine({
          start: { x: cx, y: cy - 6 },
          end: { x: cx, y: cy + 6 },
          thickness: 0.5,
          color: rgb(0, 0, 0)
        });

        const text = String(counter);
        const textWidth = font.widthOfTextAtSize(text, 10);

        page.drawText(text, {
          x: cx - textWidth / 2,
          y: cy - 5,
          size: 10,
          font
        });

        counter++;
      }
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Test grid failed' });
  }
});

/* ---------------------------
   GENERATE LABEL SHEET
---------------------------- */

app.post('/api/generate-sheet', async (req, res) => {
  try {
    const { codes, startIndex = 1 } = req.body;

    if (!codes || !codes.length) {
      return res.status(400).json({ error: 'No codes provided' });
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page = pdfDoc.addPage([612, 792]);
    const FONT_SIZE = 9;
    const TOP_PADDING = 2;
    const TEXT_BAND = 12;
    const TEXT_GAP = 4;
    // QR
    const BOTTOM_PADDING = 4;

    let labelPosition = startIndex - 1;

    for (let i = 0; i < codes.length; i++) {

      const globalIndex = labelPosition + i;
      const pageIndex = globalIndex % LABELS_PER_PAGE;

      if (i > 0 && pageIndex === 0) {
        page = pdfDoc.addPage([612, 792]);
      }

      const row = Math.floor(pageIndex / COLS);
      const col = pageIndex % COLS;

      const x = MARGIN_L + col * (LABEL + GAP_X);
      const y =
        792 -
        MARGIN_T -
        (row + 1) * LABEL -
        row * GAP_Y;

      const code = codes[i];

      /* --- QR GENERATION --- */

      const qrDataUrl = await QRCode.toDataURL(code, {
        errorCorrectionLevel: 'M',
        margin: 0,          // remove internal margin
        width: 256
      });

      const qrBytes = Buffer.from(
        qrDataUrl.split(',')[1],
        'base64'
      );

      const qrImage = await pdfDoc.embedPng(qrBytes);

      const qrAvailable = LABEL - TOP_PADDING - TEXT_BAND - TEXT_GAP - BOTTOM_PADDING;
      const qrSize = qrAvailable;

      const qrX = x + (LABEL - qrSize) / 2;
      const qrY = y + BOTTOM_PADDING;

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize
      });

      /* --- TEXT --- */
      const textWidth = font.widthOfTextAtSize(code, FONT_SIZE);
      

      // Center text vertically inside TEXT_BAND
      const textY = y + BOTTOM_PADDING + qrSize + TEXT_GAP;

      page.drawText(code, {
        x: x + (LABEL - textWidth) / 2,
        y: textY,
        size: FONT_SIZE,
        font
      });	
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sheet generation failed' });
  }
});

/* ---------------------------
   ALLOCATE
---------------------------- */

app.post('/api/allocate-batch', async (req, res) => {
  try {
    const { prefix = 'T', count = 1 } = req.body;

    const cleanPrefix = String(prefix).toUpperCase();

    if (!/^[A-Z0-9]{1,3}$/.test(cleanPrefix)) {
      return res.status(400).json({ error: 'Prefix must be 1–3 alphanumeric characters' });
    }

    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      return res.status(400).json({ error: 'Count must be an integer between 1 and 500' });
    }

    const prefixLen = cleanPrefix.length;
    const totalLen = prefixLen + 5;

    // Match: PREFIX + exactly 5 digits
    // Example for "T":  "T[0-9][0-9][0-9][0-9][0-9]"
    const globPattern = `${cleanPrefix}[0-9][0-9][0-9][0-9][0-9]`;

    // Get max numeric suffix for this exact prefix
    const row = await db.get(
      `
      SELECT MAX(CAST(substr(code, ?) AS INTEGER)) AS max_num
      FROM labels
      WHERE code GLOB ?
        AND length(code) = ?
      `,
      prefixLen + 1,     // SQLite substr is 1-based
      globPattern,
      totalLen
    );

    let nextNumber = (row?.max_num ?? 0) + 1;

    // Allocate in a transaction so partial batches don't happen
    await db.exec('BEGIN IMMEDIATE TRANSACTION');

    const inserted = [];
    for (let i = 0; i < n; i++) {
      if (nextNumber > 99999) {
        await db.exec('ROLLBACK');
        return res.status(400).json({ error: 'Prefix exhausted (max 99999)' });
      }

      const code = `${cleanPrefix}${String(nextNumber).padStart(5, '0')}`;
      await db.run(`INSERT INTO labels (code) VALUES (?)`, code);

      inserted.push(code);
      nextNumber++;
    }

    await db.exec('COMMIT');
    res.json({ codes: inserted });
  } catch (err) {
    try { await db.exec('ROLLBACK'); } catch {}
    console.error(err);
    res.status(500).json({ error: 'Allocation failed' });
  }
});



/* ---------------------------
   SPA FALLBACK
---------------------------- */

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

/* ---------------------------
   START
---------------------------- */

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});

