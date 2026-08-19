/**
 * Money conventions for all analytics in this server.
 *
 * Fortnox documents can be in any currency; every document from the invoice
 * and supplier invoice list APIs carries Currency, CurrencyRate and
 * CurrencyUnit, so amounts are converted exactly to SEK before aggregation
 * (SEK = amount × rate / unit). Order and offer lists expose only Currency
 * (no rate), so those aggregations sum SEK documents and report foreign
 * currency amounts separately instead of silently mixing currencies.
 *
 * Amounts taken from invoice/order/offer lists INCLUDE VAT — the Fortnox
 * list APIs do not expose net amounts. Fields are therefore suffixed
 * `_inc_vat_sek`. Exact ex-VAT revenue (nettoomsättning) can only come from
 * the bookkeeping; use fortnox_net_revenue for that.
 */

/** Document with exact currency information (invoices, supplier invoices) */
export interface CurrencyRatedDoc {
  Total?: number;
  Balance?: number;
  Currency?: string;
  CurrencyRate?: number;
  CurrencyUnit?: number;
}

/** Document with currency but no rate (orders, offers) */
export interface CurrencyOnlyDoc {
  Total?: number;
  Currency?: string;
}

/**
 * Convert an amount in a document's currency to SEK.
 */
export function toSEK(amount: number, currencyRate?: number, currencyUnit?: number): number {
  const rate = currencyRate && currencyRate > 0 ? currencyRate : 1;
  const unit = currencyUnit && currencyUnit > 0 ? currencyUnit : 1;
  return (amount * rate) / unit;
}

/** Document total converted to SEK (includes VAT). */
export function totalInSEK(doc: CurrencyRatedDoc): number {
  return toSEK(doc.Total || 0, doc.CurrencyRate, doc.CurrencyUnit);
}

/** Document unpaid balance converted to SEK (includes VAT). */
export function balanceInSEK(doc: CurrencyRatedDoc): number {
  return toSEK(doc.Balance || 0, doc.CurrencyRate, doc.CurrencyUnit);
}

/** Distinct non-SEK currencies present in a set of documents. */
export function foreignCurrencies(docs: Array<{ Currency?: string }>): string[] {
  const set = new Set<string>();
  for (const d of docs) {
    if (d.Currency && d.Currency !== "SEK") set.add(d.Currency);
  }
  return Array.from(set).sort();
}

/**
 * Split documents without a currency rate into an exact SEK sum and
 * per-foreign-currency sums that cannot be converted exactly.
 */
export function sumByCurrency(docs: CurrencyOnlyDoc[]): {
  sek_total: number;
  foreign_totals: Record<string, number>;
} {
  let sekTotal = 0;
  const foreign: Record<string, number> = {};
  for (const d of docs) {
    const cur = d.Currency || "SEK";
    if (cur === "SEK") {
      sekTotal += d.Total || 0;
    } else {
      foreign[cur] = (foreign[cur] || 0) + (d.Total || 0);
    }
  }
  return { sek_total: sekTotal, foreign_totals: foreign };
}

/**
 * Standard note appended to descriptions of tools that aggregate over
 * invoice/order lists.
 */
export const AMOUNT_CONVENTIONS = `Amount conventions:
- All aggregated amounts are converted to SEK using each document's currency rate (fields suffixed _sek).
- Amounts from invoice/order/offer lists INCLUDE VAT (the Fortnox list API has no net amounts) — fields are suffixed _inc_vat_sek.
- For exact ex-VAT revenue (nettoomsättning), use fortnox_net_revenue, which reads the bookkeeping.`;

/**
 * Markdown warning when foreign currencies are present in an
 * order/offer-based aggregation (no exact rate available).
 */
export function foreignCurrencyWarning(foreignTotals: Record<string, number>): string | null {
  const entries = Object.entries(foreignTotals);
  if (entries.length === 0) return null;
  const parts = entries.map(([cur, amt]) =>
    `${amt.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`);
  return `⚠️ Foreign currency documents excluded from SEK totals (no exchange rate in list data): ${parts.join(", ")}`;
}
