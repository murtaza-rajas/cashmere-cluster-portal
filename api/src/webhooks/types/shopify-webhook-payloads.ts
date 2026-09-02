// Deliberately plain TypeScript interfaces, NOT class-validator DTOs. These bodies
// come from Shopify, not user input, and the app has a global ValidationPipe with
// forbidNonWhitelisted: true (main.ts) — if these were classes, any field Shopify
// sends that we haven't declared (which happens; Shopify's webhook payloads gain
// fields over API versions) would get the whole webhook rejected. Nest's
// ValidationPipe only validates when the parameter's reflected type is a class;
// a plain interface erases to `Object` at runtime, so it's passed through as-is.
// Field names here match Shopify's long-documented shape for these three mandatory
// compliance webhooks — worth re-confirming against a real delivery once the
// client's Shopify app exists, same caveat as the Customer Account API GraphQL
// fields in shopify-identity.provider.ts.

export interface ShopifyCustomersDataRequestPayload {
  shop_id: number;
  shop_domain: string;
  customer: { id: number; email?: string; phone?: string };
  orders_requested?: number[];
  data_request: { id: number };
}

export interface ShopifyCustomersRedactPayload {
  shop_id: number;
  shop_domain: string;
  customer: { id: number; email?: string; phone?: string };
  orders_to_redact?: number[];
}

export interface ShopifyShopRedactPayload {
  shop_id: number;
  shop_domain: string;
}

// orders/create and orders/updated share this same shape — used to keep
// MemberOrderCache in sync (see shopify-webhooks.service.ts). `name` is Shopify's
// own display order number (e.g. "#1001"), preferred over constructing one from
// `order_number` ourselves. `customer` is absent/null for guest checkouts not tied
// to a logged-in Shopify customer — those orders have no Member to attach to.
export interface ShopifyOrderPayload {
  id: number;
  name: string;
  total_price: string;
  currency: string;
  financial_status: string;
  created_at: string;
  customer?: { id: number } | null;
}
