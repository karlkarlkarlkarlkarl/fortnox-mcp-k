import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { warehouseRequest } from "../services/warehouseApi.js";
import { ResponseFormat } from "../constants.js";
import {
  buildToolResponse,
  buildErrorResponse,
  formatDetailMarkdown,
  formatRankingTable
} from "../services/formatters.js";
import { buildConfirmationRequiredResponse, irreversibleWarning } from "../services/safety.js";
import {
  ListProductionOrdersSchema,
  GetProductionOrderSchema,
  CreateProductionOrderSchema,
  UpdateProductionOrderSchema,
  GetBillOfMaterialsSchema,
  ProductionOrderActionSchema,
  type ListProductionOrdersInput,
  type GetProductionOrderInput,
  type CreateProductionOrderInput,
  type UpdateProductionOrderInput,
  type GetBillOfMaterialsInput,
  type ProductionOrderActionInput
} from "../schemas/productionOrders.js";

interface PackageItem {
  itemId: string;
  itemDescription?: string;
  itemUnit?: string;
  quantityRequired: number;
  quantityReserved?: number;
  totalQuantityRequired?: number;
}

interface ProductionOrder {
  id?: number;
  itemId: string;
  itemDescription?: string;
  itemUnit?: string;
  quantity: number;
  startDate: string;
  productionDate?: string;
  productionState?: string;
  documentState?: string;
  batch?: string;
  note?: string;
  projectId?: string;
  costCenterCode?: string;
  inboundStockPointId?: string;
  inboundStockLocationId?: string;
  outboundStockPointId?: string;
  packageItems?: PackageItem[];
}

function productionOrderToOutput(po: ProductionOrder) {
  return {
    id: po.id ?? null,
    item_id: po.itemId,
    item_description: po.itemDescription || null,
    quantity: po.quantity,
    start_date: po.startDate,
    production_date: po.productionDate || null,
    production_state: po.productionState || null,
    document_state: po.documentState || null,
    batch: po.batch || null,
    note: po.note || null,
    project_id: po.projectId || null,
    components: (po.packageItems || []).map((p) => ({
      item_id: p.itemId,
      description: p.itemDescription || null,
      quantity_required: p.quantityRequired,
      quantity_reserved: p.quantityReserved ?? null,
      total_quantity_required: p.totalQuantityRequired ?? null
    }))
  };
}

function stateLabel(po: ProductionOrder): string {
  return po.documentState || po.productionState || "unknown";
}

/**
 * Register production order (tillverkningsorder) tools
 */
export function registerProductionOrderTools(server: McpServer): void {
  // List production orders
  server.registerTool(
    "fortnox_list_production_orders",
    {
      title: "List Fortnox Production Orders",
      description: `List production orders (tillverkningsordrar) from the Fortnox Lager module.

Args:
  - state ('registered' | 'reserved' | 'ongoing' | 'completed' | 'voided'): Filter on state
  - item_id (string): Filter on the produced article number
  - response_format ('markdown' | 'json'): Output format

Returns:
  Production orders with id, item, quantity, dates, and state.`,
      inputSchema: ListProductionOrdersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListProductionOrdersInput) => {
      try {
        const orders = await warehouseRequest<ProductionOrder[]>(
          "/api/warehouse/productionorders-v1",
          "GET",
          undefined,
          { state: params.state, itemId: params.item_id }
        );

        const output = {
          count: orders.length,
          production_orders: orders.map((po) => ({
            id: po.id ?? null,
            item_id: po.itemId,
            item_description: po.itemDescription || null,
            quantity: po.quantity,
            start_date: po.startDate,
            production_date: po.productionDate || null,
            state: stateLabel(po)
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (orders.length === 0) {
          textContent = "# Production Orders\n\nNo production orders found.";
        } else {
          textContent = "# Production Orders\n\n" + formatRankingTable(
            ["Id", "Article", "Qty", "Start", "State"],
            orders.map((po) => [
              String(po.id ?? "-"),
              `${po.itemId}${po.itemDescription ? ` (${po.itemDescription})` : ""}`,
              String(po.quantity),
              po.startDate,
              stateLabel(po)
            ])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get production order
  server.registerTool(
    "fortnox_get_production_order",
    {
      title: "Get Fortnox Production Order",
      description: `Get a production order by id, including its component list (package items).

Args:
  - id (number): Production order document id (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetProductionOrderSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetProductionOrderInput) => {
      try {
        const po = await warehouseRequest<ProductionOrder>(
          `/api/warehouse/productionorders-v1/${params.id}`
        );
        const output = productionOrderToOutput(po);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Production Order ${po.id}`, [
            { label: "Id", value: po.id },
            { label: "Article", value: `${po.itemId}${po.itemDescription ? ` (${po.itemDescription})` : ""}` },
            { label: "Quantity", value: po.quantity },
            { label: "Start Date", value: po.startDate },
            { label: "Production Date", value: po.productionDate },
            { label: "State", value: stateLabel(po) },
            { label: "Batch", value: po.batch },
            { label: "Note", value: po.note },
            { label: "Project", value: po.projectId }
          ]);
          if (po.packageItems?.length) {
            textContent += "\n\n## Components\n\n" + formatRankingTable(
              ["Article", "Required/unit", "Reserved", "Total Required"],
              po.packageItems.map((p) => [
                `${p.itemId}${p.itemDescription ? ` (${p.itemDescription})` : ""}`,
                String(p.quantityRequired),
                String(p.quantityReserved ?? "-"),
                String(p.totalQuantityRequired ?? "-")
              ])
            );
          }
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Create production order
  server.registerTool(
    "fortnox_create_production_order",
    {
      title: "Create Fortnox Production Order",
      description: `Create a new production order (tillverkningsorder) for a production article.

The component list is derived from the article's bill of materials. Creating an order does NOT consume stock — that happens when the order is released (see fortnox_production_order_action).

Args:
  - item_id (string): Article number to produce (required, must have a bill of materials)
  - quantity (number): Units to produce (required)
  - start_date (string): Production start date YYYY-MM-DD (required)
  - production_date (string): Completion date (required before release)
  - production_state ('registered' | 'reserved' | 'ongoing'): Initial state; 'reserved' reserves component stock
  - batch / note / project_id / cost_center_code: Optional metadata
  - inbound_stock_point_id / outbound_stock_point_id: Stock point routing

Returns:
  The created production order with its component list.`,
      inputSchema: CreateProductionOrderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateProductionOrderInput) => {
      try {
        const body: Record<string, unknown> = {
          itemId: params.item_id,
          quantity: params.quantity,
          startDate: params.start_date,
          productionState: params.production_state
        };
        if (params.production_date) body.productionDate = params.production_date;
        if (params.batch) body.batch = params.batch;
        if (params.note) body.note = params.note;
        if (params.project_id) body.projectId = params.project_id;
        if (params.cost_center_code) body.costCenterCode = params.cost_center_code;
        if (params.inbound_stock_point_id) body.inboundStockPointId = params.inbound_stock_point_id;
        if (params.inbound_stock_location_id) body.inboundStockLocationId = params.inbound_stock_location_id;
        if (params.outbound_stock_point_id) body.outboundStockPointId = params.outbound_stock_point_id;

        const po = await warehouseRequest<ProductionOrder>("/api/warehouse/productionorders-v1", "POST", body);
        const output = {
          success: true,
          message: `Production order ${po.id} created for ${po.quantity} x ${po.itemId}`,
          ...productionOrderToOutput(po)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Production Order Created\n\n**Id**: ${po.id}\n**Article**: ${po.itemId}\n**Quantity**: ${po.quantity}\n**Start Date**: ${po.startDate}\n**State**: ${stateLabel(po)}`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Update production order
  server.registerTool(
    "fortnox_update_production_order",
    {
      title: "Update Fortnox Production Order",
      description: `Update a production order that has not been released. The current document is fetched and provided fields are merged in before saving (the Fortnox API requires the full document on update).

Args:
  - id (number): Production order id (required)
  - quantity / start_date / production_date / production_state / batch / note: Fields to change

Returns:
  The updated production order.`,
      inputSchema: UpdateProductionOrderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: UpdateProductionOrderInput) => {
      try {
        const current = await warehouseRequest<ProductionOrder>(
          `/api/warehouse/productionorders-v1/${params.id}`
        );

        const body: ProductionOrder = { ...current };
        if (params.quantity !== undefined) body.quantity = params.quantity;
        if (params.start_date) body.startDate = params.start_date;
        if (params.production_date) body.productionDate = params.production_date;
        if (params.production_state) body.productionState = params.production_state;
        if (params.batch !== undefined) body.batch = params.batch;
        if (params.note !== undefined) body.note = params.note;

        const po = await warehouseRequest<ProductionOrder>(
          `/api/warehouse/productionorders-v1/${params.id}`,
          "PUT",
          body
        );
        const output = {
          success: true,
          message: `Production order ${po.id} updated`,
          ...productionOrderToOutput(po)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Production Order Updated\n\n**Id**: ${po.id}\n**Article**: ${po.itemId}\n**Quantity**: ${po.quantity}\n**State**: ${stateLabel(po)}`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Bill of materials
  server.registerTool(
    "fortnox_get_bill_of_materials",
    {
      title: "Get Fortnox Bill of Materials",
      description: `Get the bill of materials (component list) for a production article, with total component quantities required for a given production quantity.

Args:
  - item_id (string): Production article number (required)
  - quantity (number): Production quantity to calculate for (default 1)
  - production_order_id (number): Optional production order id for order-specific calculation
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetBillOfMaterialsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetBillOfMaterialsInput) => {
      try {
        const items = await warehouseRequest<PackageItem[]>(
          `/api/warehouse/productionorders-v1/billofmaterials/${encodeURIComponent(params.item_id)}`,
          "GET",
          undefined,
          {
            quantity: params.quantity !== undefined ? String(params.quantity) : undefined,
            id: params.production_order_id
          }
        );

        const output = {
          item_id: params.item_id,
          quantity: params.quantity ?? 1,
          components: items.map((p) => ({
            item_id: p.itemId,
            description: p.itemDescription || null,
            unit: p.itemUnit || null,
            quantity_required_per_unit: p.quantityRequired,
            total_quantity_required: p.totalQuantityRequired ?? null,
            quantity_reserved: p.quantityReserved ?? null
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (items.length === 0) {
          textContent = `# Bill of Materials — ${params.item_id}\n\nNo components found. Is this a production article?`;
        } else {
          textContent = `# Bill of Materials — ${params.item_id} (qty ${params.quantity ?? 1})\n\n` +
            formatRankingTable(
              ["Component", "Per Unit", "Total Required"],
              items.map((p) => [
                `${p.itemId}${p.itemDescription ? ` (${p.itemDescription})` : ""}`,
                String(p.quantityRequired),
                String(p.totalQuantityRequired ?? "-")
              ])
            );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Release / void (gated)
  server.registerTool(
    "fortnox_production_order_action",
    {
      title: "Release or Void Fortnox Production Order",
      description: `Perform a lifecycle action on a production order: release or void.

- release: Locks and bookkeeps the order. Component stock is consumed and the produced items are added to stock. Requires production_date to be set on the order.
- void: Cancels the order. Voiding a RELEASED order requires force=true and may cause negative stock.

${irreversibleWarning("Released documents are locked and bookkept; a release cannot be undone (only force-voided, which affects bookkeeping and stock). Voiding cannot be undone.")}

Args:
  - id (number): Production order id (required)
  - action ('release' | 'void'): Action to perform (required)
  - force (boolean): For void of released orders only
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: ProductionOrderActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: ProductionOrderActionInput) => {
      try {
        if (!params.confirm) {
          return buildConfirmationRequiredResponse(
            `${params.action === "release" ? "Release" : "Void"} production order ${params.id}` +
              (params.force ? " (FORCE)" : ""),
            params.action === "release"
              ? "The order is locked and bookkept: component stock is consumed and produced items are stocked. This cannot be undone."
              : "The production order is cancelled permanently." +
                (params.force ? " Force-voiding a released order reverses bookkeeping and may cause negative stock." : "")
          );
        }

        if (params.action === "release") {
          const po = await warehouseRequest<ProductionOrder>(
            `/api/warehouse/productionorders-v1/release/${params.id}`,
            "PUT"
          );
          const output = {
            success: true,
            message: `Production order ${params.id} released and bookkept`,
            ...productionOrderToOutput(po)
          };
          return buildToolResponse(
            `# Production Order Released\n\nProduction order **${params.id}** has been released and bookkept. ` +
            `Components consumed, ${po.quantity} x ${po.itemId} added to stock.`,
            output
          );
        }

        await warehouseRequest(
          `/api/warehouse/productionorders-v1/void/${params.id}`,
          "PUT",
          undefined,
          { force: params.force || undefined }
        );
        const output = {
          success: true,
          message: `Production order ${params.id} voided${params.force ? " (forced)" : ""}`
        };
        return buildToolResponse(
          `# Production Order Voided\n\nProduction order **${params.id}** has been voided${params.force ? " (forced)" : ""}.`,
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
