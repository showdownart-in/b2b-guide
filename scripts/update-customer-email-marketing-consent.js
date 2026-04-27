#!/usr/bin/env node
/**
 * Subscribe a customer to email marketing in Shopify.
 *
 * Usage:
 *   node scripts/update-customer-email-marketing-consent.js --customer-id=1234567890
 *   node scripts/update-customer-email-marketing-consent.js --customer-id=gid://shopify/Customer/1234567890
 *
 * Optional:
 *   --opt-in-level=SINGLE_OPT_IN   (default)
 *   --opt-in-level=CONFIRMED_OPT_IN
 *
 * Requires .env: SHOPIFY_SHOP_URL, SHOPIFY_ACCESS_TOKEN
 */

import 'dotenv/config';

const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';
const baseGraphQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

function toCustomerGid(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (s.startsWith('gid://shopify/Customer/')) return s;
  return `gid://shopify/Customer/${s}`;
}

function parseArgs() {
  const out = {
    customerId: null,
    optInLevel: 'SINGLE_OPT_IN',
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--customer-id=')) out.customerId = arg.slice('--customer-id='.length);
    else if (arg.startsWith('--opt-in-level=')) out.optInLevel = arg.slice('--opt-in-level='.length);
  }

  return out;
}

async function subscribeCustomerEmailMarketing(customerIdInput, optInLevel) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }

  const customerId = toCustomerGid(customerIdInput);
  if (!customerId) {
    throw new Error('Required: --customer-id');
  }

  const mutation = `
    mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) {
        customer {
          id
          email
          emailMarketingConsent {
            marketingState
            marketingOptInLevel
            consentUpdatedAt
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      customerId,
      emailMarketingConsent: {
        marketingState: 'SUBSCRIBED',
        marketingOptInLevel: optInLevel,
        consentUpdatedAt: new Date().toISOString(),
      },
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
  const result = data.data?.customerEmailMarketingConsentUpdate;
  const errors = result?.userErrors || data.errors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message || JSON.stringify(e)).join('; '));
  }

  return result?.customer;
}

async function main() {
  const args = parseArgs();
  const customer = await subscribeCustomerEmailMarketing(args.customerId, args.optInLevel);
  console.log('Customer email marketing consent updated:');
  console.log(JSON.stringify(customer, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

