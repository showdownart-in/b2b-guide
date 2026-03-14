# Variant metafields & “Continue selling when out of stock” – Pyramid team guide

This document describes how to **update a product variant’s four custom metafields** and how to **enable “Continue selling when out of stock”** in Shopify via the Admin API. Use it when Pyramid (or your integration) needs to push variant-level data into Shopify.

---

## Table of contents

1. [The four variant metafields](#1-the-four-variant-metafields)
2. [Continue selling when out of stock](#2-continue-selling-when-out-of-stock)
3. [Option A: One mutation (metafields + inventory policy)](#3-option-a-one-mutation-metafields--inventory-policy)
4. [Option B: metafieldsSet + productVariantsBulkUpdate](#4-option-b-metafieldsset--productvariantsbulkupdate)
5. [Getting the variant and product IDs](#5-getting-the-variant-and-product-ids)
6. [Scopes and errors](#6-scopes-and-errors)
7. [Example script (run locally)](#7-example-script-run-locally)

---

## 1. The four variant metafields

These metafields are defined on **Product Variant** in your Shopify store (namespace `custom`):

| `namespace.key` | Name (example) | API type | Description |
|-----------------|----------------|----------|-------------|
| `custom.moq` | Moq (Minsta beställningskvantitet) | `single_line_text_field` | Minimum order quantity (text). |
| `custom.variant_incoming_stock` | Variant Incoming Stock | `single_line_text_field` | Incoming stock (text). |
| `custom.variant_incoming_stock_date` | Variant Incoming Stock Date | `date` | Incoming stock date (single date). |
| `custom.variant_stock_tentative_date` | Variant stock Tentative Date | `date` | Tentative stock date (single date). |

**Value format:**

- **Single line text:** any string.
- **Date:** ISO 8601 date string, e.g. `"2025-03-15"` (date only). For date-time use `date_time` and e.g. `"2025-03-15T10:00:00Z"`.

You can update these via the GraphQL Admin API (e.g. `metafieldsSet` or `productVariantsBulkUpdate`). The variant is identified by its **Product Variant GID**: `gid://shopify/ProductVariant/{id}`.

---

## 2. Continue selling when out of stock

“Continue selling when out of stock” is a **variant-level setting** in Shopify, not a metafield. In the API it is the **inventory policy**:

- **`DENY`** – Stop selling when out of stock (default).
- **`CONTINUE`** – Continue selling when out of stock (checkbox ticked).

To turn on “Continue selling when out of stock”, set the variant’s `inventoryPolicy` to **`CONTINUE`** using the GraphQL mutation **`productVariantsBulkUpdate`** (with the variant’s GID and the product’s GID).

---

## 3. Option A: One mutation (metafields + inventory policy)

You can update **both** the four metafields **and** the inventory policy in a **single** `productVariantsBulkUpdate` call.

**Endpoint:** `POST /admin/api/{version}/graphql.json`

**Mutation:**

```graphql
mutation UpdateVariantMetafieldsAndInventory(
  $productId: ID!,
  $variants: [ProductVariantsBulkInput!]!
) {
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
```

**Example variables** (one variant: set the 4 metafields and set “Continue selling when out of stock”):

```json
{
  "productId": "gid://shopify/Product/1234567890",
  "variants": [
    {
      "id": "gid://shopify/ProductVariant/9876543210",
      "inventoryPolicy": "CONTINUE",
      "metafields": [
        {
          "namespace": "custom",
          "key": "moq",
          "type": "single_line_text_field",
          "value": "10"
        },
        {
          "namespace": "custom",
          "key": "variant_incoming_stock",
          "type": "single_line_text_field",
          "value": "500"
        },
        {
          "namespace": "custom",
          "key": "variant_incoming_stock_date",
          "type": "date",
          "value": "2025-04-01"
        },
        {
          "namespace": "custom",
          "key": "variant_stock_tentative_date",
          "type": "date",
          "value": "2025-03-20"
        }
      ]
    }
  ]
}
```

**Example full request body (JSON):**

```json
{
  "query": "mutation UpdateVariantMetafieldsAndInventory($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { product { id } productVariants { id inventoryPolicy metafields(first: 10) { edges { node { namespace key value } } } } userErrors { field message } } }",
  "variables": {
    "productId": "gid://shopify/Product/1234567890",
    "variants": [
      {
        "id": "gid://shopify/ProductVariant/9876543210",
        "inventoryPolicy": "CONTINUE",
        "metafields": [
          { "namespace": "custom", "key": "moq", "type": "single_line_text_field", "value": "10" },
          { "namespace": "custom", "key": "variant_incoming_stock", "type": "single_line_text_field", "value": "500" },
          { "namespace": "custom", "key": "variant_incoming_stock_date", "type": "date", "value": "2025-04-01" },
          { "namespace": "custom", "key": "variant_stock_tentative_date", "type": "date", "value": "2025-03-20" }
        ]
      }
    ]
  }
}
```

**Example success response:**

```json
{
  "data": {
    "productVariantsBulkUpdate": {
      "product": { "id": "gid://shopify/Product/1234567890" },
      "productVariants": [
        {
          "id": "gid://shopify/ProductVariant/9876543210",
          "inventoryPolicy": "CONTINUE",
          "metafields": {
            "edges": [
              { "node": { "namespace": "custom", "key": "moq", "value": "10" } },
              { "node": { "namespace": "custom", "key": "variant_incoming_stock", "value": "500" } },
              { "node": { "namespace": "custom", "key": "variant_incoming_stock_date", "value": "2025-04-01" } },
              { "node": { "namespace": "custom", "key": "variant_stock_tentative_date", "value": "2025-03-20" } }
            ]
          }
        }
      ],
      "userErrors": []
    }
  }
}
```

- Omit any metafield you do not want to change; omit `inventoryPolicy` if you only want to update metafields.
- For multiple variants, add more objects to the `variants` array (each with its own `id`, optional `inventoryPolicy`, and optional `metafields`).

---

## 4. Option B: metafieldsSet + productVariantsBulkUpdate

If you prefer to keep metafields and inventory policy in separate steps:

### Step 1 – Set variant metafields (`metafieldsSet`)

Use the variant GID as `ownerId`. You can send up to 25 metafields per request.

**Mutation:**

```graphql
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key namespace value }
    userErrors { field message code }
  }
}
```

**Example variables:**

```json
{
  "metafields": [
    {
      "ownerId": "gid://shopify/ProductVariant/9876543210",
      "namespace": "custom",
      "key": "moq",
      "type": "single_line_text_field",
      "value": "10"
    },
    {
      "ownerId": "gid://shopify/ProductVariant/9876543210",
      "namespace": "custom",
      "key": "variant_incoming_stock",
      "type": "single_line_text_field",
      "value": "500"
    },
    {
      "ownerId": "gid://shopify/ProductVariant/9876543210",
      "namespace": "custom",
      "key": "variant_incoming_stock_date",
      "type": "date",
      "value": "2025-04-01"
    },
    {
      "ownerId": "gid://shopify/ProductVariant/9876543210",
      "namespace": "custom",
      "key": "variant_stock_tentative_date",
      "type": "date",
      "value": "2025-03-20"
    }
  ]
}
```

### Step 2 – Set “Continue selling when out of stock” (`productVariantsBulkUpdate`)

Use the **product** GID and the variant’s GID with `inventoryPolicy: CONTINUE`:

```json
{
  "productId": "gid://shopify/Product/1234567890",
  "variants": [
    {
      "id": "gid://shopify/ProductVariant/9876543210",
      "inventoryPolicy": "CONTINUE"
    }
  ]
}
```

Same mutation as in Option A, but with only `productId` and `variants[].id` + `variants[].inventoryPolicy` (no `metafields`).

---

## 5. Getting the variant and product IDs

- **Variant GID:** `gid://shopify/ProductVariant/{numeric_id}`  
- **Product GID:** `gid://shopify/Product/{numeric_id}`  

You need both for `productVariantsBulkUpdate` (product ID + variant ID in the `variants` array). For `metafieldsSet` you only need the variant GID as `ownerId`.

Ways to get them:

- **GraphQL:** Query `product(id: $productId)` and then `product.variants.edges[].node.id` (and product’s `id`). Or use `productVariant` by id if you already have the variant GID.
- **REST (legacy):** `GET /admin/api/{version}/products/{product_id}.json` – response includes `product.variants[].id` (numeric). Prefix with `gid://shopify/ProductVariant/` for the variant GID and use `product.id` for the product GID.

Example GraphQL query to list variants and product id:

```graphql
query getProductWithVariants($productId: ID!) {
  product(id: $productId) {
    id
    variants(first: 100) {
      edges { node { id } }
    }
  }
}
```

---

## 6. Scopes and errors

- **productVariantsBulkUpdate:** requires `write_products` (and appropriate variant update permission).
- **metafieldsSet:** requires the same access as mutating the owner resource (e.g. `write_products` for variant metafields).

**Errors:**

- Check `userErrors` in the mutation response. Fix any `field` / `message` before retrying.
- For `metafieldsSet`, ensure `type` matches the metafield definition (e.g. `date` for date-only, `single_line_text_field` for text).
- For dates, use ISO 8601 strings; for `date` type, `"YYYY-MM-DD"` is sufficient.

---

## Summary for Pyramid

| Goal | API | Key input |
|------|-----|-----------|
| Update the 4 variant metafields | `productVariantsBulkUpdate` (with `metafields`) or `metafieldsSet` | Variant GID; namespace `custom`; keys: `moq`, `variant_incoming_stock`, `variant_incoming_stock_date`, `variant_stock_tentative_date`; types: `single_line_text_field` or `date`; value as string. |
| Enable “Continue selling when out of stock” | `productVariantsBulkUpdate` | Product GID + variant GID + `inventoryPolicy: "CONTINUE"`. |

**Recommended:** Use **Option A** (one `productVariantsBulkUpdate` with both `metafields` and `inventoryPolicy: CONTINUE`) so Pyramid can update a variant’s metafields and inventory policy in a single call.

---

## 7. Example script (run locally)

The repo includes a script that calls the GraphQL API with your `.env` Shopify credentials. From the project root:

```bash
node scripts/update-variant-metafields-and-inventory.js --product-id=1234567890 --variant-id=9876543210
```

**Required:**

- `--product-id` – Product ID (numeric or full GID).
- `--variant-id` – Variant ID (numeric or full GID).

**Optional metafields** (omit to leave unchanged):

- `--moq=10`
- `--variant-incoming-stock=500`
- `--variant-incoming-stock-date=2025-04-01`
- `--variant-stock-tentative-date=2025-03-20`

**Optional:**

- `--continue-selling=true` (default) – Set variant to “Continue selling when out of stock”. Use `--continue-selling=false` to skip this.

**Example with all fields:**

```bash
node scripts/update-variant-metafields-and-inventory.js \
  --product-id=1234567890 \
  --variant-id=9876543210 \
  --moq=10 \
  --variant-incoming-stock=500 \
  --variant-incoming-stock-date=2025-04-01 \
  --variant-stock-tentative-date=2025-03-20 \
  --continue-selling=true
```

Requires `.env` with `SHOPIFY_SHOP_URL` and `SHOPIFY_ACCESS_TOKEN`. The script uses `productVariantsBulkUpdate` (Option A) in one call.
