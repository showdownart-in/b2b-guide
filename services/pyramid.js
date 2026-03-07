/**
 * Pyramid CRM simulation: companies and customers live here first.
 * Status: pending → approved (then sync to Shopify).
 */
import db from '../db.js';

const statuses = ['pending', 'approved', 'synced'];

// ---------- Companies ----------
export function listCompanies(status = null) {
  const stmt = status
    ? db.prepare('SELECT * FROM companies WHERE status = ? ORDER BY created_at DESC')
    : db.prepare('SELECT * FROM companies ORDER BY created_at DESC');
  return (status ? stmt.all(status) : stmt.all()).map(rowToCompany);
}

export function getCompany(id) {
  const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  return row ? rowToCompany(row) : null;
}

export function createCompany(data) {
  const stmt = db.prepare(`
    INSERT INTO companies (name, external_id, email, phone, address_line1, address_city, address_province, address_country, address_zip, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  const result = stmt.run(
    data.name,
    data.external_id || null,
    data.email || null,
    data.phone || null,
    data.address_line1 || null,
    data.address_city || null,
    data.address_province || null,
    data.address_country || null,
    data.address_zip || null
  );
  return getCompany(result.lastInsertRowid);
}

export function approveCompany(id) {
  db.prepare("UPDATE companies SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(id);
  return getCompany(id);
}

export function markCompanySynced(id, shopifyCompanyId, shopifyLocationId) {
  db.prepare(`
    UPDATE companies SET status = 'synced', shopify_company_id = ?, shopify_location_id = ?, updated_at = datetime('now') WHERE id = ?
  `).run(shopifyCompanyId, shopifyLocationId, id);
  return getCompany(id);
}

// ---------- Customers ----------
export function listCustomers(status = null, companyId = null) {
  let sql = 'SELECT * FROM customers ORDER BY created_at DESC';
  const params = [];
  if (status) {
    sql = 'SELECT * FROM customers WHERE status = ? ORDER BY created_at DESC';
    params.push(status);
  }
  if (companyId != null) {
    sql = status
      ? 'SELECT * FROM customers WHERE status = ? AND company_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM customers WHERE company_id = ? ORDER BY created_at DESC';
    params.push(companyId);
  }
  const stmt = db.prepare(sql);
  return (params.length ? stmt.all(...params) : stmt.all()).map(rowToCustomer);
}

export function getCustomer(id) {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  return row ? rowToCustomer(row) : null;
}

export function createCustomer(data) {
  const stmt = db.prepare(`
    INSERT INTO customers (company_id, first_name, last_name, email, phone, role, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);
  const result = stmt.run(
    data.company_id ? Number(data.company_id) : null,
    data.first_name,
    data.last_name,
    data.email,
    data.phone || null,
    data.role || null
  );
  return getCustomer(result.lastInsertRowid);
}

export function approveCustomer(id) {
  db.prepare("UPDATE customers SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(id);
  return getCustomer(id);
}

export function markCustomerSynced(id, shopifyCustomerId) {
  db.prepare("UPDATE customers SET status = 'synced', shopify_customer_id = ?, updated_at = datetime('now') WHERE id = ?").run(shopifyCustomerId, id);
  return getCustomer(id);
}

function rowToCompany(row) {
  return {
    id: row.id,
    name: row.name,
    external_id: row.external_id,
    email: row.email,
    phone: row.phone,
    address: [row.address_line1, row.address_city, row.address_province, row.address_country, row.address_zip].filter(Boolean).join(', ') || null,
    address_line1: row.address_line1,
    address_city: row.address_city,
    address_province: row.address_province,
    address_country: row.address_country,
    address_zip: row.address_zip,
    status: row.status,
    shopify_company_id: row.shopify_company_id,
    shopify_location_id: row.shopify_location_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToCustomer(row) {
  return {
    id: row.id,
    company_id: row.company_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    shopify_customer_id: row.shopify_customer_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
