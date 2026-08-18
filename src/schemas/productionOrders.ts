import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { ConfirmField } from "../services/safety.js";

const responseFormat = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

const dateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * Schema for listing production orders
 */
export const ListProductionOrdersSchema = z.object({
  state: z.enum(["registered", "reserved", "ongoing", "completed", "voided"]).optional()
    .describe("Filter on production order state"),
  item_id: z.string().max(50).optional()
    .describe("Filter on the produced article number"),
  response_format: responseFormat
}).strict();

export type ListProductionOrdersInput = z.infer<typeof ListProductionOrdersSchema>;

/**
 * Schema for getting a production order
 */
export const GetProductionOrderSchema = z.object({
  id: z.number().int().min(1)
    .describe("Production order document id"),
  response_format: responseFormat
}).strict();

export type GetProductionOrderInput = z.infer<typeof GetProductionOrderSchema>;

/**
 * Schema for creating a production order
 */
export const CreateProductionOrderSchema = z.object({
  item_id: z.string().min(1).max(50)
    .describe("Article number of the item to produce (must be a production article with a bill of materials)"),
  quantity: z.number().positive()
    .describe("Number of units to produce"),
  start_date: dateString
    .describe("Production start date (YYYY-MM-DD)"),
  production_date: dateString.optional()
    .describe("Production (completion) date (YYYY-MM-DD). Required before release"),
  production_state: z.enum(["registered", "reserved", "ongoing"]).default("registered")
    .describe("Initial state. 'reserved' reserves component stock immediately"),
  batch: z.string().max(100).optional()
    .describe("Batch number for the produced items"),
  note: z.string().max(10000).optional()
    .describe("Note on the production order"),
  project_id: z.string().max(20).optional()
    .describe("Project id"),
  cost_center_code: z.string().max(20).optional()
    .describe("Cost center code"),
  inbound_stock_point_id: z.string().max(50).optional()
    .describe("Stock point id where produced items are stocked"),
  inbound_stock_location_id: z.string().max(50).optional()
    .describe("Stock location id where produced items are stocked"),
  outbound_stock_point_id: z.string().max(50).optional()
    .describe("Stock point id components are taken from"),
  response_format: responseFormat
}).strict();

export type CreateProductionOrderInput = z.infer<typeof CreateProductionOrderSchema>;

/**
 * Schema for updating a production order (fetch-merge-put)
 */
export const UpdateProductionOrderSchema = z.object({
  id: z.number().int().min(1)
    .describe("Production order document id to update"),
  quantity: z.number().positive().optional()
    .describe("New quantity to produce"),
  start_date: dateString.optional()
    .describe("New start date (YYYY-MM-DD)"),
  production_date: dateString.optional()
    .describe("New production date (YYYY-MM-DD)"),
  production_state: z.enum(["registered", "reserved", "ongoing"]).optional()
    .describe("New state (moving to 'reserved' reserves component stock)"),
  batch: z.string().max(100).optional()
    .describe("New batch number"),
  note: z.string().max(10000).optional()
    .describe("New note"),
  response_format: responseFormat
}).strict();

export type UpdateProductionOrderInput = z.infer<typeof UpdateProductionOrderSchema>;

/**
 * Schema for bill of materials lookup
 */
export const GetBillOfMaterialsSchema = z.object({
  item_id: z.string().min(1).max(50)
    .describe("Production article number"),
  quantity: z.number().positive().optional()
    .describe("Quantity to calculate component requirements for (default 1)"),
  production_order_id: z.number().int().min(1).optional()
    .describe("Optional production order id for order-specific calculation"),
  response_format: responseFormat
}).strict();

export type GetBillOfMaterialsInput = z.infer<typeof GetBillOfMaterialsSchema>;

/**
 * Schema for release/void actions on production orders (irreversible)
 */
export const ProductionOrderActionSchema = z.object({
  id: z.number().int().min(1)
    .describe("Production order document id"),
  action: z.enum(["release", "void"])
    .describe("'release' locks and bookkeeps the order (consumes components, stocks produced items). 'void' cancels the order"),
  force: z.boolean().default(false)
    .describe("For 'void' of a released order: force void even with connected outbounds. May cause negative stock"),
  ...ConfirmField
}).strict();

export type ProductionOrderActionInput = z.infer<typeof ProductionOrderActionSchema>;
