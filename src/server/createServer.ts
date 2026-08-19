import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCustomerTools } from "../tools/customers.js";
import { registerInvoiceTools } from "../tools/invoices.js";
import { registerSupplierTools } from "../tools/suppliers.js";
import { registerSupplierInvoiceTools } from "../tools/supplierInvoices.js";
import { registerAccountTools } from "../tools/accounts.js";
import { registerVoucherTools } from "../tools/vouchers.js";
import { registerCompanyTools } from "../tools/company.js";
import { registerAnalyticsTools } from "../tools/analytics.js";
import { registerOrderTools } from "../tools/orders.js";
import { registerBIAnalyticsTools } from "../tools/biAnalytics.js";
import { registerArticleTools } from "../tools/articles.js";
import { registerWarehouseTools } from "../tools/warehouse.js";
import { registerProductionOrderTools } from "../tools/productionOrders.js";
import { registerPurchaseOrderTools } from "../tools/purchaseOrders.js";
import { registerWarehouseDeliveryTools } from "../tools/warehouseDeliveries.js";
import { registerStockOperationTools } from "../tools/stockOperations.js";

/**
 * Server-wide conventions surfaced to every MCP client.
 */
const SERVER_INSTRUCTIONS = `Fortnox MCP server conventions:

MONEY & VAT:
- All aggregated amounts in analytics tools are converted to SEK using each document's currency rate; fields are suffixed _sek.
- Amounts from invoice/order/offer lists INCLUDE VAT (the Fortnox list API has no net amounts); fields are suffixed _inc_vat_sek. Never present these as "revenue"/"omsättning" without saying they include VAT.
- Exact ex-VAT revenue (nettoomsättning) comes from the bookkeeping: use fortnox_net_revenue.
- Order/offer lists carry no exchange rate: foreign currency documents are excluded from those SEK totals and reported separately per currency.

IRREVERSIBLE OPERATIONS:
- Tools for irreversible actions (bookkeeping, releasing/voiding documents, deletions, sending email) require confirm: true. Called without it they execute nothing and return a preview.
- Never set confirm: true unless the user has explicitly approved the specific action in conversation.

WAREHOUSE (Lager):
- Warehouse tools require the Fortnox Lager module on the tenant; check with fortnox_get_warehouse_status if they fail.`;

/**
 * Create the MCP server with all Fortnox tools registered.
 * Used by both local (stdio/http) and remote (OAuth) modes.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "fortnox-mcp-server",
      version: "1.0.0"
    },
    {
      instructions: SERVER_INSTRUCTIONS
    }
  );

  registerCustomerTools(server);
  registerInvoiceTools(server);
  registerSupplierTools(server);
  registerSupplierInvoiceTools(server);
  registerAccountTools(server);
  registerVoucherTools(server);
  registerCompanyTools(server);
  registerAnalyticsTools(server);
  registerOrderTools(server);
  registerBIAnalyticsTools(server);
  registerArticleTools(server);
  registerWarehouseTools(server);
  registerProductionOrderTools(server);
  registerPurchaseOrderTools(server);
  registerWarehouseDeliveryTools(server);
  registerStockOperationTools(server);

  return server;
}
