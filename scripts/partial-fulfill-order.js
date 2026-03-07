#!/usr/bin/env node
/**
 * Partially fulfill order #1012 (id 6375063388299).
 * Fulfills only the first two line items; the third remains unfulfilled.
 *
 * Usage (from project root):
 *   node scripts/partial-fulfill-order.js
 *
 * Requires .env: SHOPIFY_SHOP_URL, SHOPIFY_ACCESS_TOKEN
 */

import { partialFulfillOrder, getFulfillmentOrders } from '../services/fulfillment.js';

const ORDER_ID = 6375063388299;

// Order line item ids from the provided order JSON (first two = partial; all three = full)
const LINE_ITEM_IDS_PARTIAL = [
  15591501365387, // UV-byxor Leo Rosa - 74/80
  15591501398155, // UV-dräkt Leo Rosa - 62/68
];
// Third line item (leave unfulfilled for partial): 15591501430923 - UV- Badbyxor Soft Beige - 122/128

async function main() {
  console.log('Fetching fulfillment orders for order', ORDER_ID, '...');
  const { fulfillment_orders } = await getFulfillmentOrders(ORDER_ID);
  console.log('Fulfillment orders:', fulfillment_orders.length);
  fulfillment_orders.forEach((fo, i) => {
    console.log(
      `  ${i + 1}. id=${fo.id} status=${fo.status} line_items=${(fo.line_items || []).length}`
    );
    (fo.line_items || []).forEach((li) => {
      console.log(
        `     - line_item_id=${li.line_item_id} fulfillment_line_id=${li.id} fulfillable_quantity=${li.fulfillable_quantity}`
      );
    });
  });

  console.log('\nCreating partial fulfillment for line item ids:', LINE_ITEM_IDS_PARTIAL);
  const result = await partialFulfillOrder(ORDER_ID, LINE_ITEM_IDS_PARTIAL, {
    notify_customer: false,
    // optional: tracking_number: '1Z999AA10123456784', tracking_company: 'UPS',
  });

  console.log('\nFulfillment created:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nDone. Order is now partially fulfilled (2 of 3 line items).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
