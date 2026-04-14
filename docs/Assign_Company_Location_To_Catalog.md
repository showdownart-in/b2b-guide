# Assign company location to a catalog (Pyramid guide)

This guide explains how to assign a Shopify **Company Location** to a **Catalog** using Shopify APIs.

The script in this repo is only a **reference/template implementation**:

- `scripts/assign-company-location-to-catalog.js`

Default catalog in the script is `76975472779`, which stands for **Sverige B2B**.
Company locations should be linked to this catalog.

---

## What this does

When a company is created/synced in Shopify B2B, it gets a `companyLocationId`.
This script assigns that location to a catalog by calling Shopify GraphQL mutation:

- `catalogContextUpdate`

It adds the location under:

- `contextsToAdd.companyLocationIds`

This is the key requirement for Pyramid:

- Link each relevant company location to catalog `76975472779` (**Sverige B2B**).

---

## Prerequisites

1. `.env` is configured with:
   - `SHOPIFY_SHOP_URL`
   - `SHOPIFY_ACCESS_TOKEN`
   - `SHOPIFY_API_VERSION` (optional, default used by script)

2. App token has permissions to edit catalogs/contexts (typically `write_products` + catalog permissions in Shopify admin).

---

### Required Shopify inputs

Use one of these ways to get company location:

- **`companyLocationId`** directly (best if already available in your Pyramid flow), or
- **`companyId`** then query Shopify for location (`company(id) -> locations(first: 1)`).

Catalog target:

- **Sverige B2B catalog id:** `76975472779`
- Catalog GID format: `gid://shopify/Catalog/76975472779`

### API call sequence

1. Resolve company location ID (if you only have company ID):
   - Query `company(id)` and read `locations(first: 1)`.
2. Call `catalogContextUpdate` with:
   - `catalogId = gid://shopify/Catalog/76975472779`
   - `contextsToAdd.companyLocationIds = [gid://shopify/CompanyLocation/{id}]`

---

## ID formats supported

The script accepts numeric IDs or full GIDs.

- Catalog:
  - Numeric: `76975472779`
  - GID: `gid://shopify/Catalog/76975472779`
- Company location:
  - Numeric: `1234567890`
  - GID: `gid://shopify/CompanyLocation/1234567890`

The script auto-converts numeric IDs to GID format before calling GraphQL.

---

## Usage examples (Used in the template App)

### 1) Assign using local company id (recommended in this app)

```bash
node scripts/assign-company-location-to-catalog.js --company-id=1
```

This looks up `company.id=1` in local DB, reads `shopify_location_id`, and assigns that location to catalog `76975472779` (**Sverige B2B**).

### 2) Assign using direct Shopify company location id

```bash
node scripts/assign-company-location-to-catalog.js --company-location-id=gid://shopify/CompanyLocation/9876543210
```

### 3) Assign using Shopify company id directly

```bash
node scripts/assign-company-location-to-catalog.js --shopify-company-id=2390327546
```

This resolves `gid://shopify/Company/2390327546`, fetches its first location from Shopify, then assigns that location to the **Sverige B2B** catalog.

### 4) Assign to a different catalog

```bash
node scripts/assign-company-location-to-catalog.js   --company-id=1   --catalog-id=76975472779
```

### 5) npm shortcut

```bash
npm run assign:catalog -- --company-id=1
```

---

## GraphQL mutation used

Endpoint:

- `POST https://{shop}/admin/api/{version}/graphql.json`

Mutation:

```graphql
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
```

Variables shape used by script:

```json
{
  "catalogId": "gid://shopify/Catalog/76975472779",
  "contextsToAdd": {
    "companyLocationIds": [
      "gid://shopify/CompanyLocation/9876543210"
    ]
  }
}
```

---

## Success output

On success, script prints:

- `catalogId`
- `companyLocationId`
- returned catalog object (`id`, `title`)

Example:

```json
{
  "catalogId": "gid://shopify/Catalog/76975472779",
  "companyLocationId": "gid://shopify/CompanyLocation/9876543210",
  "catalog": {
    "id": "gid://shopify/Catalog/76975472779",
    "title": "B2B Catalog"
  }
}
```

---

## Common errors and fixes

- **`Required: pass one of --company-id, --shopify-company-id, or --company-location-id`**
  - Pass one valid source for company location.

- **`Company not found in Pyramid DB`**
  - Local company id doesn’t exist in SQLite DB.

- **`has no shopify_location_id`**
  - Company is not synced yet; sync to Shopify first, or pass `--company-location-id` directly.

- **`No company location found for Shopify company ...`**
  - The Shopify company exists but has no location yet.

- **GraphQL userErrors about catalog/location**
  - Verify catalog exists and belongs to the same store.
  - Verify company location ID is valid.
  - Verify token scopes and user permissions for catalogs.

---

## Recommended flow in your integration

1. Create/sync company in Shopify.
2. Read returned `companyLocationId`.
3. Immediately call this script logic (or same mutation in backend) to add location to catalog `76975472779` (**Sverige B2B**).

This gives you an effectively “direct” assignment right after company creation.

---

## Script option (template only, use if helpful)

If Pyramid team wants a quick runnable example, this repo provides:

- `scripts/assign-company-location-to-catalog.js`

Script input options:

- `--company-id=<local_company_id>`
  - Reads `shopify_location_id` from this app's local SQLite DB (`companies.shopify_location_id`).
- `--shopify-company-id=<shopify_company_id_or_gid>`
  - Resolves first location via Shopify GraphQL.
- `--company-location-id=<shopify_company_location_id_or_gid>`
  - Uses direct location ID.
- `--catalog-id=<catalog_id_or_gid>` (optional)
  - Defaults to `76975472779` (**Sverige B2B**).

Important:

- This script is a template/example from this app.
- Pyramid can implement the same Shopify API calls in its own technology stack.
