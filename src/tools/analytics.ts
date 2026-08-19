import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchAllPages, fortnoxRequest } from "../services/api.js";
import { ResponseFormat } from "../constants.js";
import {
  buildToolResponse,
  buildErrorResponse,
  formatMoney
} from "../services/formatters.js";
import {
  periodToDateRange,
  getPeriodDescription,
  getAgeBucket,
  type AgeBucket
} from "../services/dateHelpers.js";
import {
  totalInSEK,
  balanceInSEK,
  foreignCurrencies,
  AMOUNT_CONVENTIONS
} from "../services/money.js";
import {
  InvoiceSummarySchema,
  TopCustomersSchema,
  UnpaidReportSchema,
  NetRevenueSchema,
  type InvoiceSummaryInput,
  type TopCustomersInput,
  type UnpaidReportInput,
  type NetRevenueInput
} from "../schemas/analytics.js";

// Reuse invoice types from invoices.ts
interface FortnoxInvoiceListItem {
  DocumentNumber: string;
  CustomerNumber: string;
  CustomerName?: string;
  InvoiceDate?: string;
  DueDate?: string;
  Total?: number;
  Balance?: number;
  Currency?: string;
  CurrencyRate?: number;
  CurrencyUnit?: number;
  Booked?: boolean;
  Cancelled?: boolean;
}

interface InvoiceListResponse {
  Invoices: FortnoxInvoiceListItem[];
  MetaInformation?: {
    "@TotalResources": number;
    "@TotalPages": number;
    "@CurrentPage": number;
  };
}

interface FortnoxVoucherListItem {
  VoucherSeries: string;
  VoucherNumber: number;
  TransactionDate?: string;
  Description?: string;
}

interface VoucherListResponse {
  Vouchers: FortnoxVoucherListItem[];
  MetaInformation?: {
    "@TotalResources": number;
  };
}

interface VoucherDetailResponse {
  Voucher: {
    VoucherSeries: string;
    VoucherNumber: number;
    TransactionDate: string;
    Description: string;
    VoucherRows?: Array<{
      Account: number;
      Debit?: number;
      Credit?: number;
      Description?: string;
    }>;
  };
}

/**
 * Calculate summary statistics for a set of invoices.
 * All amounts are converted to SEK (inc VAT) using each invoice's currency rate.
 */
function calculateStats(invoices: FortnoxInvoiceListItem[]): {
  count: number;
  total_inc_vat_sek: number;
  average_inc_vat_sek: number;
  min_inc_vat_sek: number;
  max_inc_vat_sek: number;
  paid_count: number;
  unpaid_count: number;
  outstanding_balance_inc_vat_sek: number;
} {
  if (invoices.length === 0) {
    return {
      count: 0,
      total_inc_vat_sek: 0,
      average_inc_vat_sek: 0,
      min_inc_vat_sek: 0,
      max_inc_vat_sek: 0,
      paid_count: 0,
      unpaid_count: 0,
      outstanding_balance_inc_vat_sek: 0
    };
  }

  const totals = invoices.map(totalInSEK);
  const sum = totals.reduce((a, b) => a + b, 0);
  const balanceSum = invoices.reduce((a, inv) => a + balanceInSEK(inv), 0);
  const paidCount = invoices.filter(inv => (inv.Balance || 0) === 0 && !inv.Cancelled).length;
  const unpaidCount = invoices.filter(inv => (inv.Balance || 0) > 0).length;

  return {
    count: invoices.length,
    total_inc_vat_sek: sum,
    average_inc_vat_sek: sum / invoices.length,
    min_inc_vat_sek: Math.min(...totals),
    max_inc_vat_sek: Math.max(...totals),
    paid_count: paidCount,
    unpaid_count: unpaidCount,
    outstanding_balance_inc_vat_sek: balanceSum
  };
}

/**
 * Get month key from date string (YYYY-MM)
 */
function getMonthKey(dateStr: string | undefined): string {
  if (!dateStr) return "unknown";
  return dateStr.substring(0, 7); // YYYY-MM
}

/**
 * Get invoice status
 */
function getInvoiceStatus(inv: FortnoxInvoiceListItem): string {
  if (inv.Cancelled) return "cancelled";
  if ((inv.Balance || 0) === 0) return "paid";
  if (!inv.Booked) return "draft";
  return "unpaid";
}

/**
 * Register all analytics tools
 */
export function registerAnalyticsTools(server: McpServer): void {
  // Invoice Summary Tool
  server.registerTool(
    "fortnox_invoice_summary",
    {
      title: "Invoice Summary Analytics",
      description: `Calculate summary statistics for invoices over a period.

Answers questions like:
- "How much did we invoice this month?"
- "How many invoices did we send last quarter?"
- "What's the average invoice amount this year?"

${AMOUNT_CONVENTIONS}

Args:
  - period ('today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year'): Date period to analyze
  - from_date (string): Start date YYYY-MM-DD (ignored if period specified)
  - to_date (string): End date YYYY-MM-DD (ignored if period specified)
  - filter ('cancelled' | 'fullypaid' | 'unpaid' | 'unpaidoverdue' | 'unbooked'): Filter by invoice status
  - customer_number (string): Filter by specific customer
  - group_by ('customer' | 'month' | 'status'): Group statistics by dimension
  - include_details (boolean): Include individual invoice list (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Summary with invoiced amounts (inc VAT, SEK), counts and optional breakdown.
  For exact ex-VAT revenue, use fortnox_net_revenue instead.`,
      inputSchema: InvoiceSummarySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: InvoiceSummaryInput) => {
      try {
        // Build query params
        const queryParams: Record<string, string | number | boolean | undefined> = {};

        if (params.filter) queryParams.filter = params.filter;
        if (params.customer_number) queryParams.customernumber = params.customer_number;

        // Handle period
        let dateRangeDescription: string | undefined;
        if (params.period) {
          const dateRange = periodToDateRange(params.period);
          queryParams.fromdate = dateRange.from_date;
          queryParams.todate = dateRange.to_date;
          dateRangeDescription = getPeriodDescription(params.period);
        } else if (params.from_date || params.to_date) {
          if (params.from_date) queryParams.fromdate = params.from_date;
          if (params.to_date) queryParams.todate = params.to_date;
          dateRangeDescription = `${params.from_date || "start"} to ${params.to_date || "end"}`;
        }

        // Fetch all invoices for the period
        const result = await fetchAllPages<FortnoxInvoiceListItem, InvoiceListResponse>(
          "/3/invoices",
          queryParams,
          (r) => r.Invoices || [],
          (r) => r.MetaInformation?.["@TotalResources"] || 0
        );

        const invoices = result.items;
        const overallStats = calculateStats(invoices);
        const currencies = foreignCurrencies(invoices);

        // Build grouped statistics if requested
        let groups: Array<{ key: string; stats: ReturnType<typeof calculateStats> }> | undefined;

        if (params.group_by) {
          const groupMap = new Map<string, FortnoxInvoiceListItem[]>();

          for (const inv of invoices) {
            let key: string;
            switch (params.group_by) {
              case "customer":
                key = inv.CustomerName || inv.CustomerNumber || "unknown";
                break;
              case "month":
                key = getMonthKey(inv.InvoiceDate);
                break;
              case "status":
                key = getInvoiceStatus(inv);
                break;
            }

            if (!groupMap.has(key)) {
              groupMap.set(key, []);
            }
            groupMap.get(key)!.push(inv);
          }

          groups = Array.from(groupMap.entries())
            .map(([key, items]) => ({
              key,
              stats: calculateStats(items)
            }))
            .sort((a, b) => b.stats.total_inc_vat_sek - a.stats.total_inc_vat_sek);
        }

        const output: Record<string, unknown> = {
          period: params.period || null,
          date_range: dateRangeDescription || null,
          api_total: result.total,
          fetched: invoices.length,
          truncated: result.truncated,
          truncation_reason: result.truncationReason,
          amount_basis: "SEK, including VAT (converted per invoice currency rate)",
          foreign_currencies_present: currencies,
          summary: overallStats
        };

        if (groups) {
          output.groups = groups;
        }

        if (params.include_details) {
          output.invoices = invoices.map(inv => ({
            document_number: inv.DocumentNumber,
            customer_number: inv.CustomerNumber,
            customer_name: inv.CustomerName || null,
            invoice_date: inv.InvoiceDate || null,
            currency: inv.Currency || "SEK",
            total_inc_vat: inv.Total || 0,
            total_inc_vat_sek: totalInSEK(inv),
            balance_inc_vat_sek: balanceInSEK(inv),
            status: getInvoiceStatus(inv)
          }));
        }

        // Format output
        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          const lines: string[] = [
            "# Invoice Summary",
            "",
            "*Amounts in SEK, including VAT. For ex-VAT revenue use fortnox_net_revenue.*",
            ""
          ];

          if (dateRangeDescription) {
            lines.push(`**Period**: ${dateRangeDescription}`);
            lines.push("");
          }

          if (currencies.length > 0) {
            lines.push(`*Foreign currency invoices (${currencies.join(", ")}) converted to SEK at each invoice's rate.*`);
            lines.push("");
          }

          if (result.truncated) {
            lines.push(`⚠️ **Note**: ${result.truncationReason}`);
            lines.push("");
          }

          lines.push("## Overall Statistics");
          lines.push("");
          lines.push(`| Metric | Value |`);
          lines.push(`|--------|-------|`);
          lines.push(`| Invoice Count | ${overallStats.count} |`);
          lines.push(`| Total Invoiced (inc VAT) | ${formatMoney(overallStats.total_inc_vat_sek)} |`);
          lines.push(`| Average Invoice (inc VAT) | ${formatMoney(overallStats.average_inc_vat_sek)} |`);
          lines.push(`| Minimum | ${formatMoney(overallStats.min_inc_vat_sek)} |`);
          lines.push(`| Maximum | ${formatMoney(overallStats.max_inc_vat_sek)} |`);
          lines.push(`| Paid Invoices | ${overallStats.paid_count} |`);
          lines.push(`| Unpaid Invoices | ${overallStats.unpaid_count} |`);
          lines.push(`| Outstanding Balance (inc VAT) | ${formatMoney(overallStats.outstanding_balance_inc_vat_sek)} |`);

          if (groups && groups.length > 0) {
            lines.push("");
            lines.push(`## Breakdown by ${params.group_by}`);
            lines.push("");
            lines.push(`| ${params.group_by === "month" ? "Month" : params.group_by === "customer" ? "Customer" : "Status"} | Count | Total (inc VAT) | Average |`);
            lines.push(`|--------|-------|-------|---------|`);

            for (const group of groups) {
              lines.push(`| ${group.key} | ${group.stats.count} | ${formatMoney(group.stats.total_inc_vat_sek)} | ${formatMoney(group.stats.average_inc_vat_sek)} |`);
            }
          }

          textContent = lines.join("\n");
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Top Customers Tool
  server.registerTool(
    "fortnox_top_customers",
    {
      title: "Top Customers Analytics",
      description: `Identify top customers by various metrics.

Answers questions like:
- "Who are my top 10 customers by invoiced amount?"
- "Which customers have the most invoices?"
- "Who has the highest unpaid balance?"

${AMOUNT_CONVENTIONS}

Args:
  - metric ('total_amount' | 'invoice_count' | 'unpaid_amount' | 'average_invoice'): How to rank customers (default: total_amount). Amount metrics are inc VAT, SEK
  - period ('today' | ... | 'last_year'): Date period to analyze
  - from_date (string): Start date YYYY-MM-DD (ignored if period specified)
  - to_date (string): End date YYYY-MM-DD (ignored if period specified)
  - top_n (number): Number of customers to return, 1-50 (default: 10)
  - include_details (boolean): Include invoice breakdown per customer (default: false)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Ranked customers with total_inc_vat_sek, invoice_count, unpaid_inc_vat_sek, average_invoice_inc_vat_sek.`,
      inputSchema: TopCustomersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: TopCustomersInput) => {
      try {
        // Build query params
        const queryParams: Record<string, string | number | boolean | undefined> = {};

        // Handle period
        let dateRangeDescription: string | undefined;
        if (params.period) {
          const dateRange = periodToDateRange(params.period);
          queryParams.fromdate = dateRange.from_date;
          queryParams.todate = dateRange.to_date;
          dateRangeDescription = getPeriodDescription(params.period);
        } else if (params.from_date || params.to_date) {
          if (params.from_date) queryParams.fromdate = params.from_date;
          if (params.to_date) queryParams.todate = params.to_date;
          dateRangeDescription = `${params.from_date || "start"} to ${params.to_date || "end"}`;
        }

        // Fetch all invoices
        const result = await fetchAllPages<FortnoxInvoiceListItem, InvoiceListResponse>(
          "/3/invoices",
          queryParams,
          (r) => r.Invoices || [],
          (r) => r.MetaInformation?.["@TotalResources"] || 0
        );

        const invoices = result.items;

        // Group by customer
        const customerMap = new Map<string, {
          customer_number: string;
          customer_name: string;
          invoices: FortnoxInvoiceListItem[];
        }>();

        for (const inv of invoices) {
          const key = inv.CustomerNumber || "unknown";
          if (!customerMap.has(key)) {
            customerMap.set(key, {
              customer_number: key,
              customer_name: inv.CustomerName || key,
              invoices: []
            });
          }
          customerMap.get(key)!.invoices.push(inv);
        }

        // Calculate metrics (SEK, inc VAT) and sort
        const customerStats = Array.from(customerMap.values()).map(c => {
          const totalAmount = c.invoices.reduce((sum, inv) => sum + totalInSEK(inv), 0);
          const unpaidAmount = c.invoices.reduce((sum, inv) => sum + balanceInSEK(inv), 0);
          const invoiceCount = c.invoices.length;
          const averageInvoice = invoiceCount > 0 ? totalAmount / invoiceCount : 0;

          return {
            customer_number: c.customer_number,
            customer_name: c.customer_name,
            total_amount: totalAmount,
            invoice_count: invoiceCount,
            unpaid_amount: unpaidAmount,
            average_invoice: averageInvoice,
            invoices: c.invoices
          };
        });

        // Sort by selected metric
        const metricKey = params.metric as keyof typeof customerStats[0];
        customerStats.sort((a, b) => (b[metricKey] as number) - (a[metricKey] as number));

        // Take top N
        const topCustomers = customerStats.slice(0, params.top_n);

        // Build output
        const output: Record<string, unknown> = {
          metric: params.metric,
          period: params.period || null,
          date_range: dateRangeDescription || null,
          total_invoices_analyzed: invoices.length,
          unique_customers: customerMap.size,
          truncated: result.truncated,
          truncation_reason: result.truncationReason,
          amount_basis: "SEK, including VAT (converted per invoice currency rate)",
          foreign_currencies_present: foreignCurrencies(invoices),
          customers: topCustomers.map((c, index) => {
            const customer: Record<string, unknown> = {
              rank: index + 1,
              customer_number: c.customer_number,
              customer_name: c.customer_name,
              total_inc_vat_sek: c.total_amount,
              invoice_count: c.invoice_count,
              unpaid_inc_vat_sek: c.unpaid_amount,
              average_invoice_inc_vat_sek: c.average_invoice
            };

            if (params.include_details) {
              customer.invoices = c.invoices.map(inv => ({
                document_number: inv.DocumentNumber,
                invoice_date: inv.InvoiceDate,
                currency: inv.Currency || "SEK",
                total_inc_vat_sek: totalInSEK(inv),
                balance_inc_vat_sek: balanceInSEK(inv)
              }));
            }

            return customer;
          })
        };

        // Format output
        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          const metricLabels: Record<string, string> = {
            total_amount: "Total Invoiced (inc VAT)",
            invoice_count: "Invoice Count",
            unpaid_amount: "Unpaid Amount (inc VAT)",
            average_invoice: "Avg Invoice (inc VAT)"
          };

          const lines: string[] = [
            `# Top ${params.top_n} Customers by ${metricLabels[params.metric]}`,
            "",
            "*Amounts in SEK, including VAT.*",
            ""
          ];

          if (dateRangeDescription) {
            lines.push(`**Period**: ${dateRangeDescription}`);
          }
          lines.push(`**Invoices analyzed**: ${invoices.length} from ${customerMap.size} customers`);
          lines.push("");

          if (result.truncated) {
            lines.push(`⚠️ **Note**: ${result.truncationReason}`);
            lines.push("");
          }

          lines.push(`| Rank | Customer | ${metricLabels[params.metric]} | Invoices | Total | Unpaid |`);
          lines.push(`|------|----------|${"-".repeat(metricLabels[params.metric].length + 2)}|----------|-------|--------|`);

          for (let i = 0; i < topCustomers.length; i++) {
            const c = topCustomers[i];
            const metricValue = params.metric === "invoice_count"
              ? c.invoice_count.toString()
              : formatMoney(c[params.metric]);

            lines.push(
              `| ${i + 1} ` +
              `| ${c.customer_name} ` +
              `| ${metricValue} ` +
              `| ${c.invoice_count} ` +
              `| ${formatMoney(c.total_amount)} ` +
              `| ${formatMoney(c.unpaid_amount)} |`
            );
          }

          textContent = lines.join("\n");
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Unpaid Report Tool
  server.registerTool(
    "fortnox_unpaid_report",
    {
      title: "Unpaid Invoices Report",
      description: `Generate an accounts receivable aging report for unpaid invoices.

Answers questions like:
- "What invoices are overdue?"
- "How much is owed by each customer?"
- "Show me aging breakdown of receivables"

${AMOUNT_CONVENTIONS}

Args:
  - min_amount (number): Only include invoices with balance >= this amount (in SEK)
  - customer_number (string): Filter by specific customer
  - group_by ('customer' | 'age_bucket' | 'both'): How to group report (default: both)
  - include_details (boolean): Include individual invoice list (default: true)
  - response_format ('markdown' | 'json'): Output format

Age Buckets:
  - not_due: Due date is in the future
  - 1-30 / 31-60 / 61-90 / 90+ days overdue

Returns:
  Aging report with balances in SEK (inc VAT — the amounts customers actually owe).`,
      inputSchema: UnpaidReportSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: UnpaidReportInput) => {
      try {
        // Build query params - fetch both unpaid and unpaidoverdue
        const queryParams: Record<string, string | number | boolean | undefined> = {};

        if (params.customer_number) queryParams.customernumber = params.customer_number;

        // Fetch unpaid invoices (includes both unpaid and overdue)
        queryParams.filter = "unpaid";

        const result = await fetchAllPages<FortnoxInvoiceListItem, InvoiceListResponse>(
          "/3/invoices",
          queryParams,
          (r) => r.Invoices || [],
          (r) => r.MetaInformation?.["@TotalResources"] || 0
        );

        let invoices = result.items;

        // Apply min_amount filter (SEK)
        if (params.min_amount !== undefined) {
          invoices = invoices.filter(inv => balanceInSEK(inv) >= params.min_amount!);
        }

        // Calculate overall summary (SEK, inc VAT)
        const totalUnpaid = invoices.reduce((sum, inv) => sum + balanceInSEK(inv), 0);
        const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + totalInSEK(inv), 0);

        // Group by age bucket
        const byAgeBucket = new Map<AgeBucket, FortnoxInvoiceListItem[]>();
        const ageBucketOrder: AgeBucket[] = ["not_due", "1-30 days", "31-60 days", "61-90 days", "90+ days"];

        for (const bucket of ageBucketOrder) {
          byAgeBucket.set(bucket, []);
        }

        for (const inv of invoices) {
          const bucket = getAgeBucket(inv.DueDate);
          byAgeBucket.get(bucket)!.push(inv);
        }

        // Group by customer
        const byCustomer = new Map<string, FortnoxInvoiceListItem[]>();

        for (const inv of invoices) {
          const key = inv.CustomerName || inv.CustomerNumber || "unknown";
          if (!byCustomer.has(key)) {
            byCustomer.set(key, []);
          }
          byCustomer.get(key)!.push(inv);
        }

        // Build output
        const output: Record<string, unknown> = {
          summary: {
            total_invoices: invoices.length,
            total_invoice_amount_inc_vat_sek: totalInvoiceAmount,
            total_unpaid_balance_inc_vat_sek: totalUnpaid,
            unique_customers: byCustomer.size
          },
          amount_basis: "SEK, including VAT (converted per invoice currency rate)",
          foreign_currencies_present: foreignCurrencies(invoices),
          truncated: result.truncated,
          truncation_reason: result.truncationReason
        };

        // Add groupings based on params
        if (params.group_by === "age_bucket" || params.group_by === "both") {
          output.by_age_bucket = ageBucketOrder.map(bucket => {
            const items = byAgeBucket.get(bucket)!;
            return {
              bucket,
              count: items.length,
              total_balance_inc_vat_sek: items.reduce((sum, inv) => sum + balanceInSEK(inv), 0)
            };
          });
        }

        if (params.group_by === "customer" || params.group_by === "both") {
          output.by_customer = Array.from(byCustomer.entries())
            .map(([customer, items]) => ({
              customer,
              count: items.length,
              total_balance_inc_vat_sek: items.reduce((sum, inv) => sum + balanceInSEK(inv), 0)
            }))
            .sort((a, b) => b.total_balance_inc_vat_sek - a.total_balance_inc_vat_sek);
        }

        if (params.include_details) {
          output.invoices = invoices
            .sort((a, b) => balanceInSEK(b) - balanceInSEK(a))
            .map(inv => ({
              document_number: inv.DocumentNumber,
              customer_number: inv.CustomerNumber,
              customer_name: inv.CustomerName || null,
              invoice_date: inv.InvoiceDate || null,
              due_date: inv.DueDate || null,
              currency: inv.Currency || "SEK",
              total_inc_vat: inv.Total || 0,
              balance_inc_vat: inv.Balance || 0,
              balance_inc_vat_sek: balanceInSEK(inv),
              age_bucket: getAgeBucket(inv.DueDate)
            }));
        }

        // Format output
        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          const lines: string[] = [
            "# Unpaid Invoices Report",
            "",
            "*Balances in SEK, including VAT (the amounts owed).*",
            ""
          ];

          if (result.truncated) {
            lines.push(`⚠️ **Note**: ${result.truncationReason}`);
            lines.push("");
          }

          lines.push("## Summary");
          lines.push("");
          lines.push(`| Metric | Value |`);
          lines.push(`|--------|-------|`);
          lines.push(`| Unpaid Invoices | ${invoices.length} |`);
          lines.push(`| Total Invoice Amount (inc VAT) | ${formatMoney(totalInvoiceAmount)} |`);
          lines.push(`| **Total Unpaid Balance (inc VAT)** | **${formatMoney(totalUnpaid)}** |`);
          lines.push(`| Unique Customers | ${byCustomer.size} |`);

          if (params.group_by === "age_bucket" || params.group_by === "both") {
            lines.push("");
            lines.push("## Aging Breakdown");
            lines.push("");
            lines.push("| Age Bucket | Count | Balance |");
            lines.push("|------------|-------|---------|");

            for (const bucket of ageBucketOrder) {
              const items = byAgeBucket.get(bucket)!;
              const balance = items.reduce((sum, inv) => sum + balanceInSEK(inv), 0);
              if (items.length > 0) {
                lines.push(`| ${bucket} | ${items.length} | ${formatMoney(balance)} |`);
              }
            }
          }

          if (params.group_by === "customer" || params.group_by === "both") {
            lines.push("");
            lines.push("## By Customer");
            lines.push("");
            lines.push("| Customer | Invoices | Balance |");
            lines.push("|----------|----------|---------|");

            const customerEntries = Array.from(byCustomer.entries())
              .map(([customer, items]) => ({
                customer,
                count: items.length,
                balance: items.reduce((sum, inv) => sum + balanceInSEK(inv), 0)
              }))
              .sort((a, b) => b.balance - a.balance)
              .slice(0, 20); // Limit to top 20 in markdown

            for (const entry of customerEntries) {
              lines.push(`| ${entry.customer} | ${entry.count} | ${formatMoney(entry.balance)} |`);
            }

            if (byCustomer.size > 20) {
              lines.push(`| ... and ${byCustomer.size - 20} more | | |`);
            }
          }

          if (params.include_details && invoices.length > 0) {
            lines.push("");
            lines.push("## Invoice Details");
            lines.push("");
            lines.push("| Invoice | Customer | Due Date | Balance | Age |");
            lines.push("|---------|----------|----------|---------|-----|");

            const displayInvoices = invoices
              .sort((a, b) => balanceInSEK(b) - balanceInSEK(a))
              .slice(0, 50); // Limit to top 50 in markdown

            for (const inv of displayInvoices) {
              const bucket = getAgeBucket(inv.DueDate);
              lines.push(
                `| #${inv.DocumentNumber} ` +
                `| ${inv.CustomerName || inv.CustomerNumber} ` +
                `| ${inv.DueDate || "-"} ` +
                `| ${formatMoney(balanceInSEK(inv))} ` +
                `| ${bucket} |`
              );
            }

            if (invoices.length > 50) {
              lines.push(`| ... and ${invoices.length - 50} more | | | | |`);
            }
          }

          textContent = lines.join("\n");
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Net Revenue Tool (bookkeeping-based, ex VAT)
  server.registerTool(
    "fortnox_net_revenue",
    {
      title: "Net Revenue (ex VAT, from Bookkeeping)",
      description: `Calculate exact net revenue (nettoomsättning, EXCLUDING VAT) from the bookkeeping.

This is the correct source for revenue figures: it sums credit minus debit on revenue accounts (default 3000-3799) from booked vouchers. Bookkeeping amounts are always in SEK and always ex VAT, so no VAT or currency approximations are involved — unlike the invoice-list based tools, whose amounts include VAT.

IMPORTANT: The financial_year parameter uses Fortnox sequential IDs (1, 2, 3...), NOT calendar years. When analyzing a previous financial year, first call fortnox_list_financial_years to find the ID.

Note: The Fortnox API requires fetching voucher details one by one, so the scan is capped by max_vouchers (default 500). If the result reports truncation, narrow the date range and combine results.

Args:
  - period ('this_month' | 'this_year' | ...): Convenience date period
  - from_date / to_date (string): Explicit date range YYYY-MM-DD
  - financial_year (number): Fortnox financial year ID (required for dates outside the current financial year)
  - account_from / account_to (number): Revenue account range (default 3000-3799 = nettoomsättning; set account_to=3999 to include other operating income)
  - group_by ('month' | 'account' | 'none'): Breakdown dimension (default: month)
  - max_vouchers (number): Max vouchers to scan, 10-500 (default: 500)
  - response_format ('markdown' | 'json'): Output format

Returns:
  net_revenue_ex_vat_sek with optional monthly or per-account breakdown, plus scan coverage info.`,
      inputSchema: NetRevenueSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: NetRevenueInput) => {
      try {
        // Resolve date range
        const queryParams: Record<string, string | number | boolean | undefined> = {
          financialyear: params.financial_year
        };
        let dateRangeDescription: string | undefined;
        if (params.period) {
          const dateRange = periodToDateRange(params.period);
          queryParams.fromdate = dateRange.from_date;
          queryParams.todate = dateRange.to_date;
          dateRangeDescription = getPeriodDescription(params.period);
        } else if (params.from_date || params.to_date) {
          if (params.from_date) queryParams.fromdate = params.from_date;
          if (params.to_date) queryParams.todate = params.to_date;
          dateRangeDescription = `${params.from_date || "start"} to ${params.to_date || "end"}`;
        }

        // Fetch voucher list for the range
        const listResult = await fetchAllPages<FortnoxVoucherListItem, VoucherListResponse>(
          "/3/vouchers",
          queryParams,
          (r) => r.Vouchers || [],
          (r) => r.MetaInformation?.["@TotalResources"] || 0,
          { maxResults: params.max_vouchers, maxPages: Math.ceil(params.max_vouchers / 100) }
        );

        const voucherList = listResult.items;

        // Fetch voucher details in batches and sum revenue rows
        let totalRevenue = 0;
        const byMonth = new Map<string, number>();
        const byAccount = new Map<number, number>();
        let scannedVouchers = 0;
        let failedVouchers = 0;

        const batchSize = 10;
        for (let i = 0; i < voucherList.length; i += batchSize) {
          const batch = voucherList.slice(i, i + batchSize);

          const details = await Promise.all(batch.map(async (v) => {
            try {
              const detail = await fortnoxRequest<VoucherDetailResponse>(
                `/3/vouchers/${encodeURIComponent(v.VoucherSeries)}/${v.VoucherNumber}`,
                "GET",
                undefined,
                { financialyear: params.financial_year }
              );
              return detail.Voucher;
            } catch {
              return null;
            }
          }));

          for (const voucher of details) {
            if (!voucher) {
              failedVouchers++;
              continue;
            }
            scannedVouchers++;
            if (!voucher.VoucherRows) continue;

            for (const row of voucher.VoucherRows) {
              if (row.Account >= params.account_from && row.Account <= params.account_to) {
                // Revenue accounts are credit-normal: revenue = credit - debit
                const amount = (row.Credit || 0) - (row.Debit || 0);
                totalRevenue += amount;

                const monthKey = getMonthKey(voucher.TransactionDate);
                byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + amount);
                byAccount.set(row.Account, (byAccount.get(row.Account) || 0) + amount);
              }
            }
          }
        }

        const truncated = listResult.truncated || listResult.total > voucherList.length;

        const output: Record<string, unknown> = {
          period: params.period || null,
          date_range: dateRangeDescription || null,
          financial_year: params.financial_year || null,
          account_range: { from: params.account_from, to: params.account_to },
          amount_basis: "SEK, excluding VAT (from bookkeeping)",
          net_revenue_ex_vat_sek: totalRevenue,
          scan: {
            vouchers_in_range: listResult.total,
            vouchers_scanned: scannedVouchers,
            vouchers_failed: failedVouchers,
            truncated,
            truncation_note: truncated
              ? `Only ${voucherList.length} of ${listResult.total} vouchers scanned (max_vouchers=${params.max_vouchers}). Narrow the date range for a complete figure.`
              : null
          }
        };

        if (params.group_by === "month") {
          output.by_month = Array.from(byMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => ({ month, net_revenue_ex_vat_sek: amount }));
        } else if (params.group_by === "account") {
          output.by_account = Array.from(byAccount.entries())
            .sort(([a], [b]) => a - b)
            .map(([account, amount]) => ({ account, net_revenue_ex_vat_sek: amount }));
        }

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          const lines: string[] = [
            "# Net Revenue (ex VAT)",
            "",
            `*From bookkeeping, accounts ${params.account_from}-${params.account_to}. Amounts in SEK, excluding VAT.*`,
            ""
          ];

          if (dateRangeDescription) {
            lines.push(`**Period**: ${dateRangeDescription}`);
          }
          lines.push(`**Vouchers scanned**: ${scannedVouchers} of ${listResult.total}`);
          lines.push("");

          if (truncated) {
            lines.push(`⚠️ **Incomplete**: only ${voucherList.length} of ${listResult.total} vouchers scanned. Narrow the date range for a complete figure.`);
            lines.push("");
          }

          lines.push(`## Net Revenue: ${formatMoney(totalRevenue)}`);

          if (params.group_by === "month" && byMonth.size > 0) {
            lines.push("");
            lines.push("| Month | Net Revenue (ex VAT) |");
            lines.push("|-------|----------------------|");
            for (const [month, amount] of Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b))) {
              lines.push(`| ${month} | ${formatMoney(amount)} |`);
            }
          } else if (params.group_by === "account" && byAccount.size > 0) {
            lines.push("");
            lines.push("| Account | Net Revenue (ex VAT) |");
            lines.push("|---------|----------------------|");
            for (const [account, amount] of Array.from(byAccount.entries()).sort(([a], [b]) => a - b)) {
              lines.push(`| ${account} | ${formatMoney(amount)} |`);
            }
          }

          textContent = lines.join("\n");
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
