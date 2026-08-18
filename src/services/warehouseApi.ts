import { fortnoxRequest } from "./api.js";

/**
 * Make a request against the Fortnox Warehouse API (/api/warehouse/...).
 *
 * The Warehouse API lives on the same host and uses the same OAuth token as
 * the classic /3/ API, but requires the Fortnox Lager (Warehouse) module to
 * be activated on the tenant and the "warehouse" OAuth scope. Errors are
 * augmented with a hint about this, since a 403 here usually means the
 * module is missing rather than a plain permission problem.
 */
export async function warehouseRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  data?: unknown,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  try {
    return await fortnoxRequest<T>(endpoint, method, data, params);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Permission denied") || error.message.includes("403"))) {
      throw new Error(
        `${error.message} Note: Warehouse endpoints require the Fortnox Lager (Warehouse) module ` +
        `to be activated for this company and the 'warehouse' OAuth scope. ` +
        `Use fortnox_get_warehouse_status to check activation.`
      );
    }
    throw error;
  }
}
