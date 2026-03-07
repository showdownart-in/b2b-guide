# B2B onboarding flow & API reference

This document describes the end-to-end flow for creating companies and customers in Shopify from this app, including request/response shapes for our APIs and the underlying Shopify APIs.

---

## Table of contents

1. [High-level flow](#1-high-level-flow)
2. [App API: single-step onboard](#2-app-api-single-step-onboard)
3. [Shopify REST API: create customer](#3-shopify-rest-api-create-customer)
4. [Shopify GraphQL API: create company (B2B)](#4-shopify-graphql-api-create-company-b2b)
5. [Shopify GraphQL API: assign customer as company contact](#5-shopify-graphql-api-assign-customer-as-company-contact)
6. [Sequence: what happens on “Approve & Sync to Shopify”](#6-sequence-what-happens-on-approve--sync-to-shopify)
7. [Validation & field rules](#7-validation--field-rules)
8. [Environment & authentication](#8-environment--authentication)
9. [Partial order fulfillment](#9-partial-order-fulfillment)

---

## 1. High-level flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User fills form (company + primary contact)                                 │
│  → Clicks "Approve & Sync to Shopify"                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  App (Pyramid simulation)                                                    │
│  1. Create company in SQLite                                                 │
│  2. Create customer in SQLite (linked to company)                           │
│  3. Mark company and customer as approved                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shopify                                                                     │
│  4. Create B2B company (GraphQL companyCreate)                              │
│  5. Create customer (REST POST /customers.json)                             │
│  6. Assign customer as company contact (GraphQL companyAssignCustomer...)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Pyramid** is simulated in this app (SQLite). In production you would call the real Pyramid CRM to create/approve, then sync to Shopify.
- **Shopify**: Companies use the **GraphQL Admin API** (B2B); customers use the **REST Admin API**. Assigning a customer to a company uses GraphQL.

---

## 2. App API: single-step onboard

This is the main entry point used by the single form in the UI.

### Endpoint

```
POST /api/onboard
Content-Type: application/json
```

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company` | object | yes | Company payload (see below). |
| `company.name` | string | **yes** | Company name. |
| `company.email` | string | no | Company email. |
| `company.phone` | string | no | Company phone. |
| `company.external_id` | string | no | External reference (e.g. Pyramid ID). |
| `company.address_line1` | string | no | Street address. |
| `company.address_city` | string | no | City. |
| `company.address_province` | string | no | State/region **code** (e.g. `MH`, `NY`). |
| `company.address_country` | string | no | Country name or **2-letter code** (e.g. `India`, `IN`). |
| `company.address_zip` | string | no | ZIP / postal code. |
| `customer` | object | yes | Primary contact (customer) payload. |
| `customer.first_name` | string | **yes** | Contact first name. |
| `customer.last_name` | string | **yes** | Contact last name. |
| `customer.email` | string | **yes** | Contact email. |
| `customer.phone` | string | no | Contact phone. |
| `customer.role` | string | no | Role (e.g. Buyer). |

### Example request

```json
{
  "company": {
    "name": "Acme Corp",
    "email": "billing@acme.com",
    "phone": "+1 234 567 8900",
    "external_id": "PYR-123",
    "address_line1": "123 Main St",
    "address_city": "Mumbai",
    "address_province": "MH",
    "address_country": "IN",
    "address_zip": "400001"
  },
  "customer": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@acme.com",
    "phone": "+1 234 567 8901",
    "role": "Buyer"
  }
}
```

### Success response (201 Created)

```json
{
  "company": {
    "id": 1,
    "name": "Acme Corp",
    "email": "billing@acme.com",
    "status": "synced",
    "shopify_company_id": "gid://shopify/Company/1234567890",
    "shopify_location_id": "gid://shopify/CompanyLocation/9876543210",
    "created_at": "...",
    "updated_at": "..."
  },
  "customer": {
    "id": 1,
    "company_id": 1,
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@acme.com",
    "status": "synced",
    "shopify_customer_id": "gid://shopify/Customer/111222333",
    "created_at": "...",
    "updated_at": "..."
  },
  "shopify_company_id": "gid://shopify/Company/1234567890"
}
```

### Error response (400)

```json
{
  "error": "Human-readable error message"
}
```

Common errors: missing `company.name` or `customer.first_name` / `last_name` / `email`; Shopify validation (e.g. invalid country/zone code); Shopify API/network errors.

---

## 3. Shopify REST API: create customer

The app creates each customer in Shopify via the REST Admin API.

### Endpoint

```
POST https://{shop}/admin/api/{version}/customers.json
```

- `{shop}`: your store domain (e.g. `your-store.myshopify.com`).
- `{version}`: e.g. `2023-10` (from `SHOPIFY_API_VERSION`).

### Headers

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `X-Shopify-Access-Token` | Admin API access token |

### Request body

```json
{
  "customer": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@acme.com",
    "phone": "+1 234 567 8901",
    "verified_email": true
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `first_name` | string | yes | |
| `last_name` | string | yes | |
| `email` | string | yes | Must be unique. |
| `phone` | string | no | |
| `verified_email` | boolean | no | App sends `true`. |

### Success response (201)

```json
{
  "customer": {
    "id": 111222333,
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@acme.com",
    "phone": "+1 234 567 8901",
    "verified_email": true,
    "created_at": "2024-01-15T10:00:00-00:00",
    "updated_at": "2024-01-15T10:00:00-00:00",
    ...
  }
}
```

- **ID**: REST returns a numeric `id`. For GraphQL (e.g. assign to company), the app converts it to a GID: `gid://shopify/Customer/{id}`.

### Error response (4xx)

Body is JSON with an `errors` object or similar. The app surfaces this as a 400 with `error: "Shopify customer create failed: {status} {body}"`.

---

## 4. Shopify GraphQL API: create company (B2B)

B2B companies are created with the GraphQL Admin API. **Requires Shopify Plus.**

### Endpoint

```
POST https://{shop}/admin/api/{version}/graphql.json
```

Same headers as above.

### Mutation

```graphql
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
```

- Argument must be **`input`** (not `company`). Variable name can be `$input`.

### Variables: `CompanyCreateInput`

Top-level shape:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company` | `CompanyInput` | **yes** | Company attributes. |
| `companyLocation` | `CompanyLocationInput` | no | First location (name + address). |
| `companyContact` | `CompanyContactInput` | no | Optional initial contact (inline; not an existing customer ID). |

**CompanyInput** (what we send):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **yes** | Company name. |
| `externalId` | string | no | External reference. |
| `note` | string | no | Note (e.g. company email). |

**CompanyLocationInput** (location + address):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Location name (e.g. "Acme Corp (Primary)"). |
| `shippingAddress` | `CompanyAddressInput` | no | **Not** `address`; must be `shippingAddress`. |
| `billingSameAsShipping` | boolean | no | If true, billing = shipping. |

**CompanyAddressInput** (inside `shippingAddress`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address1` | string | no | Street address. |
| `city` | string | no | City. |
| `zoneCode` | string | no | Region **code** (e.g. `MH`, `ON`, `NY`). **Not** full name like "Maharashtra". |
| `countryCode` | string | no | **2-letter ISO** (e.g. `IN`, `US`). **Not** full name like "India". |
| `zip` | string | no | ZIP / postal code. |

**CompanyContactInput** (optional inline contact when creating company):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firstName` | string | no | |
| `lastName` | string | no | |
| `email` | string | no | |
| `phone` | string | no | |

### Example request body (JSON)

```json
{
  "query": "mutation companyCreate($input: CompanyCreateInput!) { companyCreate(input: $input) { company { id locations(first: 1) { edges { node { id } } } } userErrors { field, message } } }",
  "variables": {
    "input": {
      "company": {
        "name": "Acme Corp",
        "externalId": "PYR-123",
        "note": "Email: billing@acme.com"
      },
      "companyLocation": {
        "name": "Acme Corp (Primary)",
        "shippingAddress": {
          "address1": "123 Main St",
          "city": "Mumbai",
          "zoneCode": "MH",
          "countryCode": "IN",
          "zip": "400001"
        },
        "billingSameAsShipping": true
      },
      "companyContact": {
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@acme.com",
        "phone": "+1 234 567 8901"
      }
    }
  }
}
```

### Success response

```json
{
  "data": {
    "companyCreate": {
      "company": {
        "id": "gid://shopify/Company/1234567890",
        "locations": {
          "edges": [
            { "node": { "id": "gid://shopify/CompanyLocation/9876543210" } }
          ]
        }
      },
      "userErrors": []
    }
  }
}
```

- `company.id`: use as **Company GID** when assigning contacts.
- `company.locations.edges[0].node.id`: first location GID (stored as `shopify_location_id` in the app).

### Error response

- **GraphQL errors**: `data.companyCreate.userErrors[]` with `field`, `message` (and sometimes `code`).
- **HTTP errors**: non-2xx; body may contain `errors` or message text.

Example userErrors:

- `"Name must exist"` (company name required).
- `"Too many parameter values were provided"` (invalid or unexpected input shape).
- `"Zone code is invalid"` (use short code, e.g. `MH`, not "Maharashtra").
- `"Expected \"India\" to be one of: AF, AX, ... IN, US, ..."` (use 2-letter `countryCode`, e.g. `IN`).

---

## 5. Shopify GraphQL API: assign customer as company contact

After creating the customer in Shopify (REST), the app links them to the company with this mutation.

### Mutation

```graphql
mutation companyAssignCustomerAsContact($customerId: ID!, $companyId: ID!) {
  companyAssignCustomerAsContact(customerId: $customerId, companyId: $companyId) {
    companyContact { id }
    userErrors { field, message }
  }
}
```

### Variables

| Variable | Type | Description |
|----------|------|-------------|
| `customerId` | `ID!` | Customer **GID** (e.g. `gid://shopify/Customer/111222333`). |
| `companyId` | `ID!` | Company **GID** (e.g. `gid://shopify/Company/1234567890`). |

REST returns numeric customer `id`; the app converts it to `gid://shopify/Customer/{id}` before calling this mutation.

### Example request body

```json
{
  "query": "mutation companyAssignCustomerAsContact($customerId: ID!, $companyId: ID!) { companyAssignCustomerAsContact(customerId: $customerId, companyId: $companyId) { companyContact { id } userErrors { field, message } } }",
  "variables": {
    "customerId": "gid://shopify/Customer/111222333",
    "companyId": "gid://shopify/Company/1234567890"
  }
}
```

### Success response

```json
{
  "data": {
    "companyAssignCustomerAsContact": {
      "companyContact": {
        "id": "gid://shopify/CompanyContact/..."
      },
      "userErrors": []
    }
  }
}
```

---

## 6. Sequence: what happens on “Approve & Sync to Shopify”

When the user submits the single form and the app receives `POST /api/onboard`:

| Step | Action | API / layer |
|------|--------|-------------|
| 1 | Create company record | App (SQLite / Pyramid simulation) |
| 2 | Create customer record with `company_id` | App (SQLite) |
| 3 | Set company status to `approved` | App (SQLite) |
| 4 | Set customer status to `approved` | App (SQLite) |
| 5 | Call `syncCompanyToShopify(companyId)` | App → Shopify |
| 5a | Create B2B company (and optional location + inline contact) | GraphQL `companyCreate` |
| 5b | Store `shopify_company_id` and `shopify_location_id` on company | App (SQLite) |
| 5c | For each approved customer linked to company: | |
| 5c.i | Create customer in Shopify | REST `POST /customers.json` |
| 5c.ii | Convert numeric `id` to GID | App |
| 5c.iii | Mark customer as synced, store GID | App (SQLite) |
| 5c.iv | Assign customer to company | GraphQL `companyAssignCustomerAsContact` |
| 6 | Return company, customer, and `shopify_company_id` | App response |

If `companyCreate` is called with an optional `companyContact`, Shopify can create the first contact inline. The app also creates the customer via REST and then assigns them, so the contact is linked even when created separately.

---

## 7. Validation & field rules

### Country

- **Shopify** expects a **2-letter ISO 3166-1 alpha-2** code (e.g. `IN`, `US`, `GB`).
- The app normalizes common country names to codes (e.g. "India" → `IN`). Unsupported names are not sent; use a 2-letter code in the form if needed.

### State / province (zoneCode)

- **Shopify** expects a **short code** (e.g. `MH`, `NY`, `ON`), not full names ("Maharashtra", "New York").
- The app sends `zoneCode` only when the value matches `^[A-Za-z0-9]{2,3}$`; otherwise the field is omitted to avoid "Zone code is invalid".

### Address

- Company address is sent under **`companyLocation.shippingAddress`**, not `address`.
- Optional fields can be omitted; the app strips `undefined` before sending.

### Required for onboard

- **Company**: `name`.
- **Customer**: `first_name`, `last_name`, `email`.

---

## 8. Environment & authentication

### App (.env)

| Variable | Description |
|----------|-------------|
| `SHOPIFY_SHOP_URL` | Store URL (e.g. `https://your-store.myshopify.com`). |
| `SHOPIFY_ACCESS_TOKEN` | Admin API access token. |
| `SHOPIFY_API_VERSION` | Optional; default `2023-10`. |

### Shopify

- **REST**: token must have **`write_customers`** (and typically `read_customers`).
- **GraphQL B2B**: **Shopify Plus** and scopes that allow creating companies and assigning contacts (e.g. `write_companies` / B2B company permissions as per your app’s configuration).

All Shopify requests use the same token in the `X-Shopify-Access-Token` header.

---

## 9. Partial order fulfillment

To **partially fulfill** an order (e.g. fulfill only some line items), Shopify uses **fulfillment orders** and then **fulfillments**:

1. **Get fulfillment orders** for the order (each has `id` and `line_items` with fulfillment-order line item `id` and `line_item_id`).
2. **Create a fulfillment** by sending which fulfillment-order line items to fulfill (by their `id` and `quantity`).

The app provides `services/fulfillment.js` and a script `scripts/partial-fulfill-order.js` that partially fulfill the sample order (first two line items).

### Step 1: Get fulfillment orders (Shopify REST)

**Endpoint**

```
GET https://{shop}/admin/api/{version}/orders/{order_id}/fulfillment_orders.json
```

**Headers:** `Content-Type: application/json`, `X-Shopify-Access-Token: <token>`.

**Example:** Order id `6375063388299` (order #1012 from your JSON).

**Success response (200)**

```json
{
  "fulfillment_orders": [
    {
      "id": 1234567890,
      "order_id": 6375063388299,
      "status": "open",
      "assigned_location_id": 7689306251,
      "line_items": [
        {
          "id": 200000001,
          "fulfillment_order_id": 1234567890,
          "line_item_id": 15591501365387,
          "quantity": 1,
          "fulfillable_quantity": 1
        },
        {
          "id": 200000002,
          "fulfillment_order_id": 1234567890,
          "line_item_id": 15591501398155,
          "quantity": 1,
          "fulfillable_quantity": 1
        },
        {
          "id": 200000003,
          "fulfillment_order_id": 1234567890,
          "line_item_id": 15591501430923,
          "quantity": 1,
          "fulfillable_quantity": 1
        }
      ]
    }
  ]
}
```

- Use `line_items[].id` as the **fulfillment order line item id** when creating the fulfillment.
- `line_item_id` is the order’s line item id (from `order.line_items[].id`).

### Step 2: Create fulfillment (Shopify REST)

**Endpoint**

```
POST https://{shop}/admin/api/{version}/fulfillments.json
```

**Request body (partial: only some line items)**

```json
{
  "fulfillment": {
    "line_items_by_fulfillment_order": [
      {
        "fulfillment_order_id": 1234567890,
        "fulfillment_order_line_items": [
          { "id": 200000001, "quantity": 1 },
          { "id": 200000002, "quantity": 1 }
        ]
      }
    ],
    "tracking_info": {
      "number": "1Z999AA10123456784",
      "company": "UPS"
    },
    "notify_customer": false
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `line_items_by_fulfillment_order` | array | **yes** | One entry per fulfillment order you are fulfilling from. |
| `line_items_by_fulfillment_order[].fulfillment_order_id` | number | **yes** | From step 1. |
| `line_items_by_fulfillment_order[].fulfillment_order_line_items` | array | no | If omitted, **all** line items of that fulfillment order are fulfilled. For **partial**, pass only the items to fulfill. |
| `line_items_by_fulfillment_order[].fulfillment_order_line_items[].id` | number | **yes** | Fulfillment order line item `id` from step 1. |
| `line_items_by_fulfillment_order[].fulfillment_order_line_items[].quantity` | number | **yes** | Quantity to fulfill (min 1, max `fulfillable_quantity`). |
| `tracking_info` | object | no | `number`, `company`, `url`. |
| `notify_customer` | boolean | no | Whether to notify the customer. |

**Success response (201)**

```json
{
  "fulfillment": {
    "id": 9876543210,
    "order_id": 6375063388299,
    "status": "success",
    "created_at": "2026-03-07T20:00:00-05:00",
    "line_items": [
      { "id": 15591501365387, "quantity": 1, "fulfillment_status": "fulfilled" },
      { "id": 15591501398155, "quantity": 1, "fulfillment_status": "fulfilled" }
    ]
  }
}
```

After this, the order’s `fulfillment_status` can be `partial` (if some line items remain unfulfilled).

### App helper: `services/fulfillment.js`

- **`getFulfillmentOrders(orderId)`** — GET fulfillment orders for an order.
- **`buildPartialFulfillmentPayload(fulfillmentOrders, orderLineItemIds)`** — Builds `line_items_by_fulfillment_order` from the order’s **line item ids** (e.g. `[15591501365387, 15591501398155]`).
- **`createFulfillment(lineItemsByFulfillmentOrder, options)`** — POST create fulfillment (optional `tracking_number`, `tracking_company`, `tracking_url`, `notify_customer`).
- **`partialFulfillOrder(orderId, orderLineItemIds, options)`** — Gets fulfillment orders, builds payload for the given order line item ids, creates the fulfillment.

### Run the partial fulfillment script

For the order you provided (#1012, id `6375063388299`) with three line items, the script fulfills **only the first two** (UV-byxor Leo Rosa 74/80 and UV-dräkt Leo Rosa 62/68). The third (UV- Badbyxor Soft Beige 122/128) stays unfulfilled.

From project root:

```bash
node scripts/partial-fulfill-order.js
```

Requires `.env`: `SHOPIFY_SHOP_URL`, `SHOPIFY_ACCESS_TOKEN`. The script fetches fulfillment orders, then creates one fulfillment with only the first two order line item ids.

**Scopes:** Fulfillment APIs typically need `read_merchant_managed_fulfillment_orders` and `write_merchant_managed_fulfillment_orders` (or the third-party / assigned equivalents, depending on who creates the fulfillment).

---

## Quick reference: our app’s own routes

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/api/onboard` | Single-step: create company + customer (Pyramid), approve both, sync to Shopify. **Primary API for the form.** |
| `GET`  | `/api/companies` | List companies (optional `?status=`). |
| `POST` | `/api/companies` | Create company only (Pyramid). |
| `POST` | `/api/companies/:id/approve` | Approve company. |
| `POST` | `/api/companies/:id/sync` | Sync company (and its approved customers) to Shopify. |
| `GET`  | `/api/customers` | List customers (optional `?status=`, `?company_id=`). |
| `POST` | `/api/customers` | Create customer only (Pyramid). |
| `POST` | `/api/customers/:id/approve` | Approve customer. |
| `POST` | `/api/customers/:id/sync` | Sync single customer to Shopify. |

For the single-form flow, only **`POST /api/onboard`** is required; it performs create → approve → sync in one call.
