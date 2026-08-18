import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { warehouseRequest } from "../services/warehouseApi.js";
import { ResponseFormat } from "../constants.js";
import {
  buildToolResponse,
  buildErrorResponse,
  formatDetailMarkdown,
  formatMoney,
  formatRankingTable
} from "../services/formatters.js";
import { buildConfirmationRequiredResponse, irreversibleWarning } from "../services/safety.js";
import { formatDate } from "../services/api.js";
import {
  ListPurchaseOrdersSchema,
  GetPurchaseOrderSchema,
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  SendPurchaseOrderSchema,
  PurchaseOrderActionSchema,
  type ListPurchaseOrdersInput,
  type GetPurchaseOrderInput,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
  type SendPurchaseOrderInput,
  type PurchaseOrderActionInput
} from "../schemas/purchaseOrders.js";

interface PurchaseOrderRow {
  id?: string;
  itemId: string;
  itemDescription?: string;
  orderedQuantity: number;
  receivedQuantity?: number;
  remainingOrderedQuantity?: number;
  price?: number;
  stockPointCode?: string;
  stockLocationCode?: string;
}

interface PurchaseOrder {
  id?: number;
  supplierNumber?: string;
  supplierName?: string;
  orderDate?: string;
  deliveryDate?: string;
  purchaseOrderState?: string;
  purchaseType?: string;
  orderValue?: number;
  orderValueInSEK?: number;
  currencyCode?: string;
  internalReference?: string;
  ourReference?: string;
  messageToSupplier?: string;
  note?: string;
  stockPointCode?: string;
  manuallyCompleted?: boolean;
  dropship?: boolean;
  rows?: PurchaseOrderRow[];
  [key: string]: unknown;
}

function purchaseOrderToOutput(po: PurchaseOrder) {
  return {
    id: po.id ?? null,
    supplier_number: po.supplierNumber || null,
    supplier_name: po.supplierName || null,
    order_date: po.orderDate || null,
    delivery_date: po.deliveryDate || null,
    state: po.purchaseOrderState || null,
    purchase_type: po.purchaseType || null,
    order_value: po.orderValue ?? null,
    currency: po.currencyCode || null,
    internal_reference: po.internalReference || null,
    stock_point_code: po.stockPointCode || null,
    note: po.note || null,
    rows: (po.rows || []).map((r) => ({
      item_id: r.itemId,
      description: r.itemDescription || null,
      ordered_quantity: r.orderedQuantity,
      received_quantity: r.receivedQuantity ?? null,
      remaining_quantity: r.remainingOrderedQuantity ?? null,
      price: r.price ?? null
    }))
  };
}

/**
 * Register purchase order (inköpsorder) tools
 */
export function registerPurchaseOrderTools(server: McpServer): void {
  // List purchase orders
  server.registerTool(
    "fortnox_list_purchase_orders",
    {
      title: "List Fortnox Purchase Orders",
      description: `List purchase orders (inköpsordrar) from the Fortnox Lager module.

Args:
  - q (string): Free-text search on id or internal reference
  - supplier_number (string): Filter on supplier
  - state: NOT_SENT | SENT | SENT_NOT_REJECTED | DELAYED | RECEIVED | VOIDED | CURRENT | ALL
  - item_id (string): Filter on article
  - purchase_type ('WAREHOUSE' | 'DROPSHIP'): Filter on type
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: ListPurchaseOrdersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListPurchaseOrdersInput) => {
      try {
        const orders = await warehouseRequest<PurchaseOrder[]>(
          "/api/warehouse/purchaseorders-v1",
          "GET",
          undefined,
          {
            q: params.q,
            supplierNumber: params.supplier_number,
            state: params.state,
            itemId: params.item_id,
            purchaseType: params.purchase_type
          }
        );

        const output = {
          count: orders.length,
          purchase_orders: orders.map((po) => ({
            id: po.id ?? null,
            supplier_number: po.supplierNumber || null,
            supplier_name: po.supplierName || null,
            order_date: po.orderDate || null,
            delivery_date: po.deliveryDate || null,
            state: po.purchaseOrderState || null,
            order_value: po.orderValue ?? null,
            currency: po.currencyCode || null
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else if (orders.length === 0) {
          textContent = "# Purchase Orders\n\nNo purchase orders found.";
        } else {
          textContent = "# Purchase Orders\n\n" + formatRankingTable(
            ["Id", "Supplier", "Order Date", "Delivery", "Value", "State"],
            orders.map((po) => [
              String(po.id ?? "-"),
              po.supplierName || po.supplierNumber || "-",
              po.orderDate || "-",
              po.deliveryDate || "-",
              po.orderValue !== undefined ? formatMoney(po.orderValue, po.currencyCode || "SEK") : "-",
              po.purchaseOrderState || "-"
            ])
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get purchase order
  server.registerTool(
    "fortnox_get_purchase_order",
    {
      title: "Get Fortnox Purchase Order",
      description: `Get a purchase order by id, including its rows with ordered/received/remaining quantities.

Args:
  - id (number): Purchase order id (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetPurchaseOrderSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetPurchaseOrderInput) => {
      try {
        const po = await warehouseRequest<PurchaseOrder>(`/api/warehouse/purchaseorders-v1/${params.id}`);
        const output = purchaseOrderToOutput(po);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Purchase Order ${po.id}`, [
            { label: "Id", value: po.id },
            { label: "Supplier", value: po.supplierName ? `${po.supplierName} (${po.supplierNumber})` : po.supplierNumber },
            { label: "Order Date", value: po.orderDate },
            { label: "Delivery Date", value: po.deliveryDate },
            { label: "State", value: po.purchaseOrderState },
            { label: "Type", value: po.purchaseType },
            { label: "Order Value", value: po.orderValue !== undefined ? formatMoney(po.orderValue, po.currencyCode || "SEK") : undefined },
            { label: "Internal Reference", value: po.internalReference },
            { label: "Stock Point", value: po.stockPointCode },
            { label: "Note", value: po.note }
          ]);
          if (po.rows?.length) {
            textContent += "\n\n## Rows\n\n" + formatRankingTable(
              ["Article", "Ordered", "Received", "Remaining", "Price"],
              po.rows.map((r) => [
                `${r.itemId}${r.itemDescription ? ` (${r.itemDescription})` : ""}`,
                String(r.orderedQuantity),
                String(r.receivedQuantity ?? "-"),
                String(r.remainingOrderedQuantity ?? "-"),
                r.price !== undefined ? formatMoney(r.price, po.currencyCode || "SEK") : "-"
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

  // Create purchase order
  server.registerTool(
    "fortnox_create_purchase_order",
    {
      title: "Create Fortnox Purchase Order",
      description: `Create a new purchase order (inköpsorder). The order is created in NOT_SENT state — nothing is sent to the supplier until fortnox_send_purchase_order is used.

Delivery address is resolved from the given stock point (or the company address).

Args:
  - supplier_number (string): Supplier number (required)
  - rows ({item_id, ordered_quantity, price?, stock_point_code?}[]): Order rows (required)
  - order_date (string): YYYY-MM-DD (default today)
  - delivery_date (string): Requested delivery date
  - stock_point_code (string): Stock point goods are delivered to
  - internal_reference / our_reference / message_to_supplier / note: Optional metadata
  - currency_code (string): Default SEK; currency_rate (number): Default 1
  - payment_terms_code / project_id / cost_center_code: Optional

Returns:
  The created purchase order.`,
      inputSchema: CreatePurchaseOrderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreatePurchaseOrderInput) => {
      try {
        const body: Record<string, unknown> = {
          supplierNumber: params.supplier_number,
          orderDate: params.order_date || formatDate(new Date()),
          currencyCode: params.currency_code,
          currencyRate: params.currency_rate,
          rows: params.rows.map((r) => ({
            itemId: r.item_id,
            orderedQuantity: r.ordered_quantity,
            price: r.price,
            stockPointCode: r.stock_point_code,
            stockLocationCode: r.stock_location_code
          }))
        };
        if (params.delivery_date) body.deliveryDate = params.delivery_date;
        if (params.stock_point_code) body.stockPointCode = params.stock_point_code;
        if (params.internal_reference) body.internalReference = params.internal_reference;
        if (params.our_reference) body.ourReference = params.our_reference;
        if (params.message_to_supplier) body.messageToSupplier = params.message_to_supplier;
        if (params.note) body.note = params.note;
        if (params.payment_terms_code) body.paymentTermsCode = params.payment_terms_code;
        if (params.project_id) body.projectId = params.project_id;
        if (params.cost_center_code) body.costCenterCode = params.cost_center_code;

        const po = await warehouseRequest<PurchaseOrder>("/api/warehouse/purchaseorders-v1", "POST", body);
        const output = {
          success: true,
          message: `Purchase order ${po.id} created (state: ${po.purchaseOrderState || "NOT_SENT"})`,
          ...purchaseOrderToOutput(po)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Purchase Order Created\n\n**Id**: ${po.id}\n**Supplier**: ${po.supplierName || po.supplierNumber}\n` +
            `**Rows**: ${po.rows?.length ?? params.rows.length}\n**State**: ${po.purchaseOrderState || "NOT_SENT"}\n\n` +
            `The order has NOT been sent to the supplier. Use fortnox_send_purchase_order to send it.`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Update purchase order
  server.registerTool(
    "fortnox_update_purchase_order",
    {
      title: "Update Fortnox Purchase Order",
      description: `Update metadata on a purchase order. The current document is fetched and provided fields are merged in before saving.

Args:
  - id (number): Purchase order id (required)
  - delivery_date / internal_reference / message_to_supplier / note: Fields to change

Returns:
  The updated purchase order.`,
      inputSchema: UpdatePurchaseOrderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: UpdatePurchaseOrderInput) => {
      try {
        const current = await warehouseRequest<PurchaseOrder>(`/api/warehouse/purchaseorders-v1/${params.id}`);
        const body: PurchaseOrder = { ...current };
        if (params.delivery_date) body.deliveryDate = params.delivery_date;
        if (params.internal_reference !== undefined) body.internalReference = params.internal_reference;
        if (params.message_to_supplier !== undefined) body.messageToSupplier = params.message_to_supplier;
        if (params.note !== undefined) body.note = params.note;

        const po = await warehouseRequest<PurchaseOrder>(
          `/api/warehouse/purchaseorders-v1/${params.id}`,
          "PUT",
          body
        );
        const output = {
          success: true,
          message: `Purchase order ${po.id} updated`,
          ...purchaseOrderToOutput(po)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Purchase Order Updated\n\n**Id**: ${po.id}\n**State**: ${po.purchaseOrderState || "-"}`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Send purchase order (gated - external email)
  server.registerTool(
    "fortnox_send_purchase_order",
    {
      title: "Send Fortnox Purchase Order",
      description: `Send a purchase order to the supplier via email and set its state to SENT.

${irreversibleWarning("An email is sent to an external recipient (the supplier). A sent email cannot be recalled.")}

Args:
  - id (number): Purchase order id (required)
  - receiver (string): Recipient email (required)
  - subject (string): Email subject (required)
  - body (string): Email body (required)
  - reply_to (string): Reply-to address (required)
  - sender_name / receiver_copy: Optional
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: SendPurchaseOrderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: SendPurchaseOrderInput) => {
      try {
        if (!params.confirm) {
          return buildConfirmationRequiredResponse(
            `Send purchase order ${params.id} by email to ${params.receiver}` +
              (params.receiver_copy ? ` (cc: ${params.receiver_copy})` : ""),
            "An email with the purchase order is sent to the supplier and the order state is set to SENT. The email cannot be recalled."
          );
        }

        const body: Record<string, unknown> = {
          receiver: params.receiver,
          subject: params.subject,
          body: params.body,
          replyTo: params.reply_to
        };
        if (params.sender_name) body.senderName = params.sender_name;
        if (params.receiver_copy) body.receiverCopy = params.receiver_copy;

        await warehouseRequest(`/api/warehouse/purchaseorders-v1/${params.id}/send`, "POST", body);

        const output = {
          success: true,
          message: `Purchase order ${params.id} sent to ${params.receiver}`
        };
        return buildToolResponse(
          `# Purchase Order Sent\n\nPurchase order **${params.id}** was emailed to **${params.receiver}** and its state is now SENT.`,
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Complete / void (gated)
  server.registerTool(
    "fortnox_purchase_order_action",
    {
      title: "Complete or Void Fortnox Purchase Order",
      description: `Perform a lifecycle action on a purchase order: complete or void.

- complete: Manually marks the order fully received. Remaining (undelivered) quantities are ignored permanently.
- void: Cancels the purchase order.

${irreversibleWarning("Completing or voiding a purchase order cannot be undone.")}

Args:
  - id (number): Purchase order id (required)
  - action ('complete' | 'void'): Action to perform (required)
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: PurchaseOrderActionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: PurchaseOrderActionInput) => {
      try {
        if (!params.confirm) {
          return buildConfirmationRequiredResponse(
            `${params.action === "complete" ? "Complete" : "Void"} purchase order ${params.id}`,
            params.action === "complete"
              ? "The order is marked fully received; remaining quantities are permanently ignored."
              : "The purchase order is cancelled permanently."
          );
        }

        await warehouseRequest(`/api/warehouse/purchaseorders-v1/${params.id}/${params.action}`, "PUT");
        const output = {
          success: true,
          message: `Purchase order ${params.id} ${params.action === "complete" ? "completed" : "voided"}`
        };
        return buildToolResponse(
          `# Purchase Order ${params.action === "complete" ? "Completed" : "Voided"}\n\n` +
          `Purchase order **${params.id}** has been ${params.action === "complete" ? "marked as fully received" : "voided"}.`,
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
