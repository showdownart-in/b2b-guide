/**
 * Sync approved Pyramid companies and customers to Shopify (B2B).
 * - Customers: REST Admin API
 * - Companies: GraphQL Admin API (B2B); link customer as contact after.
 */
import 'dotenv/config';

const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';

const baseREST = `https://${SHOP}/admin/api/${API_VERSION}`;
const baseGraphQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': TOKEN,
});

/** Normalize country to Shopify's 2-letter CountryCode (ISO 3166-1 alpha-2). */
function toCountryCode(value) {
  if (!value || typeof value !== 'string') return undefined;
  const v = value.trim();
  if (v.length === 2) return v.toUpperCase();
  const nameToCode = {
    india: 'IN', 'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB',
    canada: 'CA', australia: 'AU', germany: 'DE', france: 'FR', japan: 'JP',
    china: 'CN', brazil: 'BR', mexico: 'MX', spain: 'ES', italy: 'IT',
    netherlands: 'NL', singapore: 'SG', uae: 'AE', 'united arab emirates': 'AE',
    'saudi arabia': 'SA', 'south africa': 'ZA', 'south korea': 'KR', indonesia: 'ID',
    thailand: 'TH', malaysia: 'MY', philippines: 'PH', vietnam: 'VN', pakistan: 'PK',
    bangladesh: 'BD', 'sri lanka': 'LK', nepal: 'NP', ireland: 'IE', switzerland: 'CH',
    sweden: 'SE', poland: 'PL', belgium: 'BE', austria: 'AT', 'new zealand': 'NZ',
    'hong kong': 'HK', taiwan: 'TW', israel: 'IL', turkey: 'TR', egypt: 'EG',
    nigeria: 'NG', kenya: 'KE', argentina: 'AR', colombia: 'CO', chile: 'CL',
    peru: 'PE', russia: 'RU', ukraine: 'UA', portugal: 'PT', greece: 'GR',
    denmark: 'DK', norway: 'NO', finland: 'FI', 'czech republic': 'CZ', romania: 'RO',
    hungary: 'HU', croatia: 'HR',
  };
  return nameToCode[v.toLowerCase()] || undefined;
}

/**
 * Create customer in Shopify (REST).
 * Returns { id, ... } or throws.
 */
export async function createShopifyCustomer(customer) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }
  const body = {
    customer: {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone || undefined,
      verified_email: true,
    },
  };
  const res = await fetch(`${baseREST}/customers.json`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shopify customer create failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.customer;
}

/**
 * Create B2B company in Shopify (GraphQL).
 * Optionally create company contact (customer) in one go via companyCreate.
 * Returns { companyId, companyLocationId } or throws.
 */
export async function createShopifyCompany(company, primaryContact = null) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }

  const mutation = `
    mutation companyCreate($input: CompanyCreateInput!) {
      companyCreate(input: $input) {
        company {
          id
          locations(first: 1) {
            edges { node { id } }
          }
        }
        userErrors { field, message }
      }
    }
  `;

  // CompanyLocationInput uses shippingAddress (not "address"); CompanyAddressInput uses countryCode, zoneCode
  // Only send zoneCode when it looks like a short code (e.g. MH, ON, NY); full names like "Maharashtra" are invalid
  const province = company.address_province?.trim();
  const looksLikeZoneCode = province && /^[A-Za-z0-9]{2,3}$/.test(province);
  const hasAddress =
    company.address_line1 ||
    company.address_city ||
    company.address_province ||
    company.address_country ||
    company.address_zip;
  const shippingAddress = hasAddress
    ? {
        address1: company.address_line1 || undefined,
        city: company.address_city || undefined,
        ...(looksLikeZoneCode && { zoneCode: province.toUpperCase() }),
        countryCode: toCountryCode(company.address_country) || undefined,
        zip: company.address_zip || undefined,
      }
    : undefined;

  const companyLocation =
    company.name || shippingAddress
      ? {
          name: (company.name || 'Primary') + ' (Primary)',
          ...(shippingAddress && { shippingAddress }),
          ...(shippingAddress && { billingSameAsShipping: true }),
        }
      : undefined;

  const companyInput = {
    company: {
      name: company.name,
      externalId: company.external_id || undefined,
      note: company.email ? `Email: ${company.email}` : undefined,
    },
    ...(companyLocation && { companyLocation }),
    ...(primaryContact &&
    !primaryContact.shopify_customer_id &&
    primaryContact.first_name &&
    primaryContact.last_name &&
    primaryContact.email
      ? {
          companyContact: {
            firstName: primaryContact.first_name,
            lastName: primaryContact.last_name,
            email: primaryContact.email,
            phone: primaryContact.phone || undefined,
          },
        }
      : {}),
  };

  // Remove keys with undefined so we don't send invalid params
  const clean = (obj) => {
    if (obj == null || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      out[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? clean(v) : v;
    }
    return out;
  };
  const variables = { input: clean(companyInput) };

  const res = await fetch(baseGraphQL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query: mutation, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL error: ${res.status}`);
  const data = await res.json();
  const result = data.data?.companyCreate;
  const errors = result?.userErrors || data.errors;
  if (errors?.length) throw new Error(errors.map((e) => e.message || e).join('; '));
  const companyId = result?.company?.id;
  const locationId = result?.company?.locations?.edges?.[0]?.node?.id ?? null;
  if (!companyId) throw new Error('Shopify company create returned no company id');
  return { companyId, companyLocationId: locationId };
}

/**
 * Assign existing Shopify customer as contact to a company (GraphQL).
 */
export async function assignCustomerToCompany(shopifyCustomerId, shopifyCompanyId) {
  const mutation = `
    mutation companyAssignCustomerAsContact($customerId: ID!, $companyId: ID!) {
      companyAssignCustomerAsContact(customerId: $customerId, companyId: $companyId) {
        companyContact { id }
        userErrors { field, message }
      }
    }
  `;
  const res = await fetch(baseGraphQL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      query: mutation,
      variables: { customerId: shopifyCustomerId, companyId: shopifyCompanyId },
    }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL error: ${res.status}`);
  const data = await res.json();
  const result = data.data?.companyAssignCustomerAsContact;
  const errors = result?.userErrors || data.errors;
  if (errors?.length) throw new Error(errors.map((e) => e.message || e).join('; '));
  return result?.companyContact;
}
