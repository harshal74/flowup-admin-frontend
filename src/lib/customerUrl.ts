/**
 * Centralized customer-app URL generation.
 *
 * Avoids scattering the customer base URL and the slug path scheme across
 * components. The base comes from VITE_CUSTOMER_URL (e.g.
 * https://app.flowup.co.in in production, http://localhost:5174 in dev).
 *
 * Public URL scheme (root-level slug):
 *   https://app.flowup.co.in/<restaurantSlug>
 *
 * The customer frontend also supports a restaurantId query fallback for
 * restaurants that don't have a slug yet:
 *   https://app.flowup.co.in/?restaurant=<restaurantId>
 */

export const CUSTOMER_APP_URL: string =
  ((import.meta.env.VITE_CUSTOMER_URL as string) || 'http://localhost:5174').replace(/\/+$/, '');

/**
 * Staff / Waiter frontend base URL.
 *
 * Set VITE_WAITER_URL in the deployment environment:
 *   Dev:  http://localhost:5176  (default fallback)
 *   Prod: https://staff.flowup.co.in
 */
export const WAITER_APP_URL: string =
  ((import.meta.env.VITE_WAITER_URL as string) || 'http://localhost:5176').replace(/\/+$/, '');

interface UrlOpts {
  restaurantSlug?: string;
  restaurantId?: string;
}

/**
 * Build the public customer ordering URL for a restaurant (menu link, no table).
 * Table QR codes use buildTableQrUrl() instead.
 */
export function buildCustomerUrl({ restaurantSlug, restaurantId }: UrlOpts): string {
  if (restaurantSlug) {
    return `${CUSTOMER_APP_URL}/${encodeURIComponent(restaurantSlug)}`;
  }

  // Fallback: restaurantId as a query param (slug not set yet)
  if (restaurantId) {
    return `${CUSTOMER_APP_URL}/?restaurant=${encodeURIComponent(restaurantId)}`;
  }

  return CUSTOMER_APP_URL;
}

/**
 * Table QR code URL: https://<customer-app>/q/<qrToken>
 * The opaque token is resolved server-side to the restaurant + table, so the
 * table number can't be edited in the URL.
 */
export function buildTableQrUrl(qrToken: string): string {
  return `${CUSTOMER_APP_URL}/q/${encodeURIComponent(qrToken)}`;
}
