import { z } from "zod";
import { ResponseFormat } from "../constants.js";

const responseFormat = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

/**
 * Schema for checking warehouse module activation
 */
export const GetWarehouseStatusSchema = z.object({
  response_format: responseFormat
}).strict();

export type GetWarehouseStatusInput = z.infer<typeof GetWarehouseStatusSchema>;

/**
 * Schema for stock balance query
 */
export const GetStockBalanceSchema = z.object({
  item_ids: z.array(z.string().min(1).max(50)).max(100).optional()
    .describe("Filter on specific article numbers (itemIds)"),
  stock_point_codes: z.array(z.string().min(1).max(20)).max(50).optional()
    .describe("Filter on specific stock point codes"),
  response_format: responseFormat
}).strict();

export type GetStockBalanceInput = z.infer<typeof GetStockBalanceSchema>;

/**
 * Schema for listing stock points
 */
export const ListStockPointsSchema = z.object({
  q: z.string().max(100).optional()
    .describe("Filter on stock point code or name"),
  state: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE")
    .describe("Filter on stock point state (default: ACTIVE)"),
  response_format: responseFormat
}).strict();

export type ListStockPointsInput = z.infer<typeof ListStockPointsSchema>;

/**
 * Schema for getting one stock point (by id or code), including stock locations
 */
export const GetStockPointSchema = z.object({
  id_or_code: z.string().min(1).max(50)
    .describe("Stock point id (UUID) or stock point code"),
  response_format: responseFormat
}).strict();

export type GetStockPointInput = z.infer<typeof GetStockPointSchema>;

/**
 * Schema for creating a stock point
 */
export const CreateStockPointSchema = z.object({
  code: z.string().min(1).max(20)
    .describe("Stock point code (required, e.g. 'HUVUD')"),
  name: z.string().min(1).max(100)
    .describe("Stock point name (required)"),
  stock_locations: z.array(z.object({
    code: z.string().min(1).max(20).describe("Stock location code"),
    name: z.string().max(100).optional().describe("Stock location name")
  }).strict()).max(100).optional()
    .describe("Stock locations to create within the stock point"),
  delivery_name: z.string().max(100).optional().describe("Delivery address: name"),
  delivery_address: z.string().max(200).optional().describe("Delivery address: street"),
  delivery_zip_code: z.string().max(10).optional().describe("Delivery address: zip code"),
  delivery_city: z.string().max(100).optional().describe("Delivery address: city"),
  delivery_country_code: z.string().max(2).optional().describe("Delivery address: country code (e.g. 'SE')"),
  response_format: responseFormat
}).strict();

export type CreateStockPointInput = z.infer<typeof CreateStockPointSchema>;
