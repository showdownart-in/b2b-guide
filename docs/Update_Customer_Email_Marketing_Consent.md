# Update customer email marketing consent (Pyramid guide)

This guide explains how to make a customer **subscribed to email marketing** in Shopify.

Use Shopify GraphQL mutation:

- `customerEmailMarketingConsentUpdate`

This repo includes an example script, but Pyramid can call the same Shopify API from any tech stack.

---

## API-first implementation (recommended)

### Endpoint

- `POST https://{shop}/admin/api/{version}/graphql.json`

### Required input

- `customerId` (Shopify Customer GID):
  - `gid://shopify/Customer/{id}`

- `emailMarketingConsent`:
  - `marketingState`: `SUBSCRIBED`
  - `marketingOptInLevel`: `SINGLE_OPT_IN` or `CONFIRMED_OPT_IN`
  - `consentUpdatedAt`: current ISO datetime (e.g. `2026-03-06T12:00:00Z`)

### Mutation

```graphql
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
```

### Example variables

```json
{
  "input": {
    "customerId": "gid://shopify/Customer/1234567890",
    "emailMarketingConsent": {
      "marketingState": "SUBSCRIBED",
      "marketingOptInLevel": "SINGLE_OPT_IN",
      "consentUpdatedAt": "2026-03-06T12:00:00Z"
    }
  }
}
```

### Example success response (shape)

```json
{
  "data": {
    "customerEmailMarketingConsentUpdate": {
      "customer": {
        "id": "gid://shopify/Customer/1234567890",
        "email": "customer@example.com",
        "emailMarketingConsent": {
          "marketingState": "SUBSCRIBED",
          "marketingOptInLevel": "SINGLE_OPT_IN",
          "consentUpdatedAt": "2026-03-06T12:00:00Z"
        }
      },
      "userErrors": []
    }
  }
}
```

---

## Script option (template only)

Script path:

- `scripts/update-customer-email-marketing-consent.js`

### Usage

```bash
node scripts/update-customer-email-marketing-consent.js --customer-id=1234567890
```

or with GID:

```bash
node scripts/update-customer-email-marketing-consent.js --customer-id=gid://shopify/Customer/1234567890
```

Optional opt-in level:

```bash
node scripts/update-customer-email-marketing-consent.js --customer-id=1234567890 --opt-in-level=CONFIRMED_OPT_IN
```

The script sends:

- `marketingState: SUBSCRIBED`
- `marketingOptInLevel: SINGLE_OPT_IN` (default)
- `consentUpdatedAt: new Date().toISOString()`

---

## Common errors and fixes

- **Customer has no email**
  - Shopify requires customer email for email marketing consent.

- **No update but no explicit error**
  - `consentUpdatedAt` must not be older than existing consent timestamp. Use current timestamp.

- **Permission error**
  - Ensure app has `write_customers` scope.

---

## Recommended Pyramid flow

1. Ensure customer exists in Shopify and has email.
2. Call `customerEmailMarketingConsentUpdate` with `marketingState: SUBSCRIBED`.
3. Store/log the returned consent state (`SUBSCRIBED`) for audit.
