# B2B Pyramid → Shopify Sync (Sample App)

Sample application for **customer and company onboarding** with a Pyramid-style CRM flow: create in Pyramid → approve → sync to Shopify B2B.

## Flow

1. **Onboard** — Create companies and customers in the app (simulating Pyramid CRM).
2. **Approve** — Mark companies/customers as approved (simulating Pyramid approval).
3. **Sync** — On approval, sync to your B2B Shopify store:
   - **Companies** → Shopify B2B Company (GraphQL) with location and optional primary contact.
   - **Customers** → Shopify Customer (REST), then linked as company contacts when they belong to a company.

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:3000**. You can create companies and customers, approve them, and sync to Shopify (once Shopify is configured).

## Shopify API documentation

- **Flow & API reference:** See **`docs/FLOW_AND_API.md`** for a full guide: app flow, `POST /api/onboard` request/response, and the underlying Shopify REST (create customer) and GraphQL (create company, assign contact) calls with required bodies and responses.
- **Shopify calls only:** See `SHOPIFY_API.md` for a focused breakdown of the Shopify REST + GraphQL calls.
- **Variant metafields & inventory:** See **`docs/Variant_Metafields_And_Inventory.md`** for how to update a variant’s four custom metafields (`moq`, `variant_incoming_stock`, `variant_incoming_stock_date`, `variant_stock_tentative_date`) and enable “Continue selling when out of stock” (Pyramid team guide with samples).

### React frontend (development)

From the project root:

```bash
npm start          # Terminal 1: backend on :3000
npm run dev:client # Terminal 2: Vite dev server on :5173 (proxies /api to backend)
```

Open **http://localhost:5173** for the React app with hot reload. To build the React app into `public/` for production: `npm run build`, then `npm start`.

## Environment

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3000`) |
| `DB_PATH` | SQLite file for Pyramid data (default `./pyramid.db`) |
| `SHOPIFY_SHOP_URL` | Your Shopify store URL (e.g. `https://your-store.myshopify.com`) |
| `SHOPIFY_ACCESS_TOKEN` | Admin API access token with `read_customers`, `write_customers`, and B2B company scopes |
| `SHOPIFY_API_VERSION` | API version (e.g. `2023-10`) |

**Shopify B2B** (Companies) requires a **Shopify Plus** store and the appropriate API scopes. If you only set customer sync, you can still sync customers without creating companies.

## API

- **Single-step onboard:** `POST /api/onboard` — body: `{ company: {...}, customer: {...} }` — creates company + customer (Pyramid), approves both, syncs to Shopify. See `docs/FLOW_AND_API.md` for full request/response.
- **Companies:** `GET/POST /api/companies`, `GET /api/companies/:id`, `POST /api/companies/:id/approve`, `POST /api/companies/:id/sync`
- **Customers:** `GET/POST /api/customers`, `GET /api/customers/:id`, `POST /api/customers/:id/approve`, `POST /api/customers/:id/sync`

Query params: `?status=pending|approved|synced`, `?company_id=<id>` for customers.

## Project structure

```
├── server.js           # Express app
├── db.js               # SQLite schema (Pyramid simulation)
├── services/
│   ├── pyramid.js      # Company/customer CRUD and status
│   ├── shopify.js      # Shopify REST (customers) + GraphQL (B2B companies)
│   └── sync.js         # Approve → create in Shopify → mark synced
├── routes/
│   ├── companies.js
│   └── customers.js
├── client/             # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── Toast.jsx
│   │   └── components/
│   │       ├── CompanyForm.jsx, CompanyList.jsx
│   │       └── CustomerForm.jsx, CustomerList.jsx
│   └── index.html
└── public/             # Built React app (npm run build), served by Express
```

## Notes

- **Pyramid** is simulated in this app (SQLite + status workflow). In production you would replace this with real Pyramid API calls to create/approve and then sync to Shopify.
- **Company sync** creates a B2B company in Shopify and syncs all approved customers under that company as contacts. Approve the company first, then use “Sync to Shopify” on the company to create both company and contacts in one go.
- **Standalone customers** (no company) can be approved and synced individually; they are created as regular Shopify customers.
# b2b-guide
# b2b-guide
