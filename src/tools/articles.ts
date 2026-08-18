import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fortnoxRequest } from "../services/api.js";
import { ResponseFormat } from "../constants.js";
import {
  buildToolResponse,
  buildErrorResponse,
  formatListMarkdown,
  formatDetailMarkdown,
  formatMoney,
  buildPaginationMeta
} from "../services/formatters.js";
import { buildConfirmationRequiredResponse, irreversibleWarning } from "../services/safety.js";
import {
  ListArticlesSchema,
  GetArticleSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  DeleteArticleSchema,
  type ListArticlesInput,
  type GetArticleInput,
  type CreateArticleInput,
  type UpdateArticleInput,
  type DeleteArticleInput
} from "../schemas/articles.js";

interface FortnoxArticle {
  ArticleNumber: string;
  Description: string;
  Type?: string;
  Unit?: string;
  PurchasePrice?: number | string;
  SalesPrice?: number | string;
  VAT?: number | string;
  EAN?: string;
  Manufacturer?: string;
  ManufacturerArticleNumber?: string;
  SupplierNumber?: string;
  SupplierName?: string;
  StockGoods?: boolean;
  StockPlace?: string;
  DefaultStockPoint?: string;
  DefaultStockLocation?: string;
  QuantityInStock?: number;
  ReservedQuantity?: number | string;
  DisposableQuantity?: number | string;
  StockValue?: number | string;
  StockWarning?: number;
  Note?: string;
  Active?: boolean;
  WebshopArticle?: boolean;
  Bulky?: boolean;
  SalesAccount?: number;
  PurchaseAccount?: number;
  StockAccount?: number;
  StockChangeAccount?: number;
  "@url"?: string;
}

interface ArticleListResponse {
  Articles: FortnoxArticle[];
  MetaInformation?: {
    "@TotalResources": number;
    "@TotalPages": number;
    "@CurrentPage": number;
  };
}

interface ArticleResponse {
  Article: FortnoxArticle;
}

function buildArticleBody(params: CreateArticleInput | UpdateArticleInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (params.description !== undefined) body.Description = params.description;
  if (params.type) body.Type = params.type;
  if (params.unit) body.Unit = params.unit;
  if (params.purchase_price !== undefined) body.PurchasePrice = params.purchase_price;
  if (params.sales_price !== undefined) body.SalesPrice = params.sales_price;
  if (params.vat !== undefined) body.VAT = params.vat;
  if (params.ean) body.EAN = params.ean;
  if (params.manufacturer) body.Manufacturer = params.manufacturer;
  if (params.manufacturer_article_number) body.ManufacturerArticleNumber = params.manufacturer_article_number;
  if (params.supplier_number) body.SupplierNumber = params.supplier_number;
  if (params.stock_goods !== undefined) body.StockGoods = params.stock_goods;
  if (params.stock_place) body.StockPlace = params.stock_place;
  if (params.default_stock_point) body.DefaultStockPoint = params.default_stock_point;
  if (params.default_stock_location) body.DefaultStockLocation = params.default_stock_location;
  if (params.stock_warning !== undefined) body.StockWarning = params.stock_warning;
  if (params.note) body.Note = params.note;
  if (params.active !== undefined) body.Active = params.active;
  if (params.webshop_article !== undefined) body.WebshopArticle = params.webshop_article;
  if (params.bulky !== undefined) body.Bulky = params.bulky;
  if (params.sales_account !== undefined) body.SalesAccount = params.sales_account;
  if (params.purchase_account !== undefined) body.PurchaseAccount = params.purchase_account;
  if (params.stock_account !== undefined) body.StockAccount = params.stock_account;
  if (params.stock_change_account !== undefined) body.StockChangeAccount = params.stock_change_account;
  return body;
}

function articleToOutput(a: FortnoxArticle) {
  return {
    article_number: a.ArticleNumber,
    description: a.Description,
    type: a.Type || null,
    unit: a.Unit || null,
    purchase_price: a.PurchasePrice !== undefined ? Number(a.PurchasePrice) : null,
    sales_price: a.SalesPrice !== undefined ? Number(a.SalesPrice) : null,
    vat: a.VAT !== undefined ? Number(a.VAT) : null,
    ean: a.EAN || null,
    manufacturer: a.Manufacturer || null,
    supplier_number: a.SupplierNumber || null,
    stock_goods: a.StockGoods ?? null,
    stock_place: a.StockPlace || null,
    default_stock_point: a.DefaultStockPoint || null,
    default_stock_location: a.DefaultStockLocation || null,
    quantity_in_stock: a.QuantityInStock ?? null,
    reserved_quantity: a.ReservedQuantity !== undefined ? Number(a.ReservedQuantity) : null,
    disposable_quantity: a.DisposableQuantity !== undefined ? Number(a.DisposableQuantity) : null,
    stock_value: a.StockValue !== undefined ? Number(a.StockValue) : null,
    stock_warning: a.StockWarning ?? null,
    active: a.Active ?? true,
    webshop_article: a.WebshopArticle ?? null
  };
}

/**
 * Register all article-related tools
 */
export function registerArticleTools(server: McpServer): void {
  // List articles
  server.registerTool(
    "fortnox_list_articles",
    {
      title: "List Fortnox Articles",
      description: `List articles (products/items) from the Fortnox article register.

Includes stock quantities for stock goods. Supports filtering by article number, description, EAN, supplier, and manufacturer.

Args:
  - limit (number): Max results per page, 1-100 (default: 20)
  - page (number): Page number (default: 1)
  - article_number / search_description / ean / supplier_number / manufacturer (string): Filters
  - filter ('active' | 'inactive'): Filter on article status
  - sort_by: articlenumber | quantityinstock | reservedquantity | stockvalue
  - response_format ('markdown' | 'json'): Output format

Returns:
  List of articles with number, description, prices, and stock quantities.`,
      inputSchema: ListArticlesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListArticlesInput) => {
      try {
        const queryParams: Record<string, string | number | boolean | undefined> = {
          limit: params.limit,
          page: params.page
        };
        if (params.article_number) queryParams.articlenumber = params.article_number;
        if (params.search_description) queryParams.description = params.search_description;
        if (params.ean) queryParams.ean = params.ean;
        if (params.supplier_number) queryParams.suppliernumber = params.supplier_number;
        if (params.manufacturer) queryParams.manufacturer = params.manufacturer;
        if (params.filter) queryParams.filter = params.filter;
        if (params.sort_by) queryParams.sortby = params.sort_by;

        const response = await fortnoxRequest<ArticleListResponse>("/3/articles", "GET", undefined, queryParams);
        const articles = response.Articles || [];
        const total = response.MetaInformation?.["@TotalResources"] || articles.length;

        const output = {
          ...buildPaginationMeta(total, params.page, params.limit, articles.length),
          articles: articles.map((a) => ({
            article_number: a.ArticleNumber,
            description: a.Description,
            unit: a.Unit || null,
            sales_price: a.SalesPrice !== undefined ? Number(a.SalesPrice) : null,
            purchase_price: a.PurchasePrice !== undefined ? Number(a.PurchasePrice) : null,
            quantity_in_stock: a.QuantityInStock ?? null,
            disposable_quantity: a.DisposableQuantity !== undefined ? Number(a.DisposableQuantity) : null,
            stock_value: a.StockValue !== undefined ? Number(a.StockValue) : null
          }))
        };

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatListMarkdown(
            "Articles",
            articles,
            total,
            params.page,
            params.limit,
            (a) => `- **${a.ArticleNumber}**: ${a.Description}` +
              (a.QuantityInStock !== undefined ? ` — in stock: ${a.QuantityInStock}` : "") +
              (a.SalesPrice !== undefined ? ` — price: ${formatMoney(Number(a.SalesPrice))}` : "")
          );
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Get single article
  server.registerTool(
    "fortnox_get_article",
    {
      title: "Get Fortnox Article",
      description: `Retrieve full details for a specific article, including stock status, prices, and account settings.

Args:
  - article_number (string): The article number (required)
  - response_format ('markdown' | 'json'): Output format`,
      inputSchema: GetArticleSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetArticleInput) => {
      try {
        const response = await fortnoxRequest<ArticleResponse>(
          `/3/articles/${encodeURIComponent(params.article_number)}`
        );
        const a = response.Article;
        const output = articleToOutput(a);

        let textContent: string;
        if (params.response_format === ResponseFormat.JSON) {
          textContent = JSON.stringify(output, null, 2);
        } else {
          textContent = formatDetailMarkdown(`Article ${a.ArticleNumber}`, [
            { label: "Article Number", value: a.ArticleNumber },
            { label: "Description", value: a.Description },
            { label: "Type", value: a.Type },
            { label: "Unit", value: a.Unit },
            { label: "Sales Price", value: a.SalesPrice !== undefined ? formatMoney(Number(a.SalesPrice)) : undefined },
            { label: "Purchase Price", value: a.PurchasePrice !== undefined ? formatMoney(Number(a.PurchasePrice)) : undefined },
            { label: "VAT %", value: a.VAT !== undefined ? Number(a.VAT) : undefined },
            { label: "In Stock", value: a.QuantityInStock },
            { label: "Reserved", value: a.ReservedQuantity !== undefined ? Number(a.ReservedQuantity) : undefined },
            { label: "Disposable", value: a.DisposableQuantity !== undefined ? Number(a.DisposableQuantity) : undefined },
            { label: "Stock Value", value: a.StockValue !== undefined ? formatMoney(Number(a.StockValue)) : undefined },
            { label: "Stock Goods", value: a.StockGoods },
            { label: "Stock Place", value: a.StockPlace },
            { label: "Default Stock Point", value: a.DefaultStockPoint },
            { label: "EAN", value: a.EAN },
            { label: "Manufacturer", value: a.Manufacturer },
            { label: "Supplier", value: a.SupplierNumber },
            { label: "Active", value: a.Active }
          ]);
        }

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Create article
  server.registerTool(
    "fortnox_create_article",
    {
      title: "Create Fortnox Article",
      description: `Create a new article (product/item) in the Fortnox article register.

Args:
  - description (string): Article description (required)
  - article_number (string): Article number (auto-generated if omitted)
  - type ('STOCK' | 'SERVICE'): Article type
  - unit, purchase_price, sales_price, vat, ean, manufacturer, supplier_number: Optional attributes
  - stock_goods (boolean): Track in inventory
  - default_stock_point / default_stock_location (string): Lager module defaults
  - sales_account / purchase_account / stock_account / stock_change_account (number): Account settings

Returns:
  The created article.`,
      inputSchema: CreateArticleSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: CreateArticleInput) => {
      try {
        const body = buildArticleBody(params);
        if (params.article_number) body.ArticleNumber = params.article_number;

        const response = await fortnoxRequest<ArticleResponse>("/3/articles", "POST", { Article: body });
        const a = response.Article;

        const output = {
          success: true,
          message: `Article ${a.ArticleNumber} created successfully`,
          ...articleToOutput(a)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Article Created\n\n**Article Number**: ${a.ArticleNumber}\n**Description**: ${a.Description}`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Update article
  server.registerTool(
    "fortnox_update_article",
    {
      title: "Update Fortnox Article",
      description: `Update an existing article. Only provided fields are changed.

Args:
  - article_number (string): Article number to update (required)
  - Any article fields to change (description, prices, stock settings, accounts, active, ...)

Returns:
  The updated article.`,
      inputSchema: UpdateArticleSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: UpdateArticleInput) => {
      try {
        const body = buildArticleBody(params);
        const response = await fortnoxRequest<ArticleResponse>(
          `/3/articles/${encodeURIComponent(params.article_number)}`,
          "PUT",
          { Article: body }
        );
        const a = response.Article;

        const output = {
          success: true,
          message: `Article ${a.ArticleNumber} updated successfully`,
          ...articleToOutput(a)
        };

        const textContent = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : `# Article Updated\n\n**Article Number**: ${a.ArticleNumber}\n**Description**: ${a.Description}`;

        return buildToolResponse(textContent, output);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // Delete article (gated)
  server.registerTool(
    "fortnox_delete_article",
    {
      title: "Delete Fortnox Article",
      description: `Permanently delete an article from the article register.

${irreversibleWarning("The article is deleted permanently and cannot be restored. Fails if the article is used on documents.")}

Args:
  - article_number (string): Article number to delete (required)
  - confirm (boolean): Must be true to execute (see warning)`,
      inputSchema: DeleteArticleSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: DeleteArticleInput) => {
      try {
        if (!params.confirm) {
          return buildConfirmationRequiredResponse(
            `Delete article ${params.article_number}`,
            "The article is permanently deleted and cannot be restored."
          );
        }

        await fortnoxRequest(`/3/articles/${encodeURIComponent(params.article_number)}`, "DELETE");

        const output = {
          success: true,
          message: `Article ${params.article_number} deleted successfully`
        };
        return buildToolResponse(
          `# Article Deleted\n\nArticle **${params.article_number}** has been permanently deleted.`,
          output
        );
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );
}
