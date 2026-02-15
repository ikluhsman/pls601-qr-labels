import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export async function initDB() {
  const db = await open({
    filename: process.env.DB_PATH || '/data/labels.db',
    driver: sqlite3.Database
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix TEXT NOT NULL,
      number INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      printed_at TEXT NOT NULL
    )
  `)

  return db
}
