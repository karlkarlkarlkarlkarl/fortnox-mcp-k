import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { ConfirmField } from "../services/safety.js";

const responseFormat = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

const dateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * Schema for listing stock takings
 */
export const ListStockTakingsSchema = z.object({
  state: z.enum(["planning", "started", "completed", "voided"]).optional()
    .describe("Filter on stock taking state"),
  item_id: z.string().max(50).optional()
    .describe("Filter on stock takings containing an article"),
  response_format: responseFormat
}).strict();

export type ListStockTakingsInput = z.infer<typeof ListStockTakingsSchema>;

/**
 * Schema for getting a stock taking
 */
export const GetStockTakingSchema = z.object({
  id: z.number().int().min(1)
    .describe("Stock taking document id"),
  include_rows: z.boolean().default(false)
    .describe("Include the counting rows (can be many)"),
  response_format: responseFormat
}).strict();

export type GetStockTakingInput = z.infer<typeof GetStockTakingSchema>;

/**
 * Schema for creating a stock taking
 */
export const CreateStockTakingSchema = z.object({
  name: z.string().min(1).max(100)
    .describe("Stock taking name (required)"),
  responsible: z.string().min(1).max(100)
    .describe("Person responsible (required)"),
  date: dateString.optional()
    .describe("Stock taking date YYYY-MM-DD"),
  cost_center_code: z.string().max(20).optional()
    .describe("Cost center for the adjustment bookkeeping"),
  project_id: z.string().max(20).optional()
    .describe("Project id"),
  response_format: responseFormat
}).strict();

export type CreateStockTakingInput = z.infer<typeof CreateStockTakingSchema>;

/**
 * Schema for adding rows to a stock taking by filter
 */
export const AddStockTakingRowsSchema = z.object({
  id: z.number().int().min(1)
    .describe("Stock taking document id"),
  item_ids: z.array(z.string().min(1).max(50)).max(100).optional()
    .describe("Add rows for these article numbers"),
  stock_point_ids: z.array(z.string().min(1).max(50)).max(50).optional()
    .describe("Limit to these stock point ids"),
  supplier_numbers: z.array(z.string().min(1).max(20)).max(50).optional()
    .describe("Limit to articles from these suppliers"),
  item_id_search: z.string().max(50).optional()
    .describe("Add rows for articles matching this article number search"),
  item_description_search: z.string().max(200).optional()
    .describe("Add rows for articles matching this description search"),
  exclude_zero_balance_items: z.boolean().default(false)
    .describe("Skip articles with zero stock balance"),
  response_format: responseFormat
}).strict();

export type AddStockTakingRowsInput = z.infer<typeof AddStockTakingRowsSchema>;

/**
 * Schema for release/void/delete actions on stock takings (irreversible)
 */
export const StockTakingActionSchema = z.object({
  id: z.number().int().min(1)
    .describe("Stock taking document id"),
  action: z.enum(["release", "void", "delete"])
    .describe("'release' bookkeeps the count and ADJUSTS STOCK to the counted quantities. 'void' cancels (planning/started only). 'delete' permanently deletes the document (planning/started only)"),
  ...ConfirmField
}).strict();

export type StockTakingActionInput = z.infer<typeof StockTakingActionSchema>;

const transferRow = z.object({
  item_id: z.string().min(1).max(50)
    .describe("Article number"),
  requested_quantity: z.number().positive()
    .describe("Quantity to transfer"),
  from_stock_point_id: z.string().min(1).max(50)
    .describe("Source stock point id (UUID). Get from fortnox_list_stock_points"),
  to_stock_point_id: z.string().min(1).max(50)
    .describe("Destination stock point id (UUID)"),
  from_stock_location_id: z.string().max(50).optional()
    .describe("Source stock location id"),
  to_stock_location_id: z.string().max(50).optional()
    .describe("Destination stock location id")
}).strict();

/**
 * Schema for creating a stock transfer
 */
export const CreateStockTransferSchema = z.object({
  rows: z.array(transferRow).min(1).max(100)
    .describe("Transfer rows (required)"),
  transfer_date: dateString.optional()
    .describe("Transfer date YYYY-MM-DD"),
  note: z.string().max(10000).optional()
    .describe("Note"),
  response_format: responseFormat
}).strict();

export type CreateStockTransferInput = z.infer<typeof CreateStockTransferSchema>;

/**
 * Schema for getting a stock transfer
 */
export const GetStockTransferSchema = z.object({
  id: z.number().int().min(1)
    .describe("Stock transfer document id"),
  response_format: responseFormat
}).strict();

export type GetStockTransferInput = z.infer<typeof GetStockTransferSchema>;

/**
 * Schema for release/void actions on stock transfers (irreversible)
 */
export const StockTransferActionSchema = z.object({
  id: z.number().int().min(1)
    .describe("Stock transfer document id"),
  action: z.enum(["release", "void"])
    .describe("'release' executes the transfer (outbound from source, inbound to destination). 'void' cancels an unreleased transfer"),
  ...ConfirmField
}).strict();

export type StockTransferActionInput = z.infer<typeof StockTransferActionSchema>;
