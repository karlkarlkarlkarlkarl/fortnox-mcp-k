import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { ConfirmField } from "../services/safety.js";

const responseFormat = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

const dateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * Schema for listing manual warehouse delivery documents
 */
export const ListWarehouseDeliveriesSchema = z.object({
  type: z.enum(["Inbound", "Outbound", "StockTransfer"]).optional()
    .describe("Filter on document type"),
  state: z.string().max(30).optional()
    .describe("Filter on document state"),
  item_id: z.string().max(50).optional()
    .describe("Filter on documents containing the given article"),
  response_format: responseFormat
}).strict();

export type ListWarehouseDeliveriesInput = z.infer<typeof ListWarehouseDeliveriesSchema>;

/**
 * Schema for getting a manual delivery document
 */
export const GetWarehouseDeliverySchema = z.object({
  direction: z.enum(["inbound", "outbound"])
    .describe("'inbound' for manual inbound deliveries (manuell inleverans), 'outbound' for manual outbound (manuell utleverans)"),
  id: z.number().int().min(1)
    .describe("Delivery document id"),
  response_format: responseFormat
}).strict();

export type GetWarehouseDeliveryInput = z.infer<typeof GetWarehouseDeliverySchema>;

const deliveryRow = z.object({
  item_id: z.string().min(1).max(50)
    .describe("Article number"),
  quantity: z.number().positive()
    .describe("Quantity"),
  stock_point_code: z.string().max(20).optional()
    .describe("Stock point code (overrides document default)"),
  stock_location_code: z.string().max(20).optional()
    .describe("Stock location code"),
  batch: z.string().max(100).optional()
    .describe("Batch number (inbound only)"),
  direct_cost: z.number().min(0).optional()
    .describe("Direct cost per unit (inbound only)"),
  freight_cost: z.number().min(0).optional()
    .describe("Freight cost (inbound only)"),
  other_cost: z.number().min(0).optional()
    .describe("Other cost (inbound only)")
}).strict();

/**
 * Schema for creating a manual delivery document
 */
export const CreateWarehouseDeliverySchema = z.object({
  direction: z.enum(["inbound", "outbound"])
    .describe("'inbound' adds stock (manuell inleverans), 'outbound' removes stock (manuell utleverans)"),
  date: dateString
    .describe("Document date YYYY-MM-DD (cannot be in the future when releasing)"),
  rows: z.array(deliveryRow).min(1).max(100)
    .describe("Delivery rows (required)"),
  stock_point_code: z.string().max(20).optional()
    .describe("Default stock point code for all rows"),
  note: z.string().max(10000).optional()
    .describe("Note on the document"),
  currency: z.string().length(3).default("SEK")
    .describe("Currency for inbound cost values (default SEK)"),
  currency_rate: z.number().positive().default(1)
    .describe("Currency rate (default 1)"),
  response_format: responseFormat
}).strict();

export type CreateWarehouseDeliveryInput = z.infer<typeof CreateWarehouseDeliverySchema>;

/**
 * Schema for release/void actions on manual delivery documents (irreversible)
 */
export const WarehouseDeliveryActionSchema = z.object({
  direction: z.enum(["inbound", "outbound"])
    .describe("Document direction"),
  id: z.number().int().min(1)
    .describe("Delivery document id"),
  action: z.enum(["release", "void"])
    .describe("'release' locks and bookkeeps the document (stock is changed). 'void' cancels it"),
  force: z.boolean().default(false)
    .describe("For voiding a released inbound with connected outbounds. May cause negative stock"),
  custom_void_date: dateString.optional()
    .describe("Bookkeeping date for the void operation (defaults to document date)"),
  ...ConfirmField
}).strict();

export type WarehouseDeliveryActionInput = z.infer<typeof WarehouseDeliveryActionSchema>;

/**
 * Schema for listing incoming goods documents
 */
export const ListIncomingGoodsSchema = z.object({
  released: z.boolean().optional()
    .describe("Filter on released state"),
  completed: z.boolean().optional()
    .describe("Filter on completed state"),
  voided: z.boolean().optional()
    .describe("Filter on voided state"),
  supplier_number: z.string().max(20).optional()
    .describe("Filter on supplier number"),
  item_id: z.string().max(50).optional()
    .describe("Filter on article number"),
  q: z.string().max(100).optional()
    .describe("Free-text search on id or delivery note"),
  response_format: responseFormat
}).strict();

export type ListIncomingGoodsInput = z.infer<typeof ListIncomingGoodsSchema>;

/**
 * Schema for getting an incoming goods document
 */
export const GetIncomingGoodsSchema = z.object({
  id: z.number().int().min(1)
    .describe("Incoming goods document id"),
  response_format: responseFormat
}).strict();

export type GetIncomingGoodsInput = z.infer<typeof GetIncomingGoodsSchema>;

const incomingGoodsRow = z.object({
  item_id: z.string().min(1).max(50)
    .describe("Article number"),
  received_quantity: z.number().min(0)
    .describe("Quantity received"),
  ordered_quantity: z.number().min(0).optional()
    .describe("Quantity ordered (defaults to received_quantity)"),
  purchase_order_id: z.number().int().optional()
    .describe("Purchase order id this row receives against"),
  purchase_order_row_id: z.string().max(50).optional()
    .describe("Purchase order row id"),
  stock_point_code: z.string().max(20).optional()
    .describe("Stock point code"),
  stock_location_code: z.string().max(20).optional()
    .describe("Stock location code"),
  batch: z.string().max(100).optional()
    .describe("Batch number"),
  direct_cost: z.number().min(0).optional()
    .describe("Direct cost per unit")
}).strict();

/**
 * Schema for creating an incoming goods document
 */
export const CreateIncomingGoodsSchema = z.object({
  delivery_note_id: z.string().min(1).max(100)
    .describe("Delivery note (följesedel) reference from the supplier (required)"),
  supplier_number: z.string().max(20).optional()
    .describe("Supplier number"),
  date: dateString.optional()
    .describe("Document date YYYY-MM-DD (defaults to today)"),
  rows: z.array(incomingGoodsRow).min(1).max(100)
    .describe("Received rows (required)"),
  stock_point_code: z.string().max(20).optional()
    .describe("Default stock point code"),
  note: z.string().max(10000).optional()
    .describe("Note"),
  response_format: responseFormat
}).strict();

export type CreateIncomingGoodsInput = z.infer<typeof CreateIncomingGoodsSchema>;

/**
 * Schema for release/complete/void actions on incoming goods (irreversible)
 */
export const IncomingGoodsActionSchema = z.object({
  id: z.number().int().min(1)
    .describe("Incoming goods document id"),
  action: z.enum(["release", "complete", "void"])
    .describe("'release' locks and bookkeeps (stock added). 'complete' finalizes bookkeeping, no more supplier invoice matching. 'void' cancels (not possible if completed or matched)"),
  ...ConfirmField
}).strict();

export type IncomingGoodsActionInput = z.infer<typeof IncomingGoodsActionSchema>;
