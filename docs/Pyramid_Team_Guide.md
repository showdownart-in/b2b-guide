# B2B Template App – Guide for Pyramid / CRM Team

**Purpose:** This template shows how we create **companies** and **customers** in Shopify and how we do **partial order fulfillment**. Use it as a reference for the Pyramid–Shopify integration.

---

## 1. What the template does

- **Company + customer onboarding:** One form collects company details and a primary contact. On “Approve & Sync to Shopify”, the app creates a B2B company in Shopify, creates the customer, and assigns the customer as a company contact.
- **Partial fulfillment:** A script and service demonstrate how to fulfill only some line items of an order (e.g. 2 of 3 items) using Shopify’s fulfillment order and fulfillment APIs.

---

## 2. How we create company and customer in Shopify

### High-level flow

1. User submits the form (company + primary contact).
2. The app creates the company and customer in the local “Pyramid” simulation (SQLite) and marks them approved.
3. The app then syncs to Shopify:
   - **Company** → Created via Shopify **GraphQL Admin API** (`companyCreate`). This creates the B2B company and optionally a company location (address).
   - **Customer** → Created via Shopify **REST Admin API** (`POST /admin/api/{version}/customers.json`).
   - **Link** → The customer is linked to the company as a contact via GraphQL (`companyAssignCustomerAsContact`).

### Important details

- **Companies** use the **GraphQL** B2B API and require a **Shopify Plus** store.
- **Customers** use the **REST** Admin API.
- **Country** in the form must be a **2-letter ISO code** (e.g. IN, US) or a full name that the app can map to a code.
- **State/Province** must be a **short code** (e.g. MH, NY), not a full name.

### Where to see the exact APIs

- **docs/FLOW_AND_API.md** – Full flow, request/response examples, and all required fields for `POST /api/onboard` and for the Shopify calls.
- **SHOPIFY_API.md** – Exact Shopify endpoints, request bodies, and how the app uses them.

---

## 3. How we do partial order fulfillment

### Flow

1. **Get fulfillment orders** for the order:  
   `GET /admin/api/{version}/orders/{order_id}/fulfillment_orders.json`  
   The response contains fulfillment order(s), each with `id` and `line_items[]`. Each line item has an `id` (fulfillment order line item id) and `line_item_id` (order line item id).

2. **Create a fulfillment** with only the line items you want to fulfill:  
   `POST /admin/api/{version}/fulfillments.json`  
   Request body includes `fulfillment.line_items_by_fulfillment_order`: for each fulfillment order, send `fulfillment_order_id` and `fulfillment_order_line_items` (array of `{ id, quantity }`). Only include the line items you are fulfilling. Omit `fulfillment_order_line_items` to fulfill all items of that order.

### In this template

- **services/fulfillment.js** – `getFulfillmentOrders(orderId)`, `buildPartialFulfillmentPayload(...)`, `createFulfillment(...)`, and `partialFulfillOrder(orderId, orderLineItemIds, options)`.
- **scripts/partial-fulfill-order.js** – Example that partially fulfills a sample order (e.g. first two line items). Run: `node scripts/partial-fulfill-order.js`.
- **docs/FLOW_AND_API.md** – Section “Partial order fulfillment” with request/response examples.  
- **SHOPIFY_API.md** – Section “Partial order fulfillment (REST Admin API)” with the same APIs explained.

---

## 4. Running the template

1. Clone the repository (URL provided separately).
2. Copy the provided `.env` (or `.env.example`) into the project root as `.env`. Set at least:
   - `SHOPIFY_SHOP_URL` – e.g. `https://your-store.myshopify.com`
   - `SHOPIFY_ACCESS_TOKEN` – Admin API access token with customer and B2B company scopes (and fulfillment scopes for partial fulfillment).
3. Run `npm install` then `npm start`.
4. Open **http://localhost:3000** and use the onboarding form. After syncing, check your Shopify admin to see the new company and customer.

---

## 5. Documentation in the repo

| Document | Contents |
|----------|----------|
| **README.md** | Quick start, environment variables, project structure. |
| **docs/FLOW_AND_API.md** | End-to-end flow, `POST /api/onboard` request/response, all Shopify APIs used (customer, company, assign contact, fulfillment), validation rules. |
| **SHOPIFY_API.md** | Shopify-only reference: endpoints, request bodies, and how the app uses them (including partial fulfillment). |

---

## 6. Summary

- **Company + customer:** One form → app creates company and customer in Shopify (GraphQL company + REST customer + GraphQL assign contact). See **docs/FLOW_AND_API.md** and **SHOPIFY_API.md** for exact APIs and bodies.
- **Partial fulfillment:** Get fulfillment orders for the order, then POST a fulfillment with only the desired `fulfillment_order_line_items`. See **scripts/partial-fulfill-order.js** and the “Partial order fulfillment” sections in the docs.

Use this template and the attached documentation to train the Pyramid/CRM team on creating companies and customers in Shopify and on partial order fulfillment. For full request/response examples and field-level detail, always refer to **docs/FLOW_AND_API.md** and **SHOPIFY_API.md** in the repository.
