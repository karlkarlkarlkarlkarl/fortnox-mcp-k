import { z } from "zod";
import { ResponseFormat, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";
import { ConfirmField } from "../services/safety.js";

const responseFormat = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

/**
 * Schema for listing articles
 */
export const ListArticlesSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
    .describe("Maximum number of results to return (1-100)"),
  page: z.number().int().min(1).default(1)
    .describe("Page number for pagination"),
  article_number: z.string().max(50).optional()
    .describe("Filter by article number"),
  search_description: z.string().max(200).optional()
    .describe("Filter by description"),
  ean: z.string().max(30).optional()
    .describe("Filter by EAN code"),
  supplier_number: z.string().max(20).optional()
    .describe("Filter by supplier number"),
  manufacturer: z.string().max(200).optional()
    .describe("Filter by manufacturer"),
  filter: z.enum(["active", "inactive"]).optional()
    .describe("Filter on active or inactive articles"),
  sort_by: z.enum(["articlenumber", "quantityinstock", "reservedquantity", "stockvalue"]).optional()
    .describe("Field to sort the list by"),
  response_format: responseFormat
}).strict();

export type ListArticlesInput = z.infer<typeof ListArticlesSchema>;

/**
 * Schema for getting a single article
 */
export const GetArticleSchema = z.object({
  article_number: z.string().min(1).max(50)
    .describe("The article number to retrieve"),
  response_format: responseFormat
}).strict();

export type GetArticleInput = z.infer<typeof GetArticleSchema>;

/**
 * Fields shared between create and update
 */
const articleFields = {
  description: z.string().min(1).max(200).optional()
    .describe("Article description"),
  type: z.enum(["STOCK", "SERVICE"]).optional()
    .describe("Article type: STOCK (physical stock item) or SERVICE"),
  unit: z.string().max(10).optional()
    .describe("Unit code (e.g. 'st', 'kg', 'h'). Must exist in Fortnox units register"),
  purchase_price: z.number().min(0).optional()
    .describe("Purchase price"),
  sales_price: z.number().min(0).optional()
    .describe("Sales price (excluding VAT)"),
  vat: z.number().min(0).max(100).optional()
    .describe("VAT percentage (e.g. 25)"),
  ean: z.string().max(30).optional()
    .describe("EAN / barcode"),
  manufacturer: z.string().max(200).optional()
    .describe("Manufacturer name"),
  manufacturer_article_number: z.string().max(200).optional()
    .describe("Manufacturer's article number"),
  supplier_number: z.string().max(20).optional()
    .describe("Default supplier number"),
  stock_goods: z.boolean().optional()
    .describe("Whether the article is stock goods (tracked in inventory)"),
  stock_place: z.string().max(100).optional()
    .describe("Stock place (free-text, classic stock module)"),
  default_stock_point: z.string().max(20).optional()
    .describe("Default stock point code (Lager module)"),
  default_stock_location: z.string().max(20).optional()
    .describe("Default stock location code (Lager module)"),
  stock_warning: z.number().min(0).optional()
    .describe("Stock warning level (alert when stock drops below this)"),
  note: z.string().max(10000).optional()
    .describe("Internal note"),
  active: z.boolean().optional()
    .describe("Whether the article is active"),
  webshop_article: z.boolean().optional()
    .describe("Whether the article is published in the webshop"),
  bulky: z.boolean().optional()
    .describe("Whether the article is bulky (skrymmande)"),
  sales_account: z.number().int().min(1000).max(9999).optional()
    .describe("Sales account number"),
  purchase_account: z.number().int().min(1000).max(9999).optional()
    .describe("Purchase account number"),
  stock_account: z.number().int().min(1000).max(9999).optional()
    .describe("Stock (inventory) account number"),
  stock_change_account: z.number().int().min(1000).max(9999).optional()
    .describe("Stock change account number")
};

/**
 * Schema for creating an article
 */
export const CreateArticleSchema = z.object({
  article_number: z.string().max(50).optional()
    .describe("Article number (auto-generated if omitted)"),
  ...articleFields,
  description: z.string().min(1).max(200)
    .describe("Article description (required)"),
  response_format: responseFormat
}).strict();

export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;

/**
 * Schema for updating an article
 */
export const UpdateArticleSchema = z.object({
  article_number: z.string().min(1).max(50)
    .describe("Article number to update (required)"),
  ...articleFields,
  response_format: responseFormat
}).strict();

export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;

/**
 * Schema for deleting an article (irreversible - requires confirmation)
 */
export const DeleteArticleSchema = z.object({
  article_number: z.string().min(1).max(50)
    .describe("Article number to delete permanently"),
  ...ConfirmField
}).strict();

export type DeleteArticleInput = z.infer<typeof DeleteArticleSchema>;
