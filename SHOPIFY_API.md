# Shopify API documentation (used by this sample app)

This document explains the **exact Shopify Admin APIs** called by the sample app to sync **Pyramid-approved** B2B data into Shopify.

---

## Table of contents

1. [Authentication & base URLs](#authentication--base-urls)
   - [Access token](#access-token)
   - [Store domain](#store-domain)
   - [API version](#api-version)
2. [Required Shopify features & scopes](#required-shopify-features--scopes)
   - [B2B (Companies)](#b2b-companies)
   - [Customers](#customers)
   - [Companies (GraphQL)](#companies-graphql)
3. [API calls made by this app](#api-calls-made-by-this-app)
   - [1) Create customer (REST Admin API)](#1-create-customer-rest-admin-api)
   - [2) Create company (GraphQL Admin API, B2B)](#2-create-company-graphql-admin-api-b2b)
   - [2b) Company custom metafields (GraphQL: metafieldsSet)](#2b-company-custom-metafields-graphql-metafieldsset)
   - [3) Assign customer as company contact (GraphQL Admin API, B2B)](#3-assign-customer-as-company-contact-graphql-admin-api-b2b)
4. [Sync sequence (what happens on "Sync to Shopify")](#sync-sequence-what-happens-on-sync-to-shopify)
   - [Sync a single customer](#sync-a-single-customer)
   - [Sync a company (and its approved customers)](#sync-a-company-and-its-approved-customers)
5. [Error handling behavior (important for ops)](#error-handling-behavior-important-for-ops)
6. [Partial order fulfillment (REST Admin API)](#partial-order-fulfillment-rest-admin-api)
7. [Variant metafields & “Continue selling when out of stock”](#variant-metafields--continue-selling-when-out-of-stock)
8. [What this app does NOT do (yet)](#what-this-app-does-not-do-yet)

---

The Shopify integration lives in:

```1:143:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
/**
 * Sync approved Pyramid companies and customers to Shopify (B2B).
 * - Customers: REST Admin API
 * - Companies: GraphQL Admin API (B2B); link customer as contact after.
 */
// ... more code ...
```

And it’s orchestrated by:

```7:61:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/sync.js
export async function syncCustomerToShopify(customerId) {
  // ...
}

export async function syncCompanyToShopify(companyId) {
  // ...
}
```

---

## Authentication & base URLs

### Access token

All Shopify calls use an **Admin API access token** provided via:

- **`SHOPIFY_ACCESS_TOKEN`**: included as header `X-Shopify-Access-Token`

The code constructs headers like:

```15:18:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
const headers = () => ({
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': TOKEN,
});
```

### Store domain

- **`SHOPIFY_SHOP_URL`**: e.g. `https://your-store.myshopify.com`
- The code strips protocol/trailing slash and builds the Admin API base:

```8:13:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';

const baseREST = `https://${SHOP}/admin/api/${API_VERSION}`;
const baseGraphQL = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
```

### API version

- **`SHOPIFY_API_VERSION`**: defaults to `2023-10` in this app
- REST uses: `https://{shop}/admin/api/{version}/...`
- GraphQL uses: `https://{shop}/admin/api/{version}/graphql.json`

---

## Required Shopify features & scopes

### B2B (Companies)

Creating and managing **B2B Companies** in Shopify is a **Shopify Plus** feature.

This app uses GraphQL Admin API mutations that require access to B2B/companies functionality (and appropriate app scopes on the store).

### Customers

Creating customers uses **REST Admin API** and requires:

- **`write_customers`** (and typically `read_customers`)

### Companies (GraphQL)

To create companies and assign contacts, the token must have the relevant B2B company scopes. The exact scope names depend on how the app is installed and the store plan; at minimum you must be able to:

- Create companies (B2B)
- Assign customers as company contacts

---

## API calls made by this app

The app makes **three** kinds of Shopify calls:

1. **Create Customer** (REST)
2. **Create Company** (GraphQL B2B)
3. **Assign Customer as Company Contact** (GraphQL B2B)

### 1) Create customer (REST Admin API)

**Endpoint**

- `POST /admin/api/{version}/customers.json`

**Used in**

```24:48:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
export async function createShopifyCustomer(customer) {
  // ...
  const res = await fetch(`${baseREST}/customers.json`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  // ...
  const data = await res.json();
  return data.customer;
}
```

**Request body (shape used here)**

```28:36:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
const body = {
  customer: {
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone || undefined,
    verified_email: true,
  },
};
```

**Notes**

- `verified_email: true` is set for demo convenience. In real flows, you might keep it `false` and rely on Shopify verification.
- This code throws with full response text when non-2xx:

```42:45:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
if (!res.ok) {
  const err = await res.text();
  throw new Error(`Shopify customer create failed: ${res.status} ${err}`);
}
```

**Response**

- Shopify REST typically returns a customer object including **numeric `id`** (e.g. `123456789`).

**How we store the ID**

Company-contact GraphQL expects a **GraphQL ID (GID)** like `gid://shopify/Customer/123456789`.

So in the sync layer, we normalize whatever comes back into a GID string:

```13:17:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/sync.js
const shopifyCustomer = await shopify.createShopifyCustomer(c);
const gid = shopifyCustomer.id; // Shopify returns GraphQL Gid in REST sometimes; REST uses numeric id
const idStr = typeof gid === 'string' && gid.startsWith('gid://') ? gid : `gid://shopify/Customer/${shopifyCustomer.id}`;
pyramid.markCustomerSynced(customerId, idStr);
return { customer: pyramid.getCustomer(customerId), shopify_customer_id: idStr };
```

### 2) Create company (GraphQL Admin API, B2B)

**Endpoint**

- `POST /admin/api/{version}/graphql.json`

**Mutation**

- `companyCreate(company: CompanyCreateInput!)`

**Used in**

```55:114:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
export async function createShopifyCompany(company, primaryContact = null) {
  const mutation = `
    mutation companyCreate($company: CompanyCreateInput!) {
      companyCreate(company: $company) {
        company { id }
        companyLocation { id }
        userErrors { field, message }
      }
    }
  `;
  // ...
}
```

**Variables / input we send**

We send a `CompanyCreateInput` that includes:

- `company`: core company properties (`name`, optional `externalId`, optional `note`)
- `companyLocation`: a primary location with an address
- `companyContact` (optional): only included when we have an approved customer to use as a “primary contact” **and** we don’t already have a `shopify_customer_id` recorded for them

```70:98:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
const companyInput = {
  company: {
    name: company.name,
    externalId: company.external_id || undefined,
    note: company.email ? `Email: ${company.email}` : undefined,
  },
  companyLocation: {
    name: company.name + ' (Primary)',
    address: {
      address1: company.address_line1 || undefined,
      city: company.address_city || undefined,
      province: company.address_province || undefined,
      country: company.address_country || undefined,
      zip: company.address_zip || undefined,
    },
  },
  ...(primaryContact && primaryContact.shopify_customer_id
    ? {}
    : primaryContact
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
```

**Response handling**

- GraphQL can return:
  - `data.companyCreate.userErrors[]` for validation / business-rule errors
  - top-level `errors[]` for GraphQL errors

This app treats either as an error and throws:

```106:113:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
const data = await res.json();
const result = data.data?.companyCreate;
const errors = result?.userErrors || data.errors;
if (errors?.length) throw new Error(errors.map((e) => e.message || e).join('; '));
const companyId = result?.company?.id;
const locationId = result?.companyLocation?.id;
if (!companyId) throw new Error('Shopify company create returned no company id');
return { companyId, companyLocationId: locationId };
```

**IDs returned**

GraphQL returns IDs as GIDs, e.g.:

- `companyId`: `gid://shopify/Company/…`
- `companyLocationId`: `gid://shopify/CompanyLocation/…`

Those values are stored in SQLite in the Pyramid simulation (`companies.shopify_company_id`, `companies.shopify_location_id`) when sync succeeds.

### 2b) Company custom metafields (GraphQL: metafieldsSet)

`companyCreate` does **not** accept metafields. To add custom fields to a Company, the app calls **`metafieldsSet`** after the company is created.

**Creation flow**

1. Create the company with `companyCreate` (section 2) and get the company GID from the response.
2. Call `metafieldsSet` with `ownerId` = that company GID and the custom key/value pairs. You can do this in the same integration flow right after step 1.

**Shopify Company metafields used (namespace `custom`):**

| `namespace.key` | Description (example) |
|-----------------|----------------------|
| `custom.projekttyp` | Projekttyp (Project type) |
| `custom.e_postfaktura` | E-postfaktura (Email invoice) |
| `custom.kundtyp` | Kundtyp (Customer type) |
| `custom.ansvarig_agent` | Ansvarig agent (Responsible agent) |
| `custom.saljare` | Säljare (Seller) |
| `custom.leveransvillkor` | Leveransvillkor (Delivery terms) |

**How Pyramid can add/update these:**

1. **When creating a company:** Include the six fields in the company payload (e.g. in `POST /api/onboard`): `projekttyp`, `e_postfaktura`, `kundtyp`, `ansvarig_agent`, `saljare`, `leveransvillkor`. The app stores them in Pyramid (SQLite), creates the company in Shopify with `companyCreate`, then calls `metafieldsSet` with `ownerId` = the new company GID and one entry per non-empty value (type `single_line_text_field`, namespace `custom`).
2. **When updating a company:** To change metafields on an existing Shopify company, call the GraphQL `metafieldsSet` mutation with the company’s GID as `ownerId` and the same keys; values are overwritten. (This app does not expose an update-company endpoint; you can add one that calls `setCompanyMetafields` in `services/shopify.js`.)

**Endpoint**

- `POST /admin/api/{version}/graphql.json` (same as other GraphQL Admin API calls)

**Mutation**

```graphql
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key namespace value }
    userErrors { field message code }
  }
}
```

**MetafieldsSetInput (per metafield):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerId` | `ID!` | **yes** | Company GID, e.g. `gid://shopify/Company/1234567890`. |
| `namespace` | `String!` | **yes** | Use `"custom"` for these company metafields. |
| `key` | `String!` | **yes** | One of: `projekttyp`, `e_postfaktura`, `kundtyp`, `ansvarig_agent`, `saljare`, `leveransvillkor`. |
| `type` | `String!` | **yes** | Use `"single_line_text_field"` for text values. |
| `value` | `String!` | **yes** | The string value to store. |

- Maximum **25 metafields** per request. Omit any key you do not want to set (or send empty string to clear if the API allows).

**Example: create company metafields (full request body)**

After you have created a company and received e.g. `companyId: "gid://shopify/Company/1234567890"`, send:

```json
{
  "query": "mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id key namespace value } userErrors { field message code } } }",
  "variables": {
    "metafields": [
      {
        "ownerId": "gid://shopify/Company/1234567890",
        "namespace": "custom",
        "key": "projekttyp",
        "type": "single_line_text_field",
        "value": "Retail"
      },
      {
        "ownerId": "gid://shopify/Company/1234567890",
        "namespace": "custom",
        "key": "e_postfaktura",
        "type": "single_line_text_field",
        "value": "yes"
      },
      {
        "ownerId": "gid://shopify/Company/1234567890",
        "namespace": "custom",
        "key": "kundtyp",
        "type": "single_line_text_field",
        "value": "B2B"
      },
      {
        "ownerId": "gid://shopify/Company/1234567890",
        "namespace": "custom",
        "key": "ansvarig_agent",
        "type": "single_line_text_field",
        "value": "Agent A"
      },
      {
        "ownerId": "gid://shopify/Company/1234567890",
        "namespace": "custom",
        "key": "saljare",
        "type": "single_line_text_field",
        "value": "Sales 1"
      },
      {
        "ownerId": "gid://shopify/Company/1234567890",
        "namespace": "custom",
        "key": "leveransvillkor",
        "type": "single_line_text_field",
        "value": "DDP"
      }
    ]
  }
}
```

**Example: success response**

```json
{
  "data": {
    "metafieldsSet": {
      "metafields": [
        { "id": "gid://shopify/Metafield/111", "key": "projekttyp", "namespace": "custom", "value": "Retail" },
        { "id": "gid://shopify/Metafield/112", "key": "e_postfaktura", "namespace": "custom", "value": "yes" },
        { "id": "gid://shopify/Metafield/113", "key": "kundtyp", "namespace": "custom", "value": "B2B" },
        { "id": "gid://shopify/Metafield/114", "key": "ansvarig_agent", "namespace": "custom", "value": "Agent A" },
        { "id": "gid://shopify/Metafield/115", "key": "saljare", "namespace": "custom", "value": "Sales 1" },
        { "id": "gid://shopify/Metafield/116", "key": "leveransvillkor", "namespace": "custom", "value": "DDP" }
      ],
      "userErrors": []
    }
  }
}
```

**Used in this app**

- **`services/shopify.js`**: `setCompanyMetafields(companyIdGid, metafields)` builds a `MetafieldsSetInput` for each non-empty value (namespace `"custom"`, type `"single_line_text_field"`) and POSTs the `metafieldsSet` mutation to the GraphQL endpoint.
- Called from `createShopifyCompany` immediately after `companyCreate` when the company object has any of the six metafield values set. On failure, the company is still created; a warning is logged and the sync continues.

### 3) Assign customer as company contact (GraphQL Admin API, B2B)

**Endpoint**

- `POST /admin/api/{version}/graphql.json`

**Mutation**

- `companyAssignCustomerAsContact(customerId: ID!, companyId: ID!)`

**Used in**

```119:142:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/shopify.js
export async function assignCustomerToCompany(shopifyCustomerId, shopifyCompanyId) {
  const mutation = `
    mutation companyAssignCustomerAsContact($customerId: ID!, $companyId: ID!) {
      companyAssignCustomerAsContact(customerId: $customerId, companyId: $companyId) {
        companyContact { id }
        userErrors { field, message }
      }
    }
  `;
  // ...
}
```

**Variables**

- `customerId`: must be a **Customer GID** (`gid://shopify/Customer/...`)
- `companyId`: must be a **Company GID** (`gid://shopify/Company/...`)

The sync process ensures customer IDs are in GID form before calling this mutation (see the “How we store the ID” section above).

## Sync sequence (what happens on “Sync to Shopify”)

### Sync a single customer

The `/api/customers/:id/sync` route calls `syncCustomerToShopify(customerId)`:

```7:18:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/sync.js
export async function syncCustomerToShopify(customerId) {
  const c = pyramid.getCustomer(customerId);
  if (!c) throw new Error('Customer not found');
  if (c.status === 'synced') throw new Error('Customer already synced to Shopify');
  if (c.status !== 'approved') throw new Error('Customer must be approved before sync');

  const shopifyCustomer = await shopify.createShopifyCustomer(c);
  const gid = shopifyCustomer.id;
  const idStr = typeof gid === 'string' && gid.startsWith('gid://') ? gid : `gid://shopify/Customer/${shopifyCustomer.id}`;
  pyramid.markCustomerSynced(customerId, idStr);
  return { customer: pyramid.getCustomer(customerId), shopify_customer_id: idStr };
}
```

**Meaning**

- Only **approved** customers are synced.
- Shopify customer is created via REST.
- The stored ID is normalized to a GID so it can be used later in B2B GraphQL calls.

### Sync a company (and its approved customers)

The `/api/companies/:id/sync` route calls `syncCompanyToShopify(companyId)`:

```20:60:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/sync.js
export async function syncCompanyToShopify(companyId) {
  const company = pyramid.getCompany(companyId);
  if (!company) throw new Error('Company not found');
  if (company.status === 'synced') throw new Error('Company already synced to Shopify');
  if (company.status !== 'approved') throw new Error('Company must be approved before sync');

  const customers = pyramid.listCustomers('approved', companyId);
  let primaryContact = customers[0] || null;
  let shopifyCompanyId, shopifyLocationId;

  const result = await shopify.createShopifyCompany(company, primaryContact);
  shopifyCompanyId = result.companyId;
  shopifyLocationId = result.companyLocationId;

  pyramid.markCompanySynced(companyId, shopifyCompanyId, shopifyLocationId);

  for (const cust of customers) {
    // create REST customer (if needed), normalize to GID, then assign as contact (GraphQL)
    // ...
  }

  return { company: pyramid.getCompany(companyId), shopify_company_id: shopifyCompanyId };
}
```

**Meaning**

- Only **approved** companies are synced.
- First it creates the **Shopify B2B Company** (GraphQL).
- Then for each **approved** customer linked to the company:
  - If not already synced: create Shopify customer (REST), store its GID
  - Assign that customer as a company contact (GraphQL)

---

## Error handling behavior (important for ops)

- REST customer create:
  - Throws with HTTP status + raw response body
- GraphQL company/contact mutations:
  - Throws on:
    - non-2xx HTTP status
    - `userErrors[]`
    - GraphQL `errors[]`
- Company sync continues syncing remaining customers even if one customer fails; it logs:

```55:57:/Users/ajay/Downloads/Workspace/SDA/geggamoja/b2b/services/sync.js
} catch (err) {
  console.error(`Failed to sync customer ${cust.id} to Shopify:`, err.message);
}
```

---


## Partial order fulfillment (REST Admin API)

The app supports **partial fulfillment** of an order (fulfill only some line items) via Shopify's fulfillment order and fulfillment APIs. Implemented in **`services/fulfillment.js`** and demonstrated by **`scripts/partial-fulfill-order.js`**.

**Flow:** (1) Get fulfillment orders for the order → each has `id` and `line_items[]` with fulfillment-order line item `id` and `line_item_id`. (2) Create a fulfillment by sending `fulfillment_order_id` + `fulfillment_order_line_items` (id, quantity) for only the line items to fulfill.

**4) Get fulfillment orders:** `GET /admin/api/{version}/orders/{order_id}/fulfillment_orders.json` — used in `getFulfillmentOrders(orderId)`. Response: `fulfillment_orders[]` with `id` and `line_items[]` (`id` = fulfillment order line item id, `line_item_id` = order line item id).

**5) Create fulfillment:** `POST /admin/api/{version}/fulfillments.json` — used in `createFulfillment(lineItemsByFulfillmentOrder, options)`. Request: `fulfillment.line_items_by_fulfillment_order` = `[{ fulfillment_order_id, fulfillment_order_line_items: [{ id, quantity }] }]`. Omit `fulfillment_order_line_items` to fulfill all items. Optional: `tracking_info`, `notify_customer`. Response (201): `fulfillment` with `id`, `order_id`, `status`, `line_items`.

**How we did it:** `getFulfillmentOrders(orderId)`; `buildPartialFulfillmentPayload(fulfillmentOrders, orderLineItemIds)` to map order line item ids to the payload; `createFulfillment(...)`; `partialFulfillOrder(orderId, orderLineItemIds, options)` runs the full flow. Script: `node scripts/partial-fulfill-order.js`. Scopes: `read_merchant_managed_fulfillment_orders`, `write_merchant_managed_fulfillment_orders` (or equivalent).

---

## Variant metafields & “Continue selling when out of stock”

A separate guide for the Pyramid team covers **updating a product variant’s four custom metafields** and **enabling “Continue selling when out of stock”** in Shopify:

- **`docs/Variant_Metafields_And_Inventory.md`** – Variant metafields (`custom.moq`, `custom.variant_incoming_stock`, `custom.variant_incoming_stock_date`, `custom.variant_stock_tentative_date`), inventory policy (`CONTINUE`), and full request/response examples using `productVariantsBulkUpdate` and `metafieldsSet`.

---

## What this app does NOT do (yet)

If you want production-grade sync, you typically add:

- **Idempotency**: look up existing Shopify customers/companies before creating duplicates
- **Rate-limit handling**: Shopify has API limits; you may need backoff/retry on 429
- **Webhooks**: listen for Shopify customer/company updates
- **More customer fields**: tags, addresses, metafields, email marketing settings, etc.
- **Company catalogs/pricing**: price lists, catalogs, payment terms (Shopify B2B features)

