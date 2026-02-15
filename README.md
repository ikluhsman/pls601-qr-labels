# Dymo 550 QR Label Service

Single-container React + Express + SQLite service
for generating unique QR labels for Dymo LabelWriter 550.

## Features

- Monotonic, never-repeating barcode allocation
- SQLite persistence
- Single container deployment
- Static frontend + REST API
- Volume-mounted database

## Build

docker build -t registry.example.com/dymo-qr:1.0.0 .

## Push

docker push registry.example.com/dymo-qr:1.0.0

## Run

docker run -d \
  --name dymo-qr \
  -p 4000:4000 \
  -v /docker/volumes/dymo-qr-data:/data \
  registry.example.com/dymo-qr:1.0.0

## Database

SQLite database file:
  /data/labels.db

Deleting the DB resets numbering to 1. Currently 999,999 records are supported. If you indefinitely holding that much physical paper, you have reached institutional scale and you likely have bigger problems.

## Architecture

Client:
  React (built via Vite)

Server:
  Express API
  SQLite allocation

Identity allocation is:
  - Unique
  - Monotonic
  - Transactional
  - Immutable

The database is the source of truth.
