/**
 * Partial (and full) order fulfillment via Shopify REST Admin API.
 * Uses FulfillmentOrder → Fulfillment flow: get fulfillment orders for an order,
 * then create a fulfillment for a subset of line items.
 */
import 'dotenv/config';

const SHOP = (process.env.SHOPIFY_SHOP_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';

const baseREST = `https://${SHOP}/admin/api/${API_VERSION}`;

const headers = () => ({
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': TOKEN,
});

/**
 * Get all fulfillment orders for an order.
 * @param {number} orderId - Shopify order ID (e.g. 6375063388299)
 * @returns {Promise<{ fulfillment_orders: Array }>}
 */
export async function getFulfillmentOrders(orderId) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }
  const res = await fetch(`${baseREST}/orders/${orderId}/fulfillment_orders.json`, {
    method: 'GET',
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shopify fulfillment orders failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Create a fulfillment for specific line items (partial or full).
 * @param {number} orderId - Shopify order ID
 * @param {Array<{ fulfillment_order_id: number, fulfillment_order_line_items: Array<{ id: number, quantity: number }> }>} lineItemsByFulfillmentOrder - from buildPartialFulfillmentPayload
 * @param {{ tracking_number?: string, tracking_company?: string, tracking_url?: string, notify_customer?: boolean }} [options]
 * @returns {Promise<{ fulfillment: object }>}
 */
export async function createFulfillment(lineItemsByFulfillmentOrder, options = {}) {
  if (!TOKEN || !SHOP || SHOP.includes('your-store')) {
    throw new Error('Shopify not configured: set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in .env');
  }
  const fulfillment = {
    line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
  };
  if (options.tracking_number || options.tracking_url || options.tracking_company) {
    fulfillment.tracking_info = {
      number: options.tracking_number,
      url: options.tracking_url,
      company: options.tracking_company,
    };
  }
  if (options.notify_customer != null) fulfillment.notify_customer = options.notify_customer;

  const res = await fetch(`${baseREST}/fulfillments.json`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ fulfillment }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shopify create fulfillment failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Build payload for partial fulfillment: fulfill only the line items at the given indices
 * (by order line_item id or by index in the first open fulfillment order).
 * @param {Array} fulfillmentOrders - from getFulfillmentOrders(orderId).fulfillment_orders
 * @param {Array<number>} orderLineItemIds - order line item ids to fulfill (e.g. [15591501365387, 15591501398155])
 * @returns {Array<{ fulfillment_order_id: number, fulfillment_order_line_items: Array<{ id: number, quantity: number }> }>} payload for createFulfillment
 */
export function buildPartialFulfillmentPayload(fulfillmentOrders, orderLineItemIds) {
  const idSet = new Set(orderLineItemIds);
  const out = [];

  for (const fo of fulfillmentOrders || []) {
    const lineItemsToFulfill = (fo.line_items || []).filter(
      (li) => idSet.has(li.line_item_id) && li.fulfillable_quantity > 0
    );
    if (lineItemsToFulfill.length === 0) continue;
    out.push({
      fulfillment_order_id: fo.id,
      fulfillment_order_line_items: lineItemsToFulfill.map((li) => ({
        id: li.id,
        quantity: Math.min(li.fulfillable_quantity, li.quantity),
      })),
    });
  }
  return out;
}

/**
 * Partially fulfill an order by order line item ids.
 * 1) Fetches fulfillment orders for the order.
 * 2) Builds payload for the given orderLineItemIds.
 * 3) Creates the fulfillment.
 * @param {number} orderId - Shopify order ID
 * @param {Array<number>} orderLineItemIds - order line item ids to fulfill (e.g. [15591501365387, 15591501398155])
 * @param {{ tracking_number?: string, tracking_company?: string, tracking_url?: string, notify_customer?: boolean }} [options]
 */
export async function partialFulfillOrder(orderId, orderLineItemIds, options = {}) {
  const { fulfillment_orders } = await getFulfillmentOrders(orderId);
  const payload = buildPartialFulfillmentPayload(fulfillment_orders, orderLineItemIds);
  if (payload.length === 0) {
    throw new Error('No fulfillable line items found for the given order line item ids. Check ids and fulfillable_quantity.');
  }
  return createFulfillment(payload, options);
}
