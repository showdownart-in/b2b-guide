# Required fields contract (Pyramid -> Shopify)

This document is based on live Shopify entities for your reference:

- Customer: `9412817420538`
- Company: `2720039162`
- Company Location: `3355934970`

Goal: remove confusion on which fields Pyramid must send when creating new customer/company/location records.

---

## 1) Live data snapshot (what is currently populated)

## Customer (id `9412817420538`)

Observed populated fields:

- `first_name`: `Manish`
- `last_name`: `Kumar`
- `email`: `mail.manish1989@gmail.com`
- `phone`: `+46701234568`
- `verified_email`: `true`
- `default_address.country`: `Sweden`
- `default_address.country_code`: `SE`
- `email_marketing_consent.state`: `subscribed`
- `email_marketing_consent.opt_in_level`: `single_opt_in`
- `email_marketing_consent.consent_updated_at`: populated

## Company (id `2720039162`)

Observed populated fields:

- `name`: `Manish Company`
- `locations[0].name`: `Stockholm Arlanda Airport (ARN)`
- `locations[0].locale`: `en`

## Company Location (id `3355934970`)

Observed populated fields:

- `name`: `Stockholm Arlanda Airport (ARN)`
- `locale`: `en`
- `shippingAddress.address1`: `Stockholm Arlanda Airport (ARN)`
- `shippingAddress.city`: `Stockholm-Arlanda`
- `shippingAddress.countryCode`: `SE`
- `shippingAddress.zip`: `190 45`
- `shippingAddress.recipient`: `Manish Company`
- `shippingAddress.firstName`: `Manish`
- `shippingAddress.lastName`: `Kumar`
- `shippingAddress.phone`: `+46701234568`
- `billingAddress`: same values as shipping address
- `catalogs`: empty (no catalog linked yet)

---

## 2) Pyramid required fields contract (enforced by business process)

Even if Shopify API allows fewer fields, Pyramid should treat the following as **mandatory input contract** for consistent B2B setup.

## Customer create: required

- `first_name`
- `last_name`
- `email`
- `phone`
- `country_code` (recommended: `SE` for Sweden)
- `email_marketing_consent.state` = `subscribed`
- `email_marketing_consent.opt_in_level` = `single_opt_in` (or `confirmed_opt_in`)
- `email_marketing_consent.consent_updated_at` (ISO datetime)

## Company create: required

- `company.name`

## Company location create (inside companyCreate): required

- `companyLocation.name`
- `companyLocation.locale` (example `en`)
- `companyLocation.shippingAddress.address1`
- `companyLocation.shippingAddress.city`
- `companyLocation.shippingAddress.countryCode` (example `SE`)
- `companyLocation.shippingAddress.zip`
- `companyLocation.shippingAddress.recipient`  (Keep company name as `recipient`)
- `companyLocation.shippingAddress.firstName`
- `companyLocation.shippingAddress.lastName`
- `companyLocation.shippingAddress.phone`
- `companyLocation.billingAddress` (same structure as shipping)

## Post-create mandatory action

- Assign company location to **Sverige B2B catalog**: `76975472779`

---

## 3) API sample calls (use these in Pyramid stack)

## A) Create customer with email marketing subscribed (REST)

Endpoint:

- `POST /admin/api/{version}/customers.json`

Request body:

```json
{
  "customer": {
    "first_name": "Manish",
    "last_name": "Kumar",
    "email": "mail.manish1989@gmail.com",
    "phone": "+46701234568",
    "verified_email": true,
    "addresses": [
      {
        "first_name": "Manish",
        "last_name": "Kumar",
        "country_code": "SE"
      }
    ],
    "email_marketing_consent": {
      "state": "subscribed",
      "opt_in_level": "single_opt_in",
      "consent_updated_at": "2026-03-06T12:00:00Z"
    }
  }
}
```

Minimum response fields to store:

- `customer.id` (numeric)
- `customer.admin_graphql_api_id` (GID)
- `customer.email`

---

## B) Create company + location (GraphQL)

Endpoint:

- `POST /admin/api/{version}/graphql.json`

Mutation:

```graphql
mutation companyCreate($input: CompanyCreateInput!) {
  companyCreate(input: $input) {
    company {
      id
      locations(first: 1) {
        edges { node { id name } }
      }
    }
    userErrors { field message }
  }
}
```

Variables:

```json
{
  "input": {
    "company": {
      "name": "Manish Company"
    },
    "companyLocation": {
      "name": "Stockholm Arlanda Airport (ARN)",
      "locale": "en",
      "shippingAddress": {
        "address1": "Stockholm Arlanda Airport (ARN)",
        "city": "Stockholm-Arlanda",
        "countryCode": "SE",
        "zip": "190 45",
        "recipient": "Manish Company",
        "firstName": "Manish",
        "lastName": "Kumar",
        "phone": "+46701234568"
      },
      "billingAddress": {
        "address1": "Stockholm Arlanda Airport (ARN)",
        "city": "Stockholm-Arlanda",
        "countryCode": "SE",
        "zip": "190 45",
        "recipient": "Manish Company",
        "firstName": "Manish",
        "lastName": "Kumar",
        "phone": "+46701234568"
      }
    }
  }
}
```

Store from response:

- `company.id` (Company GID)
- `company.locations.edges[0].node.id` (Company Location GID)

---

## C) Assign customer as company contact (GraphQL)

```graphql
mutation assignContact($customerId: ID!, $companyId: ID!) {
  companyAssignCustomerAsContact(customerId: $customerId, companyId: $companyId) {
    companyContact { id }
    userErrors { field message }
  }
}
```

Variables:

```json
{
  "customerId": "gid://shopify/Customer/9412817420538",
  "companyId": "gid://shopify/Company/2720039162"
}
```

---

## D) Assign company location to Sverige B2B catalog (GraphQL)

Catalog target:

- `76975472779` (Sverige B2B)

Mutation:

```graphql
mutation catalogContextUpdate($catalogId: ID!, $contextsToAdd: CatalogContextInput!) {
  catalogContextUpdate(catalogId: $catalogId, contextsToAdd: $contextsToAdd) {
    catalog { id title }
    userErrors { field message }
  }
}
```

Variables:

```json
{
  "catalogId": "gid://shopify/Catalog/76975472779",
  "contextsToAdd": {
    "companyLocationIds": ["gid://shopify/CompanyLocation/3355934970"]
  }
}
```

---

## 4) Pyramid implementation checklist

For every new Pyramid onboarding record:

1. Create customer with email marketing already subscribed.
2. Create company with full location (shipping + billing fields).
3. Assign customer as company contact.
4. Assign created location to catalog `76975472779` (Sverige B2B).
5. Persist Shopify GIDs in Pyramid for traceability.

This should be treated as the standard creation contract across environments.
