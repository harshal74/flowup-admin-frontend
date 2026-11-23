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
  table?: number;
}

/** Build the public customer ordering URL for a restaurant. */
export function buildCustomerUrl({ restaurantSlug, restaurantId, table }: UrlOpts): string {
  const q = table != null ? `?table=${encodeURIComponent(String(table))}` : '';

  if (restaurantSlug) {
    return `${CUSTOMER_APP_URL}/${encodeURIComponent(restaurantSlug)}${q}`;
  }

  // Fallback: restaurantId as a query param (slug not set yet)
  if (restaurantId) {
    const sep = table != null ? '&' : '';
    return `${CUSTOMER_APP_URL}/?restaurant=${encodeURIComponent(restaurantId)}${sep}${table != null ? `table=${encodeURIComponent(String(table))}` : ''}`;
  }

  return CUSTOMER_APP_URL;
}
