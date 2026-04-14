#!/usr/bin/env node
/**
 * Assign a Shopify Company Location to a Catalog.
 *
 * Default catalog: 76975472779
 *
 * Usage:
 *   node scripts/assign-company-location-to-catalog.js --company-id=1
 *   node scripts/assign-company-location-to-catalog.js --shopify-company-id=2390327546
 *   node scripts/assign-company-location-to-catalog.js --company-location-id=gid://shopify/CompanyLocation/9876543210
 *
 * Optional:
 *   --catalog-id=76975472779
 *
 * Notes:
 * - If you pass --company-id, the script reads shopify_location_id from local Pyramid DB.
 * - IDs can be numeric or full GIDs.
 *
 * Requires .env: SHOPIFY_SHOP_URL, SHOPIFY_ACCESS_TOKEN
 */

import 'dotenv/config';
import { getCompany } from '../services/pyramid.js';

const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';
const baseGraphQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
const DEFAULT_CATALOG_ID = '76975472779';

function toCatalogGid(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (s.startsWith('gid://')) return s;
  return `gid://shopify/Catalog/${s}`;
}

function toCompanyLocationGid(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (s.startsWith('gid://shopify/CompanyLocation/')) return s;
  return `gid://shopify/CompanyLocation/${s}`;
}

function toCompanyGid(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (s.startsWith('gid://shopify/Company/')) return s;
  return `gid://shopify/Company/${s}`;
}

function parseArgs() {
  const out = {
    companyId: null,
    shopifyCompanyId: null,
    companyLocationId: null,
    catalogId: DEFAULT_CATALOG_ID,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--company-id=')) out.companyId = arg.slice('--company-id='.length);
    else if (arg.startsWith('--shopify-company-id=')) out.shopifyCompanyId = arg.slice('--shopify-company-id='.length);
    else if (arg.startsWith('--company-location-id=')) out.companyLocationId = arg.slice('--company-location-id='.length);
    else if (arg.startsWith('--catalog-id=')) out.catalogId = arg.slice('--catalog-id='.length);
  }
  return out;
}

async function resolveCompanyLocationId({ companyId, shopifyCompanyId, companyLocationId }) {
  if (companyLocationId) return toCompanyLocationGid(companyLocationId);

  if (shopifyCompanyId) {
    return getPrimaryLocationForShopifyCompany(shopifyCompanyId);
  }

  if (!companyId) {
    throw new Error('Required: pass one of --company-id, --shopify-company-id, or --company-location-id');
  }

  const company = getCompany(Number(companyId));
  if (!company) throw new Error(`Company not found in Pyramid DB: id=${companyId}`);
  if (!company.shopify_location_id) {
    throw new Error(
      `Company ${companyId} has no shopify_location_id. Sync company to Shopify first, or pass --company-location-id directly.`
    );
  }

  return toCompanyLocationGid(company.shopify_location_id);
}

async function getPrimaryLocationForShopifyCompany(shopifyCompanyIdInput) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }
  const companyId = toCompanyGid(shopifyCompanyIdInput);

  const query = `
    query CompanyPrimaryLocation($companyId: ID!) {
      company(id: $companyId) {
        id
        locations(first: 1) {
          edges { node { id } }
        }
      }
    }
  `;

  const res = await fetch(baseGraphQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables: { companyId } }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP error while resolving company location: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const errors = data.errors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message || JSON.stringify(e)).join('; '));
  }
  const node = data.data?.company?.locations?.edges?.[0]?.node;
  if (!node?.id) {
    throw new Error(`No company location found for Shopify company ${companyId}`);
  }
  return node.id;
}

async function assignLocationToCatalog(catalogIdInput, companyLocationIdInput) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }

  const catalogId = toCatalogGid(catalogIdInput);
  const companyLocationId = toCompanyLocationGid(companyLocationIdInput);

  const mutation = `
    mutation CatalogContextUpdate($catalogId: ID!, $contextsToAdd: CatalogContextInput!) {
      catalogContextUpdate(catalogId: $catalogId, contextsToAdd: $contextsToAdd) {
        catalog {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    catalogId,
    contextsToAdd: {
      companyLocationIds: [companyLocationId],
    },
  };

  const res = await fetch(baseGraphQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL HTTP error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const result = data.data?.catalogContextUpdate;
  const errors = result?.userErrors || data.errors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message || JSON.stringify(e)).join('; '));
  }

  return {
    catalogId,
    companyLocationId,
    catalog: result?.catalog,
  };
}

async function main() {
  const args = parseArgs();
  const companyLocationId = await resolveCompanyLocationId(args);

  console.log('Assigning company location to catalog...');
  console.log({
    catalogId: args.catalogId,
    companyId: args.companyId,
    shopifyCompanyId: args.shopifyCompanyId,
    companyLocationId,
  });

  const result = await assignLocationToCatalog(args.catalogId, companyLocationId);

  console.log('\nSuccess:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
