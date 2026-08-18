import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { ConfirmField } from "../services/safety.js";

const responseFormat = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' or 'json'");

const dateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * Schema for listing purchase orders
 */
export const ListPurchaseOrdersSchema = z.object({
  q: z.string().max(100).optional()
    .describe("Free-text search on order id or internal reference"),
  supplier_number: z.string().max(20).optional()
    .describe("Filter on supplier number"),
  state: z.enum(["NOT_SENT", "SENT", "SENT_NOT_REJECTED", "DELAYED", "RECEIVED", "VOIDED", "CURRENT", "ALL"]).optional()
    .describe("Filter on purchase order state"),
  item_id: z.string().max(50).optional()
    .describe("Filter on article number"),
  purchase_type: z.enum(["WAREHOUSE", "DROPSHIP"]).optional()
    .describe("Filter on purchase type"),
  response_format: responseFormat
}).strict();

export type ListPurchaseOrdersInput = z.infer<typeof ListPurchaseOrdersSchema>;

/**
 * Schema for getting a purchase order
 */
export const GetPurchaseOrderSchema = z.object({
  id: z.number().int().min(1)
    .describe("Purchase order id"),
  response_format: responseFormat
}).strict();

export type GetPurchaseOrderInput = z.infer<typeof GetPurchaseOrderSchema>;

const purchaseOrderRow = z.object({
  item_id: z.string().min(1).max(50)
    .describe("Article number"),
  ordered_quantity: z.number().positive()
    .describe("Quantity to order"),
  price: z.number().min(0).optional()
    .describe("Price per unit (defaults to article purchase price)"),
  stock_point_code: z.string().max(20).optional()
    .describe("Stock point code the goods are delivered to"),
  stock_location_code: z.string().max(20).optional()
    .describe("Stock location code")
}).strict();

/**
 * Schema for creating a purchase order
 */
export const CreatePurchaseOrderSchema = z.object({
  supplier_number: z.string().min(1).max(20)
    .describe("Supplier number (required)"),
  rows: z.array(purchaseOrderRow).min(1).max(100)
    .describe("Order rows (required)"),
  order_date: dateString.optional()
    .describe("Order date YYYY-MM-DD (defaults to today)"),
  delivery_date: dateString.optional()
    .describe("Requested delivery date YYYY-MM-DD"),
  stock_point_code: z.string().max(20).optional()
    .describe("Stock point code goods are delivered to (delivery address is taken from the stock point)"),
  internal_reference: z.string().max(100).optional()
    .describe("Internal reference"),
  our_reference: z.string().max(50).optional()
    .describe("Our reference (person)"),
  message_to_supplier: z.string().max(10000).optional()
    .describe("Message printed on the order"),
  note: z.string().max(10000).optional()
    .describe("Internal note"),
  currency_code: z.string().length(3).default("SEK")
    .describe("Currency code (default SEK)"),
  currency_rate: z.number().positive().default(1)
    .describe("Currency rate (default 1)"),
  payment_terms_code: z.string().max(20).optional()
    .describe("Payment terms code (defaults to the supplier's terms)"),
  project_id: z.string().max(20).optional()
    .describe("Project id"),
  cost_center_code: z.string().max(20).optional()
    .describe("Cost center code"),
  response_format: responseFormat
}).strict();

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;

/**
 * Schema for updating a purchase order (fetch-merge-put)
 */
export const UpdatePurchaseOrderSchema = z.object({
  id: z.number().int().min(1)
    .describe("Purchase order id to update"),
  delivery_date: dateString.optional()
    .describe("New requested delivery date"),
  internal_reference: z.string().max(100).optional()
    .describe("New internal reference"),
  message_to_supplier: z.string().max(10000).optional()
    .describe("New message to supplier"),
  note: z.string().max(10000).optional()
    .describe("New internal note"),
  response_format: responseFormat
}).strict();

export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;

/**
 * Schema for sending a purchase order via email (external side effect)
 */
export const SendPurchaseOrderSchema = z.object({
  id: z.number().int().min(1)
    .describe("Purchase order id to send"),
  receiver: z.string().email().max(200)
    .describe("Recipient email address (required)"),
  subject: z.string().min(1).max(200)
    .describe("Email subject (required)"),
  body: z.string().min(1).max(10000)
    .describe("Email body text (required)"),
  reply_to: z.string().email().max(200)
    .describe("Reply-to email address (required)"),
  sender_name: z.string().max(100).optional()
    .describe("Sender display name"),
  receiver_copy: z.string().email().max(200).optional()
    .describe("CC email address"),
  ...ConfirmField
}).strict();

export type SendPurchaseOrderInput = z.infer<typeof SendPurchaseOrderSchema>;

/**
 * Schema for complete/void actions on purchase orders (irreversible)
 */
export const PurchaseOrderActionSchema = z.object({
  id: z.number().int().min(1)
    .describe("Purchase order id"),
  action: z.enum(["complete", "void"])
    .describe("'complete' marks the order fully received (remaining quantities ignored). 'void' cancels the order"),
  ...ConfirmField
}).strict();

export type PurchaseOrderActionInput = z.infer<typeof PurchaseOrderActionSchema>;
