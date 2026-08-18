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
  ListStockTakingsSchema,
  GetStockTakingSchema,
  CreateStockTakingSchema,
  AddStockTakingRowsSchema,
  StockTakingActionSchema,
  CreateStockTransferSchema,
  GetStockTransferSchema,
  StockTransferActionSchema,
  type ListStockTakingsInput,
  type GetStockTakingInput,
  type CreateStockTakingInput,
  type AddStockTakingRowsInput,
  type StockTakingActionInput,
  type CreateStockTransferInput,
  type GetStockTransferInput,
  type StockTransferActionInput
} from "../schemas/stockOperations.js";

interface StockTakingRow {
  id?: string;
  itemId?: string;
  stockPointId?: string;
  stockLocationId?: string;
  stockTakenQuantity?: number;
  totalQuantityInStock?: number;
  countedBy?: string;
}

interface StockTaking {
  id?: number;
  name: string;
  responsible: string;
  date?: string;
  state?: string;
  costCenterCode?: string;
  projectId?: string;
  rows?: StockTakingRow[];
}

interface StockTransferRow {
  itemId: string;
  itemDescription?: string;
  requestedQuantity: number;
  quantity?: number;
  fromStockPointId?: string;
  fromStockPointCode?: string;
  toStockPointId?: string;
  toStockPointCode?: string;
}

interface StockTransfer {
  id?: number;
  transferDate?: string;
  note?: string;
  released?: boolean;
  voided?: boolean;
  rows: StockTransferRow[];
}

function stockTakingToOutput(st: StockTaking, includeRows: boolean) {
  const base = {
    id: st.id ?? null,
    name: st.name,
    responsible: st.responsible,
    date: st.date || null,
    state: st.state || null,
    row_count: st.rows?.length ?? 0
  };
  if (!includeRows) return base;
  return {
    ...base,
    rows: (st.rows || []).map((r) => ({
      row_id: r.id || null,
      item_id: r.itemId || null,
      stock_point_id: r.stockPointId || null,
      counted_quantity: r.stockTakenQuantity ?? null,
      quantity_in_stock: r.totalQuantityInStock ?? null,
      counted_by: r.countedBy || null
    }))
  };
}

function transferState(t: StockTransfer): string {
  if (t.voided) return "voided";
  if (t.released) return "released";
  return "draft";
}

function stockTransferToOutput(t: StockTransfer) {
  return {
    id: t.id ?? null,
    transfer_date: t.transferDate || null,
    state: transferState(t),
    note: t.note || null,
    rows: (t.rows || []).map((r) => ({
      item_id: r.itemId,
      description: r.itemDescription || null,
      requested_quantity: r.requestedQuantity,
      transferred_quantity: r.quantity ?? null,
      from_stock_point: r.fromStockPointCode || r.fromStockPointId || null,
      to_stock_point: r.toStockPointCode || r.toStockPointId || null
    }))
  };
}

/**
 * Register stock taking (inventering) and stock transfer (lagerflytt) tools
 */
export function registerStockOperationTools(server: McpServer): void {
  // List stock takings
  server.registerTool(
    "fortnox_list_stock_takings",
    {
      title: "List Fortnox Stock Takings",
      description: `List stock taking documents (inventeringar) from the Fortnox Lager module.

Args:
  - state ('planning' | 'started' | 'completed' | 'voided'): Filter on state
  - item_id (string): Filter on stock takings containing an article
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: ListStockTakingsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListStockTakingsInput) => {
      try {
        const takings = await warehouseRequest<StockTaking[]>(
          "/api/warehouse/stocktaking-v1",
          "GET",
          undefined,
          { state: params.state, itemId: params.item_id }
        );

        const output = {
          count: takings.length,
          stock_takings: takings.map((st) => ({
            id: st.id ?? null,
            name: st.name,
            responsible: st.responsible,
            date: st.date || null,
            state: st.state || null,
            row_count: st.rows?.length ?? 0
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (takings.length === 0) {
          textContent = "# Stock Takings\n\nNo stock takings found.";
        } else {
          textContent = "# Stock Takings\n\n" + formatRankingTable(
            ["Id", "Name", "Responsible", "Date", "State"],
            takings.map((st) => [
              String(st.id ?? "-"),
              st.name,
              st.responsible,
              st.date || "-",
              st.state || "-"
            ])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get stock taking
  server.registerTool(
    "fortnox_get_stock_taking",
    {
      title: "Get Fortnox Stock Taking",
      description: `Get a stock taking document by id, optionally with its counting rows.

Args:
  - id (number): Stock taking id (required)
  - include_rows (boolean): Include counting rows (default false)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetStockTakingSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetStockTakingInput) => {
      try {
        const st = await warehouseRequest<StockTaking>(`/api/warehouse/stocktaking-v1/${params.id}`);
        const output = stockTakingToOutput(st, params.include_rows);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Stock Taking ${st.id}`, [
            { label: "Id", value: st.id },
            { label: "Name", value: st.name },
            { label: "Responsible", value: st.responsible },
            { label: "Date", value: st.date },
            { label: "State", value: st.state },
            { label: "Rows", value: st.rows?.length ?? 0 }
          ]);
          if (params.include_rows && st.rows?.length) {
            textContent += "\n\n## Rows\n\n" + formatRankingTable(
              ["Article", "In Stock", "Counted", "Counted By"],
              st.rows.map((r) => [
                r.itemId || "-",
                String(r.totalQuantityInStock ?? "-"),
                String(r.stockTakenQuantity ?? "-"),
                r.countedBy || "-"
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

  // Create stock taking
  server.registerTool(
    "fortnox_create_stock_taking",
    {
      title: "Create Fortnox Stock Taking",
      description: `Create a new stock taking document (inventering) in 'planning' state.

Add articles to count with fortnox_add_stock_taking_rows, then release with fortnox_stock_taking_action once counting is done. Note: entering counted quantities per row is currently done in the Fortnox UI.

Args:
  - name (string): Stock taking name (required)
  - responsible (string): Responsible person (required)
  - date (string): YYYY-MM-DD
  - cost_center_code / project_id: Optional bookkeeping dimensions

Returns:
  The created stock taking document.`,
      inputSchema: CreateStockTakingSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateStockTakingInput) => {
      try {
        const body: Record<string, unknown> = {
          name: params.name,
          responsible: params.responsible
        };
        if (params.date) body.date = params.date;
        if (params.cost_center_code) body.costCenterCode = params.cost_center_code;
        if (params.project_id) body.projectId = params.project_id;

        const st = await warehouseRequest<StockTaking>("/api/warehouse/stocktaking-v1", "POST", body);
        const output = {
          success: true,
          message: `Stock taking ${st.id} created in planning state`,
          ...stockTakingToOutput(st, false)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Stock Taking Created\n\n**Id**: ${st.id}\n**Name**: ${st.name}\n**Responsible**: ${st.responsible}\n**State**: ${st.state || "planning"}`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Add rows to stock taking
  server.registerTool(
    "fortnox_add_stock_taking_rows",
    {
      title: "Add Fortnox Stock Taking Rows",
      description: `Add rows (articles to count) to a stock taking by filter. All article/stock point/location combinations matching the filters are added; already-added rows are skipped.

Args:
  - id (number): Stock taking id (required)
  - item_ids (string[]): Specific article numbers
  - item_id_search / item_description_search (string): Search filters
  - stock_point_ids (string[]): Limit to stock points
  - supplier_numbers (string[]): Limit to articles from suppliers
  - exclude_zero_balance_items (boolean): Skip zero-balance articles

Returns:
  Number of rows added.`,
      inputSchema: AddStockTakingRowsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: AddStockTakingRowsInput) => {
      try {
        const queryParams: Record<string, string | boolean | undefined> = {
          itemIds: params.item_ids?.join(","),
          stockPointIds: params.stock_point_ids?.join(","),
          supplierNumbers: params.supplier_numbers?.join(","),
          itemIdSearch: params.item_id_search,
          itemDescriptionSearch: params.item_description_search,
          excludeZeroBalanceItems: params.exclude_zero_balance_items || undefined
        };

        const added = await warehouseRequest<number>(
          `/api/warehouse/stocktaking-v1/${params.id}/addrows`,
          "POST",
          undefined,
          queryParams
        );

        const output = {
          success: true,
          rows_added: added,
          message: `Added ${added} row(s) to stock taking ${params.id}`
        };
        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Rows Added\n\nAdded **${added}** row(s) to stock taking **${params.id}**.`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Stock taking actions (gated)
  server.registerTool(
    "fortnox_stock_taking_action",
    {
      title: "Release, Void or Delete Fortnox Stock Taking",
      description: `Perform a lifecycle action on a stock taking document.

- release: Locks and bookkeeps the count. STOCK IS ADJUSTED to the counted quantities — uncounted rows count as 0.
- void: Cancels the document (planning/started only).
- delete: Permanently deletes the document and its rows (planning/started only).

${irreversibleWarning("Releasing adjusts stock levels and bookkeeps the adjustment; this cannot be undone. Void and delete are permanent.")}

Args:
  - id (number): Stock taking id (required)
  - action ('release' | 'void' | 'delete'): Required
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: StockTakingActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: StockTakingActionInput) => {
      try {
        if (!params.confirm) {
          const consequences: Record<string, string> = {
            release: "Stock levels are adjusted to counted quantities and the adjustment is bookkept. Rows without a counted quantity are set to 0. This cannot be undone.",
            void: "The stock taking is cancelled permanently.",
            delete: "The stock taking document and all its rows are permanently deleted."
          };
          return buildConfirmationRequiredResponse(
            `${params.action.charAt(0).toUpperCase() + params.action.slice(1)} stock taking ${params.id}`,
            consequences[params.action]
          );
        }

        if (params.action === "delete") {
          await warehouseRequest(`/api/warehouse/stocktaking-v1/${params.id}`, "DELETE");
        } else {
          await warehouseRequest(`/api/warehouse/stocktaking-v1/${params.id}/${params.action}`, "PUT");
        }

        const labels: Record<string, string> = { release: "released", void: "voided", delete: "deleted" };
        const output = {
          success: true,
          message: `Stock taking ${params.id} ${labels[params.action]}`
        };
        return buildToolResponse(
          `# Stock Taking ${labels[params.action].charAt(0).toUpperCase() + labels[params.action].slice(1)}\n\n` +
          `Stock taking **${params.id}** has been ${labels[params.action]}` +
          (params.action === "release" ? " and stock has been adjusted to the counted quantities." : "."),
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Create stock transfer
  server.registerTool(
    "fortnox_create_stock_transfer",
    {
      title: "Create Fortnox Stock Transfer",
      description: `Create a stock transfer document (lagerflytt) between stock points as a DRAFT. The requested quantities are reserved at the source; the actual move happens on release.

Args:
  - rows ({item_id, requested_quantity, from_stock_point_id, to_stock_point_id, from_stock_location_id?, to_stock_location_id?}[]): Required. Stock point ids are UUIDs from fortnox_list_stock_points
  - transfer_date (string): YYYY-MM-DD
  - note (string): Optional

Returns:
  The created draft transfer.`,
      inputSchema: CreateStockTransferSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateStockTransferInput) => {
      try {
        const body: Record<string, unknown> = {
          rows: params.rows.map((r) => {
            const row: Record<string, unknown> = {
              itemId: r.item_id,
              requestedQuantity: r.requested_quantity,
              fromStockPointId: r.from_stock_point_id,
              toStockPointId: r.to_stock_point_id
            };
            if (r.from_stock_location_id) row.fromStockLocationId = r.from_stock_location_id;
            if (r.to_stock_location_id) row.toStockLocationId = r.to_stock_location_id;
            return row;
          })
        };
        if (params.transfer_date) body.transferDate = params.transfer_date;
        if (params.note) body.note = params.note;

        const transfer = await warehouseRequest<StockTransfer>("/api/warehouse/stocktransfer-v1", "POST", body);
        const output = {
          success: true,
          message: `Stock transfer ${transfer.id} created as draft`,
          ...stockTransferToOutput(transfer)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Stock Transfer Created (Draft)\n\n**Id**: ${transfer.id}\n**Rows**: ${transfer.rows?.length ?? params.rows.length}\n\n` +
            `Quantities are reserved at the source. Release with fortnox_stock_transfer_action to execute the move.`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get stock transfer
  server.registerTool(
    "fortnox_get_stock_transfer",
    {
      title: "Get Fortnox Stock Transfer",
      description: `Get a stock transfer document by id.

Args:
  - id (number): Stock transfer id (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetStockTransferSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetStockTransferInput) => {
      try {
        const transfer = await warehouseRequest<StockTransfer>(`/api/warehouse/stocktransfer-v1/${params.id}`);
        const output = stockTransferToOutput(transfer);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Stock Transfer ${transfer.id}`, [
            { label: "Id", value: transfer.id },
            { label: "Date", value: transfer.transferDate },
            { label: "State", value: transferState(transfer) },
            { label: "Note", value: transfer.note }
          ]) + "\n\n## Rows\n\n" + formatRankingTable(
            ["Article", "Requested", "From", "To"],
            (transfer.rows || []).map((r) => [
              `${r.itemId}${r.itemDescription ? ` (${r.itemDescription})` : ""}`,
              String(r.requestedQuantity),
              r.fromStockPointCode || r.fromStockPointId || "-",
              r.toStockPointCode || r.toStockPointId || "-"
            ])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Stock transfer actions (gated)
  server.registerTool(
    "fortnox_stock_transfer_action",
    {
      title: "Release or Void Fortnox Stock Transfer",
      description: `Release or void a stock transfer document.

- release: Executes the transfer — outbound from the source stock point is delivered and inbound is created at the destination.
- void: Cancels an unreleased transfer and releases the reservations. Voiding a released transfer is not allowed.

${irreversibleWarning("Releasing moves stock and bookkeeps the movement; it cannot be undone. Void is permanent.")}

Args:
  - id (number): Stock transfer id (required)
  - action ('release' | 'void'): Required
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: StockTransferActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: StockTransferActionInput) => {
      try {
        if (!params.confirm) {
          return buildConfirmationRequiredResponse(
            `${params.action === "release" ? "Release" : "Void"} stock transfer ${params.id}`,
            params.action === "release"
              ? "Stock is moved from the source to the destination stock point and the movement is bookkept. This cannot be undone."
              : "The transfer is cancelled permanently and reservations are released."
          );
        }

        await warehouseRequest(`/api/warehouse/stocktransfer-v1/${params.id}/${params.action}`, "PUT");
        const label = params.action === "release" ? "released" : "voided";
        const output = {
          success: true,
          message: `Stock transfer ${params.id} ${label}`
        };
        return buildToolResponse(
          `# Stock Transfer ${label.charAt(0).toUpperCase() + label.slice(1)}\n\n` +
          `Stock transfer **${params.id}** has been ${label}` +
          (params.action === "release" ? " and the stock has been moved." : "."),
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
