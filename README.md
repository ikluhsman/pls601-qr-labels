# PLS601 QR Label Generator

A self-contained Dockerized web application for allocating monotonic QR
codes and generating printable 1"x1" Avery PLS601 sheet label PDFs.

Originally derived from a Dymo roll-label generator, this version
targets 7×9 (63 label) US Letter sheets.

------------------------------------------------------------------------

## Features

-   Monotonic, never-repeating QR code allocation
-   SQLite persistence (volume-backed)
-   Single container deployment
-   Multi-stage Docker build (Vite frontend + Node backend)
-   PDF sheet generation (7 columns × 9 rows)
-   Reverse proxy friendly (SSL terminated upstream)

------------------------------------------------------------------------

## Label Geometry

Configured for:

-   Paper: US Letter (8.5" × 11")
-   Labels: 1" × 1"
-   Layout: 7 columns × 9 rows
-   Left/Right margin: \~9mm
-   Top/Bottom margin: \~13mm

Adjust geometry inside `server.js` if needed.

------------------------------------------------------------------------

## Architecture

Browser\
↓\
Nginx Reverse Proxy (SSL termination)\
↓\
Node / Express App\
├── REST API\
├── SQLite database (/data/labels.db)\
└── Static frontend (Vite build)

------------------------------------------------------------------------

## API Endpoints

### Allocate Codes

POST /api/allocate-batch

Body:

{ "prefix": "T", "count": 10 }

Response:

{ "codes": \["T-000001", "T-000002"\] }

------------------------------------------------------------------------

### Generate PDF Sheet

POST /api/generate-sheet

Body:

{ "codes": \["T-000001", "T-000002"\] }

Returns a PDF file.

------------------------------------------------------------------------

### Health Check

GET /api/health

------------------------------------------------------------------------

## Local Development

Install frontend:

cd client\
npm install

Install backend:

cd server\
npm install

Build frontend:

cd client\
npm run build

Run backend:

cd server\
node server.js

App runs at:

http://localhost:4000

------------------------------------------------------------------------

## Docker Build

Build image:

docker build -t registry.kluhsman.com/pls-qr:1.0.0 .

Run container:

docker run -d\
-p 4000:4000\
-v plsqr_data:/data\
registry.kluhsman.com/pls-qr:1.0.0

------------------------------------------------------------------------

## Docker Compose Example

services: pls-qr: image: registry.kluhsman.com/pls-qr:1.0.0 restart:
unless-stopped ports: - "172.30.3.78:4000:4000" environment: -
NODE_ENV=production - DB_PATH=/data/labels.db volumes: -
plsqr_data:/data

volumes: plsqr_data:

------------------------------------------------------------------------

## Database

SQLite file location:

/data/labels.db

Schema:

CREATE TABLE labels ( id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT
UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, printed INTEGER
DEFAULT 0 );

Deleting the database file resets allocation history.

------------------------------------------------------------------------

## Print Settings

When printing generated PDF:

-   Paper size: US Letter
-   Scale: 100%
-   Disable "Fit to page"
-   Margins: Default

Always test alignment with /api/test-grid before bulk printing.

------------------------------------------------------------------------

## Reset Database

docker exec -it `<container>`{=html} rm /data/labels.db\
docker restart `<container>`{=html}

------------------------------------------------------------------------

## Notes

-   Allocation is monotonic and never reuses codes.
-   Static frontend is served from /public.
-   SPA fallback handles client-side routing.

------------------------------------------------------------------------

## License

Internal use.
