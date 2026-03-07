import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '..', 'SHOPIFY_API.md');
let s = fs.readFileSync(docPath, 'utf8');

const insert = `
## Partial order fulfillment (REST Admin API)

The app supports **partial fulfillment** of an order (fulfill only some line items) via Shopify's fulfillment order and fulfillment APIs. Implemented in **\`services/fulfillment.js\`** and demonstrated by **\`scripts/partial-fulfill-order.js\`**.

**Flow:** (1) Get fulfillment orders for the order → each has \`id\` and \`line_items[]\` with fulfillment-order line item \`id\` and \`line_item_id\`. (2) Create a fulfillment by sending \`fulfillment_order_id\` + \`fulfillment_order_line_items\` (id, quantity) for only the line items to fulfill.

**4) Get fulfillment orders:** \`GET /admin/api/{version}/orders/{order_id}/fulfillment_orders.json\` — used in \`getFulfillmentOrders(orderId)\`. Response: \`fulfillment_orders[]\` with \`id\` and \`line_items[]\` (\`id\` = fulfillment order line item id, \`line_item_id\` = order line item id).

**5) Create fulfillment:** \`POST /admin/api/{version}/fulfillments.json\` — used in \`createFulfillment(lineItemsByFulfillmentOrder, options)\`. Request: \`fulfillment.line_items_by_fulfillment_order\` = \`[{ fulfillment_order_id, fulfillment_order_line_items: [{ id, quantity }] }]\`. Omit \`fulfillment_order_line_items\` to fulfill all items. Optional: \`tracking_info\`, \`notify_customer\`. Response (201): \`fulfillment\` with \`id\`, \`order_id\`, \`status\`, \`line_items\`.

**How we did it:** \`getFulfillmentOrders(orderId)\`; \`buildPartialFulfillmentPayload(fulfillmentOrders, orderLineItemIds)\` to map order line item ids to the payload; \`createFulfillment(...)\`; \`partialFulfillOrder(orderId, orderLineItemIds, options)\` runs the full flow. Script: \`node scripts/partial-fulfill-order.js\`. Scopes: \`read_merchant_managed_fulfillment_orders\`, \`write_merchant_managed_fulfillment_orders\` (or equivalent).

`;

const marker = '## Sync sequence (what happens on';
const i = s.indexOf(marker);
if (i === -1) throw new Error('Marker not found');
fs.writeFileSync(docPath, s.slice(0, i) + insert + s.slice(i));
console.log('Inserted partial fulfillment section');
