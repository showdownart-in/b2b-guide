const API = '/api';

export async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function getCompanies(status = null) {
  const path = status ? `/companies?status=${status}` : '/companies';
  return api('GET', path);
}

export async function createCompany(payload) {
  return api('POST', '/companies', payload);
}

export async function approveCompany(id) {
  return api('POST', `/companies/${id}/approve`);
}

export async function syncCompany(id) {
  return api('POST', `/companies/${id}/sync`);
}

export async function getCustomers(status = null, companyId = null) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (companyId != null) params.set('company_id', companyId);
  const q = params.toString();
  return api('GET', '/customers' + (q ? '?' + q : ''));
}

export async function createCustomer(payload) {
  return api('POST', '/customers', payload);
}

export async function approveCustomer(id) {
  return api('POST', `/customers/${id}/approve`);
}

export async function syncCustomer(id) {
  return api('POST', `/customers/${id}/sync`);
}

/** Single-step: create company + customer, approve both, sync company to Shopify. */
export async function onboardCompanyWithCustomer(company, customer) {
  return api('POST', '/onboard', { company, customer });
}
