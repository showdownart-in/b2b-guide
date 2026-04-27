# Create customer with email marketing subscribed (Pyramid guide)

This guide shows how to create a customer in Shopify with **email marketing already subscribed** in the same create call.

This avoids an additional consent-update API call.

---

## API-first approach (recommended)

Pyramid can implement this in any tech stack via Shopify REST Admin API customer create endpoint.

### Endpoint

- `POST https://{shop}/admin/api/{version}/customers.json`

### Required fields

- `customer.first_name`
- `customer.last_name`
- `customer.email`

### Marketing consent at create time

Set these under `customer.email_marketing_consent`:

- `state`: `"subscribed"`
- `opt_in_level`: `"single_opt_in"` or `"confirmed_opt_in"`
- `consent_updated_at`: current ISO datetime string

### Example request body

```json
{
  "customer": {
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@acme.com",
    "phone": "+46701234567",
    "verified_email": true,
    "email_marketing_consent": {
      "state": "subscribed",
      "opt_in_level": "single_opt_in",
      "consent_updated_at": "2026-03-06T12:00:00Z"
    }
  }
}
```

### Example success response (shape)

```json
{
  "customer": {
    "id": 1234567890,
    "email": "jane@acme.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "email_marketing_consent": {
      "state": "subscribed",
      "opt_in_level": "single_opt_in",
      "consent_updated_at": "2026-03-06T12:00:00Z"
    }
  }
}
```

---

## Script option (template only)

This repo includes a sample script:

- `scripts/create-customer-with-email-marketing.js`

### Usage

```bash
node scripts/create-customer-with-email-marketing.js   --email=jane@acme.com   --first-name=Jane   --last-name=Doe
```

Optional:

```bash
--phone=+46701234567
--opt-in-level=single_opt_in
--opt-in-level=confirmed_opt_in
```

Example:

```bash
node scripts/create-customer-with-email-marketing.js   --email=jane@acme.com   --first-name=Jane   --last-name=Doe   --phone=+46701234567   --opt-in-level=single_opt_in
```

---

## Common errors and fixes

- **Email already exists**
  - Shopify may reject create; use existing customer update flow instead.

- **Validation error on consent fields**
  - Ensure `state` and `opt_in_level` values are valid and lowercase as shown for REST payload.

- **Permission error**
  - Ensure app has `write_customers` scope.

---

## Recommended Pyramid flow

1. Create customer in Shopify with `email_marketing_consent.state = subscribed`.
2. Store returned Shopify customer ID/GID.
3. Skip separate marketing-consent update call unless needed for existing customers.
