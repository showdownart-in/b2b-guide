#!/usr/bin/env node
/**
 * Create a Shopify customer with email marketing consent already subscribed.
 *
 * Usage:
 *   node scripts/create-customer-with-email-marketing.js \
 *     --email=jane@acme.com \
 *     --first-name=Jane \
 *     --last-name=Doe
 *
 * Optional:
 *   --phone=+46701234567
 *   --opt-in-level=single_opt_in   (default)
 *   --opt-in-level=confirmed_opt_in
 *
 * Requires .env: SHOPIFY_SHOP_URL, SHOPIFY_ACCESS_TOKEN
 */

import 'dotenv/config';

const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';
const baseREST = `https://${SHOP}/admin/api/${API_VERSION}`;

function parseArgs() {
  const out = {
    email: null,
    firstName: null,
    lastName: null,
    phone: null,
    optInLevel: 'single_opt_in',
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--email=')) out.email = arg.slice('--email='.length);
    else if (arg.startsWith('--first-name=')) out.firstName = arg.slice('--first-name='.length);
    else if (arg.startsWith('--last-name=')) out.lastName = arg.slice('--last-name='.length);
    else if (arg.startsWith('--phone=')) out.phone = arg.slice('--phone='.length);
    else if (arg.startsWith('--opt-in-level=')) out.optInLevel = arg.slice('--opt-in-level='.length);
  }
  return out;
}

async function createCustomerWithEmailMarketingConsent(args) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }
  if (!args.email || !args.firstName || !args.lastName) {
    throw new Error('Required: --email, --first-name, --last-name');
  }

  const body = {
    customer: {
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email,
      phone: args.phone || undefined,
      verified_email: true,
      email_marketing_consent: {
        state: 'subscribed',
        opt_in_level: args.optInLevel,
        consent_updated_at: new Date().toISOString(),
      },
    },
  };

  const res = await fetch(`${baseREST}/customers.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Shopify customer create failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.customer;
}

async function main() {
  const args = parseArgs();
  const customer = await createCustomerWithEmailMarketingConsent(args);
  console.log('Customer created with email marketing subscribed:');
  console.log(JSON.stringify(customer, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

