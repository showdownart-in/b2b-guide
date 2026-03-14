#!/usr/bin/env node
/**
 * Update a product variant's four custom metafields and/or set "Continue selling when out of stock".
 *
 * Usage (from project root):
 *   node scripts/update-variant-metafields-and-inventory.js --product-id=1234567890 --variant-id=9876543210
 *
 * Optional metafields (omit to leave unchanged):
 *   --moq=10
 *   --variant-incoming-stock=500
 *   --variant-incoming-stock-date=2025-04-01
 *   --variant-stock-tentative-date=2025-03-20
 *
 * Optional:
 *   --continue-selling=true   (default: true) Set to false to skip updating inventory policy.
 *
 * IDs can be numeric or full GID (gid://shopify/Product/... or gid://shopify/ProductVariant/...).
 *
 * Requires .env: SHOPIFY_SHOP_URL, SHOPIFY_ACCESS_TOKEN
 */

import 'dotenv/config';

const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';
const baseGraphQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

function toProductGid(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (s.startsWith('gid://shopify/Product/')) return s;
  return `gid://shopify/Product/${s}`;
}

function toVariantGid(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (s.startsWith('gid://shopify/ProductVariant/')) return s;
  return `gid://shopify/ProductVariant/${s}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    productId: null,
    variantId: null,
    moq: null,
    variant_incoming_stock: null,
    variant_incoming_stock_date: null,
    variant_stock_tentative_date: null,
    continueSelling: true,
  };
  for (const arg of args) {
    if (arg.startsWith('--product-id=')) out.productId = arg.slice('--product-id='.length);
    else if (arg.startsWith('--variant-id=')) out.variantId = arg.slice('--variant-id='.length);
    else if (arg.startsWith('--moq=')) out.moq = arg.slice('--moq='.length);
    else if (arg.startsWith('--variant-incoming-stock='))
      out.variant_incoming_stock = arg.slice('--variant-incoming-stock='.length);
    else if (arg.startsWith('--variant-incoming-stock-date='))
      out.variant_incoming_stock_date = arg.slice('--variant-incoming-stock-date='.length);
    else if (arg.startsWith('--variant-stock-tentative-date='))
      out.variant_stock_tentative_date = arg.slice('--variant-stock-tentative-date='.length);
    else if (arg.startsWith('--continue-selling='))
      out.continueSelling = arg.slice('--continue-selling='.length) === 'true';
  }
  return out;
}

async function updateVariantMetafieldsAndInventory(options) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }

  const productId = toProductGid(options.productId);
  const variantId = toVariantGid(options.variantId);
  if (!productId || !variantId) {
    throw new Error('Required: --product-id and --variant-id');
  }

  const metafields = [];
  if (options.moq != null && options.moq !== '') {
    metafields.push({
      namespace: 'custom',
      key: 'moq',
      type: 'single_line_text_field',
      value: String(options.moq),
    });
  }
  if (options.variant_incoming_stock != null && options.variant_incoming_stock !== '') {
    metafields.push({
      namespace: 'custom',
      key: 'variant_incoming_stock',
      type: 'single_line_text_field',
      value: String(options.variant_incoming_stock),
    });
  }
  if (options.variant_incoming_stock_date != null && options.variant_incoming_stock_date !== '') {
    metafields.push({
      namespace: 'custom',
      key: 'variant_incoming_stock_date',
      type: 'date',
      value: String(options.variant_incoming_stock_date),
    });
  }
  if (options.variant_stock_tentative_date != null && options.variant_stock_tentative_date !== '') {
    metafields.push({
      namespace: 'custom',
      key: 'variant_stock_tentative_date',
      type: 'date',
      value: String(options.variant_stock_tentative_date),
    });
  }

  const variantInput = {
    id: variantId,
    ...(options.continueSelling && { inventoryPolicy: 'CONTINUE' }),
    ...(metafields.length > 0 && { metafields }),
  };

  const mutation = `
    mutation UpdateVariantMetafieldsAndInventory($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        product { id }
        productVariants {
          id
          inventoryPolicy
          metafields(first: 10) {
            edges { node { namespace key value } }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const res = await fetch(baseGraphQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        productId,
        variants: [variantInput],
      },
    }),
  });

  if (!res.ok) throw new Error(`GraphQL error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const result = data.data?.productVariantsBulkUpdate;
  const errors = result?.userErrors || data.errors;

  if (errors?.length) {
    throw new Error(errors.map((e) => e.message || JSON.stringify(e)).join('; '));
  }

  return result;
}

async function main() {
  const options = parseArgs();
  console.log('Options:', {
    productId: options.productId,
    variantId: options.variantId,
    moq: options.moq,
    variant_incoming_stock: options.variant_incoming_stock,
    variant_incoming_stock_date: options.variant_incoming_stock_date,
    variant_stock_tentative_date: options.variant_stock_tentative_date,
    continueSelling: options.continueSelling,
  });
  console.log('');

  const result = await updateVariantMetafieldsAndInventory(options);

  console.log('Updated variant:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
