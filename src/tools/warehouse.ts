import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { warehouseRequest } from "../services/warehouseApi.js";
import { ResponseFormat } from "../constants.js";
import {
  buildToolResponse,
  buildErrorResponse,
  formatDetailMarkdown,
  formatRankingTable
} from "../services/formatters.js";
import {
  GetWarehouseStatusSchema,
  GetStockBalanceSchema,
  ListStockPointsSchema,
  GetStockPointSchema,
  CreateStockPointSchema,
  type GetWarehouseStatusInput,
  type GetStockBalanceInput,
  type ListStockPointsInput,
  type GetStockPointInput,
  type CreateStockPointInput
} from "../schemas/warehouse.js";

interface TenantStatus {
  activated: boolean;
  tenantId: number;
}

interface StockBalanceEntry {
  itemId: string;
  stockPointCode: string;
  availableStock: number;
  inStock: number;
}

interface StockLocation {
  id?: string;
  code: string;
  name?: string;
  stockPointId?: string;
}

interface StockPoint {
  id?: string;
  code: string;
  name: string;
  active?: boolean;
  stockLocations?: StockLocation[];
  deliveryName?: string;
  deliveryAddress?: string;
  deliveryZipCode?: string;
  deliveryCity?: string;
  deliveryCountryCode?: string;
  usingCompanyAddress?: boolean;
}

function stockPointToOutput(sp: StockPoint) {
  return {
    id: sp.id || null,
    code: sp.code,
    name: sp.name,
    active: sp.active ?? true,
    stock_locations: (sp.stockLocations || []).map((l) => ({
      id: l.id || null,
      code: l.code,
      name: l.name || null
    })),
    delivery_address: sp.usingCompanyAddress
      ? "company address"
      : [sp.deliveryName, sp.deliveryAddress, sp.deliveryZipCode, sp.deliveryCity].filter(Boolean).join(", ") || null
  };
}

/**
 * Register warehouse core tools (activation status, stock balance, stock points)
 */
export function registerWarehouseTools(server: McpServer): void {
  // Warehouse activation status
  server.registerTool(
    "fortnox_get_warehouse_status",
    {
      title: "Get Fortnox Warehouse Status",
      description: `Check whether the Fortnox Lager (Warehouse) module is activated for the current company.

Use this first if any warehouse tool (stock balance, production orders, purchase orders, deliveries) fails — warehouse features only work when the module is activated on the tenant.

Returns:
  Activation status and tenant id.`,
      inputSchema: GetWarehouseStatusSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetWarehouseStatusInput) => {
      try {
        const status = await warehouseRequest<TenantStatus>("/api/warehouse/tenants-v4");
        const output = {
          activated: status.activated,
          tenant_id: status.tenantId
        };
        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Warehouse Status\n\n- **Activated**: ${status.activated ? "Yes" : "No"}\n- **Tenant ID**: ${status.tenantId}` +
            (status.activated ? "" : "\n\nThe Fortnox Lager module is not activated for this company. Warehouse tools will not work.");
        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Stock balance
  server.registerTool(
    "fortnox_get_stock_balance",
    {
      title: "Get Fortnox Stock Balance",
      description: `Get current stock balance (lagersaldo) per article and stock point from the Fortnox Lager module.

Returns inStock (physical quantity) and availableStock (in stock minus reservations) for each article/stock point combination.

Args:
  - item_ids (string[]): Optional filter on article numbers
  - stock_point_codes (string[]): Optional filter on stock point codes
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetStockBalanceSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetStockBalanceInput) => {
      try {
        const queryParams: Record<string, string | undefined> = {};
        if (params.item_ids?.length) queryParams.itemIds = params.item_ids.join(",");
        if (params.stock_point_codes?.length) queryParams.stockPointCodes = params.stock_point_codes.join(",");

        const balances = await warehouseRequest<StockBalanceEntry[]>(
          "/api/warehouse/status-v1/stockbalance",
          "GET",
          undefined,
          queryParams
        );

        const output = {
          count: balances.length,
          balances: balances.map((b) => ({
            item_id: b.itemId,
            stock_point_code: b.stockPointCode,
            in_stock: b.inStock,
            available_stock: b.availableStock
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (balances.length === 0) {
          textContent = "# Stock Balance\n\nNo stock balances found for the given filters.";
        } else {
          textContent = "# Stock Balance\n\n" + formatRankingTable(
            ["Article", "Stock Point", "In Stock", "Available"],
            balances.map((b) => [b.itemId, b.stockPointCode, String(b.inStock), String(b.availableStock)])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // List stock points
  server.registerTool(
    "fortnox_list_stock_points",
    {
      title: "List Fortnox Stock Points",
      description: `List stock points (lagerställen) in the Fortnox Lager module, including their stock locations (lagerplatser).

Args:
  - q (string): Filter on stock point code or name
  - state ('ACTIVE' | 'INACTIVE' | 'ALL'): State filter (default ACTIVE)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: ListStockPointsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListStockPointsInput) => {
      try {
        const stockPoints = await warehouseRequest<StockPoint[]>(
          "/api/warehouse/stockpoints-v1",
          "GET",
          undefined,
          { q: params.q, state: params.state }
        );

        const output = {
          count: stockPoints.length,
          stock_points: stockPoints.map(stockPointToOutput)
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (stockPoints.length === 0) {
          textContent = "# Stock Points\n\nNo stock points found.";
        } else {
          const lines = ["# Stock Points", ""];
          for (const sp of stockPoints) {
            lines.push(`- **${sp.code}**: ${sp.name}${sp.active === false ? " *(inactive)*" : ""}` +
              (sp.stockLocations?.length ? ` — locations: ${sp.stockLocations.map((l) => l.code).join(", ")}` : ""));
          }
          textContent = lines.join("\n");
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get stock point
  server.registerTool(
    "fortnox_get_stock_point",
    {
      title: "Get Fortnox Stock Point",
      description: `Get a single stock point by id (UUID) or code, including its stock locations and delivery address.

Args:
  - id_or_code (string): Stock point id or code (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetStockPointSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetStockPointInput) => {
      try {
        const sp = await warehouseRequest<StockPoint>(
          `/api/warehouse/stockpoints-v1/${encodeURIComponent(params.id_or_code)}`
        );
        const output = stockPointToOutput(sp);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Stock Point ${sp.code}`, [
            { label: "Code", value: sp.code },
            { label: "Name", value: sp.name },
            { label: "Id", value: sp.id },
            { label: "Active", value: sp.active },
            { label: "Stock Locations", value: sp.stockLocations?.map((l) => l.code).join(", ") },
            { label: "Delivery Address", value: output.delivery_address ?? undefined }
          ]);
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Create stock point
  server.registerTool(
    "fortnox_create_stock_point",
    {
      title: "Create Fortnox Stock Point",
      description: `Create a new stock point (lagerställe), optionally with stock locations (lagerplatser).

Args:
  - code (string): Stock point code (required)
  - name (string): Stock point name (required)
  - stock_locations ({code, name}[]): Stock locations to create
  - delivery_name / delivery_address / delivery_zip_code / delivery_city / delivery_country_code: Custom delivery address

Returns:
  The created stock point.`,
      inputSchema: CreateStockPointSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateStockPointInput) => {
      try {
        const body: Record<string, unknown> = {
          code: params.code,
          name: params.name
        };
        if (params.stock_locations?.length) {
          body.stockLocations = params.stock_locations.map((l) => ({ code: l.code, name: l.name }));
        }
        const hasCustomAddress = params.delivery_name || params.delivery_address ||
          params.delivery_zip_code || params.delivery_city;
        if (hasCustomAddress) {
          body.usingCompanyAddress = false;
          if (params.delivery_name) body.deliveryName = params.delivery_name;
          if (params.delivery_address) body.deliveryAddress = params.delivery_address;
          if (params.delivery_zip_code) body.deliveryZipCode = params.delivery_zip_code;
          if (params.delivery_city) body.deliveryCity = params.delivery_city;
          if (params.delivery_country_code) body.deliveryCountryCode = params.delivery_country_code;
        }

        const sp = await warehouseRequest<StockPoint>("/api/warehouse/stockpoints-v1", "POST", body);
        const output = {
          success: true,
          message: `Stock point ${sp.code} created successfully`,
          ...stockPointToOutput(sp)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Stock Point Created\n\n**Code**: ${sp.code}\n**Name**: ${sp.name}` +
            (sp.stockLocations?.length ? `\n**Locations**: ${sp.stockLocations.map((l) => l.code).join(", ")}` : "");

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
