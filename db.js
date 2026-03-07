import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'pyramid.db');

const db = new Database(DB_PATH);

// Pyramid CRM tables: companies and customers (pending → approved → synced to Shopify)
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    external_id TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_city TEXT,
    address_province TEXT,
    address_country TEXT,
    address_zip TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    shopify_company_id TEXT,
    shopify_location_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    shopify_customer_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
  CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
  CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
`);

export default db;
