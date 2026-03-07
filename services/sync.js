/**
 * Orchestrates: approve in Pyramid → create in Shopify → mark synced.
 */
import * as pyramid from './pyramid.js';
import * as shopify from './shopify.js';

export async function syncCustomerToShopify(customerId) {
  const c = pyramid.getCustomer(customerId);
  if (!c) throw new Error('Customer not found');
  if (c.status === 'synced') throw new Error('Customer already synced to Shopify');
  if (c.status !== 'approved') throw new Error('Customer must be approved before sync');

  const shopifyCustomer = await shopify.createShopifyCustomer(c);
  const gid = shopifyCustomer.id; // Shopify returns GraphQL Gid in REST sometimes; REST uses numeric id
  const idStr = typeof gid === 'string' && gid.startsWith('gid://') ? gid : `gid://shopify/Customer/${shopifyCustomer.id}`;
  pyramid.markCustomerSynced(customerId, idStr);
  return { customer: pyramid.getCustomer(customerId), shopify_customer_id: idStr };
}

export async function syncCompanyToShopify(companyId) {
  const company = pyramid.getCompany(companyId);
  if (!company) throw new Error('Company not found');
  if (company.status === 'synced') throw new Error('Company already synced to Shopify');
  if (company.status !== 'approved') throw new Error('Company must be approved before sync');

  const customers = pyramid.listCustomers('approved', companyId);
  let primaryContact = customers[0] || null;
  let shopifyCompanyId, shopifyLocationId;

  try {
    const result = await shopify.createShopifyCompany(company, primaryContact);
    shopifyCompanyId = result.companyId;
    shopifyLocationId = result.companyLocationId;
  } catch (e) {
    throw new Error(`Shopify company create failed: ${e.message}`);
  }

  pyramid.markCompanySynced(companyId, shopifyCompanyId, shopifyLocationId);

  // Sync and assign each approved customer (if not already synced)
  for (const cust of customers) {
    if (cust.status === 'synced' && cust.shopify_customer_id) {
      try {
        await shopify.assignCustomerToCompany(cust.shopify_customer_id, shopifyCompanyId);
      } catch (_) {}
      continue;
    }
    try {
      const shopifyCustomer = await shopify.createShopifyCustomer(cust);
      const gid = typeof shopifyCustomer.id === 'string' && shopifyCustomer.id.startsWith('gid://')
        ? shopifyCustomer.id
        : `gid://shopify/Customer/${shopifyCustomer.id}`;
      pyramid.markCustomerSynced(cust.id, gid);
      await shopify.assignCustomerToCompany(gid, shopifyCompanyId);
    } catch (err) {
      console.error(`Failed to sync customer ${cust.id} to Shopify:`, err.message);
    }
  }

  return { company: pyramid.getCompany(companyId), shopify_company_id: shopifyCompanyId };
}

/**
 * Create company + customer in Pyramid, approve both, then sync company to Shopify
 * (company is created in Shopify and customer is assigned as contact).
 */
export async function onboardCompanyWithCustomer(companyData, customerData) {
  const company = pyramid.createCompany(companyData);
  const customer = pyramid.createCustomer({
    ...customerData,
    company_id: company.id,
  });
  pyramid.approveCompany(company.id);
  pyramid.approveCustomer(customer.id);
  const result = await syncCompanyToShopify(company.id);
  return {
    company: result.company,
    customer: pyramid.getCustomer(customer.id),
    shopify_company_id: result.shopify_company_id,
  };
}
