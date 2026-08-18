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
import { formatDate } from "../services/api.js";
import {
  ListWarehouseDeliveriesSchema,
  GetWarehouseDeliverySchema,
  CreateWarehouseDeliverySchema,
  WarehouseDeliveryActionSchema,
  ListIncomingGoodsSchema,
  GetIncomingGoodsSchema,
  CreateIncomingGoodsSchema,
  IncomingGoodsActionSchema,
  type ListWarehouseDeliveriesInput,
  type GetWarehouseDeliveryInput,
  type CreateWarehouseDeliveryInput,
  type WarehouseDeliveryActionInput,
  type ListIncomingGoodsInput,
  type GetIncomingGoodsInput,
  type CreateIncomingGoodsInput,
  type IncomingGoodsActionInput
} from "../schemas/warehouseDeliveries.js";

interface DeliveryListEntry {
  deliveryId: number;
  entityId?: string;
  type: string;
  date?: string;
  note?: string;
  released?: boolean;
  voided?: boolean;
}

interface DeliveryRow {
  itemId: string;
  itemDescription?: string;
  quantity: number;
  deliveredQuantity?: number;
  stockPointCode?: string;
  stockLocationCode?: string;
  batch?: string;
  directCost?: number;
  freightCost?: number;
  otherCost?: number;
}

interface DeliveryDocument {
  id?: number;
  date: string;
  note?: string;
  released?: boolean;
  voided?: boolean;
  stockPointCode?: string;
  currency?: string;
  currencyRate?: number;
  rows: DeliveryRow[];
}

interface IncomingGoodsRow {
  itemId: string;
  itemDescription?: string;
  receivedQuantity: number;
  orderedQuantity?: number;
  backOrderQuantity?: number;
  purchaseOrderId?: number;
  stockPointCode?: string;
  batch?: string;
}

interface IncomingGoodsDocument {
  id?: number;
  date?: string;
  deliveryNoteId?: string;
  supplierNumber?: string;
  supplierName?: string;
  note?: string;
  released?: boolean;
  completed?: boolean;
  voided?: boolean;
  stockPointCode?: string;
  unmatchedValue?: number;
  rows?: IncomingGoodsRow[];
}

function docState(doc: { released?: boolean; voided?: boolean; completed?: boolean }): string {
  if (doc.voided) return "voided";
  if (doc.completed) return "completed";
  if (doc.released) return "released";
  return "draft";
}

function deliveryToOutput(doc: DeliveryDocument, direction: string) {
  return {
    id: doc.id ?? null,
    direction,
    date: doc.date,
    state: docState(doc),
    note: doc.note || null,
    stock_point_code: doc.stockPointCode || null,
    rows: (doc.rows || []).map((r) => ({
      item_id: r.itemId,
      description: r.itemDescription || null,
      quantity: r.quantity,
      delivered_quantity: r.deliveredQuantity ?? null,
      stock_point_code: r.stockPointCode || null,
      batch: r.batch || null
    }))
  };
}

function incomingGoodsToOutput(doc: IncomingGoodsDocument) {
  return {
    id: doc.id ?? null,
    date: doc.date || null,
    delivery_note_id: doc.deliveryNoteId || null,
    supplier_number: doc.supplierNumber || null,
    supplier_name: doc.supplierName || null,
    state: docState(doc),
    note: doc.note || null,
    stock_point_code: doc.stockPointCode || null,
    unmatched_value: doc.unmatchedValue ?? null,
    rows: (doc.rows || []).map((r) => ({
      item_id: r.itemId,
      description: r.itemDescription || null,
      received_quantity: r.receivedQuantity,
      ordered_quantity: r.orderedQuantity ?? null,
      back_order_quantity: r.backOrderQuantity ?? null,
      purchase_order_id: r.purchaseOrderId ?? null
    }))
  };
}

/**
 * Register manual delivery + incoming goods tools
 */
export function registerWarehouseDeliveryTools(server: McpServer): void {
  // List manual delivery documents
  server.registerTool(
    "fortnox_list_warehouse_deliveries",
    {
      title: "List Fortnox Warehouse Deliveries",
      description: `List manual warehouse delivery documents (manuella in-/utleveranser och lagerflyttar) from the Fortnox Lager module.

Args:
  - type ('Inbound' | 'Outbound' | 'StockTransfer'): Filter on document type
  - state (string): Filter on document state
  - item_id (string): Filter on documents containing an article
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: ListWarehouseDeliveriesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListWarehouseDeliveriesInput) => {
      try {
        const docs = await warehouseRequest<DeliveryListEntry[]>(
          "/api/warehouse/deliveries-v1",
          "GET",
          undefined,
          { type: params.type, state: params.state, itemId: params.item_id }
        );

        const output = {
          count: docs.length,
          deliveries: docs.map((d) => ({
            id: d.deliveryId,
            type: d.type,
            date: d.date || null,
            state: docState(d),
            note: d.note || null
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (docs.length === 0) {
          textContent = "# Warehouse Deliveries\n\nNo delivery documents found.";
        } else {
          textContent = "# Warehouse Deliveries\n\n" + formatRankingTable(
            ["Id", "Type", "Date", "State", "Note"],
            docs.map((d) => [String(d.deliveryId), d.type, d.date || "-", docState(d), d.note || "-"])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get manual delivery
  server.registerTool(
    "fortnox_get_warehouse_delivery",
    {
      title: "Get Fortnox Warehouse Delivery",
      description: `Get a manual inbound or outbound delivery document with its rows.

Args:
  - direction ('inbound' | 'outbound'): Document direction (required)
  - id (number): Document id (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetWarehouseDeliverySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetWarehouseDeliveryInput) => {
      try {
        const doc = await warehouseRequest<DeliveryDocument>(
          `/api/warehouse/deliveries-v1/${params.direction}deliveries/${params.id}`
        );
        const output = deliveryToOutput(doc, params.direction);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(
            `${params.direction === "inbound" ? "Inbound" : "Outbound"} Delivery ${doc.id}`,
            [
              { label: "Id", value: doc.id },
              { label: "Date", value: doc.date },
              { label: "State", value: docState(doc) },
              { label: "Stock Point", value: doc.stockPointCode },
              { label: "Note", value: doc.note }
            ]
          ) + "\n\n## Rows\n\n" + formatRankingTable(
            ["Article", "Quantity", "Stock Point", "Batch"],
            (doc.rows || []).map((r) => [
              `${r.itemId}${r.itemDescription ? ` (${r.itemDescription})` : ""}`,
              String(r.quantity),
              r.stockPointCode || "-",
              r.batch || "-"
            ])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Create manual delivery
  server.registerTool(
    "fortnox_create_warehouse_delivery",
    {
      title: "Create Fortnox Warehouse Delivery",
      description: `Create a manual inbound (inleverans) or outbound (utleverans) delivery document as a DRAFT.

Creating the document does NOT change stock — stock changes when the document is released with fortnox_warehouse_delivery_action. Inbound rows can carry cost values used for stock valuation.

Args:
  - direction ('inbound' | 'outbound'): Required
  - date (string): Document date YYYY-MM-DD (required)
  - rows ({item_id, quantity, stock_point_code?, stock_location_code?, batch?, direct_cost?, freight_cost?, other_cost?}[]): Required
  - stock_point_code (string): Default stock point for all rows
  - note (string): Optional
  - currency / currency_rate: For inbound cost values (default SEK / 1)

Returns:
  The created draft document.`,
      inputSchema: CreateWarehouseDeliverySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateWarehouseDeliveryInput) => {
      try {
        const isInbound = params.direction === "inbound";
        const body: Record<string, unknown> = {
          date: params.date,
          rows: params.rows.map((r) => {
            const row: Record<string, unknown> = {
              itemId: r.item_id,
              quantity: r.quantity
            };
            if (r.stock_point_code) row.stockPointCode = r.stock_point_code;
            if (r.stock_location_code) row.stockLocationCode = r.stock_location_code;
            if (isInbound) {
              if (r.batch) row.batch = r.batch;
              if (r.direct_cost !== undefined) row.directCost = r.direct_cost;
              if (r.freight_cost !== undefined) row.freightCost = r.freight_cost;
              if (r.other_cost !== undefined) row.otherCost = r.other_cost;
            }
            return row;
          })
        };
        if (params.stock_point_code) body.stockPointCode = params.stock_point_code;
        if (params.note) body.note = params.note;
        if (isInbound) {
          body.currency = params.currency;
          body.currencyRate = params.currency_rate;
        }

        const doc = await warehouseRequest<DeliveryDocument>(
          `/api/warehouse/deliveries-v1/${params.direction}deliveries`,
          "POST",
          body
        );
        const output = {
          success: true,
          message: `${isInbound ? "Inbound" : "Outbound"} delivery ${doc.id} created as draft`,
          ...deliveryToOutput(doc, params.direction)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# ${isInbound ? "Inbound" : "Outbound"} Delivery Created (Draft)\n\n` +
            `**Id**: ${doc.id}\n**Date**: ${doc.date}\n**Rows**: ${doc.rows?.length ?? params.rows.length}\n\n` +
            `Stock is NOT yet affected. Release the document with fortnox_warehouse_delivery_action to apply it.`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Release / void manual delivery (gated)
  server.registerTool(
    "fortnox_warehouse_delivery_action",
    {
      title: "Release or Void Fortnox Warehouse Delivery",
      description: `Release or void a manual inbound/outbound delivery document.

- release: Locks and bookkeeps the document; stock quantities change.
- void: Cancels the document. Voiding a released inbound with connected outbounds requires force=true and may cause negative stock.

${irreversibleWarning("Releasing bookkeeps the document and changes stock; it cannot be undone (only voided, which is itself permanent and affects bookkeeping).")}

Args:
  - direction ('inbound' | 'outbound'): Required
  - id (number): Document id (required)
  - action ('release' | 'void'): Required
  - force (boolean): For voiding released inbound documents
  - custom_void_date (string): Bookkeeping date for the void
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: WarehouseDeliveryActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: WarehouseDeliveryActionInput) => {
      try {
        if (!params.confirm) {
          return buildConfirmationRequiredResponse(
            `${params.action === "release" ? "Release" : "Void"} ${params.direction} delivery ${params.id}` +
              (params.force ? " (FORCE)" : ""),
            params.action === "release"
              ? "The document is locked and bookkept, and stock quantities are changed. This cannot be undone."
              : "The document is voided permanently." +
                (params.force ? " Force-voiding may cause negative stock." : "")
          );
        }

        const queryParams: Record<string, string | boolean | undefined> = {};
        if (params.action === "void") {
          if (params.force) queryParams.force = true;
          if (params.custom_void_date) queryParams.customVoidDate = params.custom_void_date;
        }

        await warehouseRequest(
          `/api/warehouse/deliveries-v1/${params.direction}deliveries/${params.id}/${params.action}`,
          "PUT",
          undefined,
          queryParams
        );

        const actionLabel = params.action === "release" ? "released" : "voided";
        const output = {
          success: true,
          message: `${params.direction} delivery ${params.id} ${actionLabel}`
        };
        return buildToolResponse(
          `# Delivery ${actionLabel === "released" ? "Released" : "Voided"}\n\n` +
          `The ${params.direction} delivery **${params.id}** has been ${actionLabel}` +
          (params.action === "release" ? " and stock has been updated." : "."),
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // List incoming goods
  server.registerTool(
    "fortnox_list_incoming_goods",
    {
      title: "List Fortnox Incoming Goods",
      description: `List incoming goods documents (inleveranser mot inköpsorder) from the Fortnox Lager module.

Args:
  - released / completed / voided (boolean): State filters
  - supplier_number (string): Filter on supplier
  - item_id (string): Filter on article
  - q (string): Free-text search on id or delivery note
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: ListIncomingGoodsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListIncomingGoodsInput) => {
      try {
        const docs = await warehouseRequest<IncomingGoodsDocument[]>(
          "/api/warehouse/incominggoods-v1",
          "GET",
          undefined,
          {
            released: params.released,
            completed: params.completed,
            voided: params.voided,
            supplierNumber: params.supplier_number,
            itemId: params.item_id,
            q: params.q
          }
        );

        const output = {
          count: docs.length,
          incoming_goods: docs.map((d) => ({
            id: d.id ?? null,
            date: d.date || null,
            delivery_note_id: d.deliveryNoteId || null,
            supplier_number: d.supplierNumber || null,
            supplier_name: d.supplierName || null,
            state: docState(d),
            unmatched_value: d.unmatchedValue ?? null
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (docs.length === 0) {
          textContent = "# Incoming Goods\n\nNo incoming goods documents found.";
        } else {
          textContent = "# Incoming Goods\n\n" + formatRankingTable(
            ["Id", "Date", "Delivery Note", "Supplier", "State"],
            docs.map((d) => [
              String(d.id ?? "-"),
              d.date || "-",
              d.deliveryNoteId || "-",
              d.supplierName || d.supplierNumber || "-",
              docState(d)
            ])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get incoming goods
  server.registerTool(
    "fortnox_get_incoming_goods",
    {
      title: "Get Fortnox Incoming Goods",
      description: `Get an incoming goods document by id, including its rows.

Args:
  - id (number): Incoming goods document id (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetIncomingGoodsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetIncomingGoodsInput) => {
      try {
        const doc = await warehouseRequest<IncomingGoodsDocument>(
          `/api/warehouse/incominggoods-v1/${params.id}`
        );
        const output = incomingGoodsToOutput(doc);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Incoming Goods ${doc.id}`, [
            { label: "Id", value: doc.id },
            { label: "Date", value: doc.date },
            { label: "Delivery Note", value: doc.deliveryNoteId },
            { label: "Supplier", value: doc.supplierName ? `${doc.supplierName} (${doc.supplierNumber})` : doc.supplierNumber },
            { label: "State", value: docState(doc) },
            { label: "Stock Point", value: doc.stockPointCode },
            { label: "Note", value: doc.note }
          ]);
          if (doc.rows?.length) {
            textContent += "\n\n## Rows\n\n" + formatRankingTable(
              ["Article", "Received", "Ordered", "PO"],
              doc.rows.map((r) => [
                `${r.itemId}${r.itemDescription ? ` (${r.itemDescription})` : ""}`,
                String(r.receivedQuantity),
                String(r.orderedQuantity ?? "-"),
                r.purchaseOrderId !== undefined ? String(r.purchaseOrderId) : "-"
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

  // Create incoming goods
  server.registerTool(
    "fortnox_create_incoming_goods",
    {
      title: "Create Fortnox Incoming Goods",
      description: `Create an incoming goods document (inleverans) as a DRAFT, optionally receiving against purchase order rows.

Stock is NOT affected until the document is released with fortnox_incoming_goods_action.

Args:
  - delivery_note_id (string): Supplier's delivery note reference (required)
  - rows ({item_id, received_quantity, ordered_quantity?, purchase_order_id?, stock_point_code?, batch?, direct_cost?}[]): Required
  - supplier_number (string): Supplier number
  - date (string): Document date (default today)
  - stock_point_code / note: Optional

Returns:
  The created draft document.`,
      inputSchema: CreateIncomingGoodsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateIncomingGoodsInput) => {
      try {
        const body: Record<string, unknown> = {
          deliveryNoteId: params.delivery_note_id,
          hasDeliveryNote: true,
          date: params.date || formatDate(new Date()),
          rows: params.rows.map((r) => {
            const ordered = r.ordered_quantity ?? r.received_quantity;
            const row: Record<string, unknown> = {
              itemId: r.item_id,
              receivedQuantity: r.received_quantity,
              orderedQuantity: ordered,
              backOrderQuantity: Math.max(0, ordered - r.received_quantity),
              invoicedQuantity: 0,
              takenQuantity: 0
            };
            if (r.purchase_order_id !== undefined) row.purchaseOrderId = r.purchase_order_id;
            if (r.purchase_order_row_id) row.purchaseOrderRowId = r.purchase_order_row_id;
            if (r.stock_point_code) row.stockPointCode = r.stock_point_code;
            if (r.stock_location_code) row.stockLocationCode = r.stock_location_code;
            if (r.batch) row.batch = r.batch;
            if (r.direct_cost !== undefined) row.directCost = r.direct_cost;
            return row;
          })
        };
        if (params.supplier_number) body.supplierNumber = params.supplier_number;
        if (params.stock_point_code) body.stockPointCode = params.stock_point_code;
        if (params.note) body.note = params.note;

        const doc = await warehouseRequest<IncomingGoodsDocument>(
          "/api/warehouse/incominggoods-v1",
          "POST",
          body
        );
        const output = {
          success: true,
          message: `Incoming goods document ${doc.id} created as draft`,
          ...incomingGoodsToOutput(doc)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Incoming Goods Created (Draft)\n\n**Id**: ${doc.id}\n**Delivery Note**: ${doc.deliveryNoteId}\n` +
            `**Rows**: ${doc.rows?.length ?? params.rows.length}\n\n` +
            `Stock is NOT yet affected. Release with fortnox_incoming_goods_action to apply.`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Incoming goods actions (gated)
  server.registerTool(
    "fortnox_incoming_goods_action",
    {
      title: "Release, Complete or Void Fortnox Incoming Goods",
      description: `Perform a lifecycle action on an incoming goods document.

- release: Locks and bookkeeps the document; received stock is added.
- complete: Finalizes bookkeeping on a released document. No more supplier invoices can be matched against it.
- void: Cancels the document (not possible once completed or matched against a supplier invoice).

${irreversibleWarning("Release and complete bookkeep the document and cannot be undone. Void is permanent.")}

Args:
  - id (number): Document id (required)
  - action ('release' | 'complete' | 'void'): Required
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: IncomingGoodsActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: IncomingGoodsActionInput) => {
      try {
        if (!params.confirm) {
          const consequences: Record<string, string> = {
            release: "The document is locked and bookkept; received stock is added. This cannot be undone.",
            complete: "Bookkeeping is finalized and supplier invoice matching is closed permanently.",
            void: "The document is voided permanently."
          };
          return buildConfirmationRequiredResponse(
            `${params.action.charAt(0).toUpperCase() + params.action.slice(1)} incoming goods document ${params.id}`,
            consequences[params.action]
          );
        }

        const endpoint = params.action === "complete"
          ? `/api/warehouse/incominggoods-v1/${params.id}/completed`
          : `/api/warehouse/incominggoods-v1/${params.id}/${params.action}`;
        await warehouseRequest(endpoint, "PUT");

        const labels: Record<string, string> = {
          release: "released",
          complete: "completed",
          void: "voided"
        };
        const output = {
          success: true,
          message: `Incoming goods document ${params.id} ${labels[params.action]}`
        };
        return buildToolResponse(
          `# Incoming Goods ${labels[params.action].charAt(0).toUpperCase() + labels[params.action].slice(1)}\n\n` +
          `Document **${params.id}** has been ${labels[params.action]}.`,
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
