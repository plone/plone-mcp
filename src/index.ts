#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  TextContent,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { markdownParse } from "./markdown-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// SECTION 1: CONFIGURATION & TYPES
// =============================================================================

// Load block specifications from JSON
const blocksSpecification = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "blocks.json"), "utf-8"));
  } catch (error) {
    console.error("Error loading blocks specification:", error);
    return;
  }
})();

// Environment variable names for configuration
const ENV_BASE_URL = "PLONE_BASE_URL";
const ENV_USERNAME = "PLONE_USERNAME";
const ENV_PASSWORD = "PLONE_PASSWORD";
const ENV_TOKEN = "PLONE_TOKEN";

// Helper for optional non-empty strings with environment variable fallback
const optionalNonEmpty = (envVar: string) =>
  z
    .string()
    .optional()
    .refine((val) => !val || val.trim() !== "", {
      message: `Cannot be empty string. Omit field to use ${envVar} environment variable.`,
    });

// Helper to validate URL format
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Configuration schema - all fields are optional to allow environment variable fallback
export const ConfigSchema = z.object({
  baseUrl: optionalNonEmpty(ENV_BASE_URL).refine(
    (val) => !val || isValidUrl(val),
    {
      message: "Must be a valid URL (e.g., https://example.com)",
    }
  ),
  username: optionalNonEmpty(ENV_USERNAME),
  password: optionalNonEmpty(ENV_PASSWORD),
  token: optionalNonEmpty(ENV_TOKEN),
});

type Config = z.infer<typeof ConfigSchema>;

/**
 * Resolves configuration by merging provided config with environment variables.
 * Environment variables are used as fallback when config values are not provided.
 *
 * Supported environment variables:
 * - PLONE_BASE_URL: Base URL of the Plone site
 * - PLONE_USERNAME: Username for authentication
 * - PLONE_PASSWORD: Password for authentication
 * - PLONE_TOKEN: JWT token for authentication
 */
function resolveConfig(config: Config): Config & { baseUrl: string } {
  const baseUrl = config.baseUrl || process.env[ENV_BASE_URL];
  const username = config.username || process.env[ENV_USERNAME];
  const password = config.password || process.env[ENV_PASSWORD];
  const token = config.token || process.env[ENV_TOKEN];

  // Validate baseUrl exists and is not empty
  if (!baseUrl || baseUrl.trim() === "") {
    throw new Error(
      `Base URL is required. Provide it via config.baseUrl or ${ENV_BASE_URL} environment variable.`
    );
  }

  if (!isValidUrl(baseUrl)) {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }

  return {
    baseUrl,
    username,
    password,
    token,
  };
}

// Plone content interface
interface PloneContent {
  "@type": string;
  title: string;
  blocks?: Record<string, any>;
  blocks_layout?: { items: string[] };
  [key: string]: any;
}

// =============================================================================
// SECTION 2: CORE CLASSES
// =============================================================================

/**
 * BlockRegistry for centralizing block type management
 */
class BlockRegistry {
  private specifications: Record<string, any>;

  constructor(specs: Record<string, any>) {
    this.specifications = specs;
  }

  getBlockTypes(): string[] {
    return Object.keys(this.specifications);
  }

  getBlockTypesEnum(): [string, ...string[]] {
    const types = this.getBlockTypes();
    if (types.length === 0) {
      throw new Error("No block types available");
    }
    return types as [string, ...string[]];
  }

  getSpecifications(): Record<string, any> {
    return this.specifications;
  }

  getSpecification(blockType: string): any {
    return this.specifications[blockType];
  }
}

// Initialize block registry
const blockRegistry = new BlockRegistry(blocksSpecification);

/**
 * HTTP client for communicating with Plone REST API
 */
export class PloneClient {
  private axios: AxiosInstance;
  public config: Config & { baseUrl: string };

  constructor(config: Config) {
    this.config = resolveConfig(config);
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");

    this.axios = axios.create({
      baseURL: `${baseUrl}/++api++`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Set up authentication
    if (this.config.token) {
      this.axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${this.config.token}`;
    } else if (this.config.username && this.config.password) {
      this.axios.defaults.auth = {
        username: this.config.username,
        password: this.config.password,
      };
    }
  }

  // IMPROVEMENT: Centralize path normalization
  normalizePath(path: string): string {
    if (!path) return "/";
    // Remove trailing slash, ensure leading slash
    let normalized = path.replace(/\/$/, "");
    if (!normalized.startsWith("/") && normalized !== "") {
      normalized = `/${normalized}`;
    }
    return normalized;
  }

  async get(path: string, params?: Record<string, any>): Promise<any> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.get(normalizedPath, { params });
    return response.data;
  }

  async post(path: string, data?: any): Promise<any> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.post(normalizedPath, data);
    return response.data;
  }

  async patch(path: string, data?: any): Promise<any> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.patch(normalizedPath, data);
    return response.data;
  }

  async delete(path: string): Promise<any> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.delete(normalizedPath);
    return response.data;
  }
}

// =============================================================================
// SECTION 3: TOOL SCHEMAS
// =============================================================================

const PloneConfigureSchema = z.object({
  baseUrl: optionalNonEmpty(ENV_BASE_URL)
    .refine((val) => !val || isValidUrl(val), {
      message: "Must be a valid URL (e.g., https://example.com)",
    })
    .describe(
      "Base URL of the Plone site. Can be set via PLONE_BASE_URL environment variable."
    ),
  username: optionalNonEmpty(ENV_USERNAME).describe(
    "Username for authentication. Can be set via PLONE_USERNAME environment variable."
  ),
  password: optionalNonEmpty(ENV_PASSWORD).describe(
    "Password for authentication. Can be set via PLONE_PASSWORD environment variable."
  ),
  token: optionalNonEmpty(ENV_TOKEN).describe(
    "JWT token for authentication (alternative to username/password). Can be set via PLONE_TOKEN environment variable."
  ),
});

const PloneGetContentSchema = z.object({
  path: z
    .string()
    .describe(
      "Path to content (e.g., '/parentDocument/document' or just '/' for root level)"
    ),
  expand: z
    .array(z.string())
    .optional()
    .describe(
      "Components to expand (e.g., ['breadcrumbs', 'actions', 'workflow'])"
    ),
});

const PloneCreateContentSchema = z.object({
  parentPath: z
    .string()
    .describe(
      "Path where to create the content (e.g., '/parentDocument' or '/' for root)"
    ),
  type: z
    .string()
    .describe(
      "Content type to create (e.g., 'Document', 'Event', 'News Item')"
    ),
  title: z.string().describe("Title of the new content"),
  description: z.string().optional().describe("Description of the new content"),
  id: z
    .string()
    .optional()
    .describe(
      "ID for the new content (optional, will be auto-generated if not provided)"
    ),
  blocks: z
    .record(z.any())
    .optional()
    .describe(
      "Volto blocks structure for the content, it specifies the blocks data and content"
    ),
  blocks_layout: z
    .record(z.any())
    .optional()
    .describe(
      "Volto blocks layout configuration, it specifies the order of blocks"
    ),
  additionalFields: z
    .record(z.any())
    .optional()
    .describe("Additional fields to update. For preview images, include preview_image_link: { '@id': 'image-url' } in this object (if you get a 400 error, make sure the image URL is accessible)."),
});

const PloneUpdateContentSchema = z.object({
  path: z.string().describe("Path to the content to update"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  blocks: z
    .record(z.any())
    .optional()
    .describe("Volto blocks structure for the content"),
  blocks_layout: z
    .record(z.any())
    .optional()
    .describe("Volto blocks layout configuration"),
  additionalFields: z
    .record(z.any())
    .optional()
    .describe("Additional fields to update. For preview images, include preview_image_link: { '@id': 'image-url' } in this object (if you get a 400 error, make sure the image URL is accessible)."),
});

const PloneDeleteContentSchema = z.object({
  path: z.string().describe("Path to the content to delete"),
});

const PloneSearchSchema = z.object({
  query: z.string().optional().describe("Search query text"),
  portal_type: z
    .array(z.string())
    .optional()
    .describe("Content types to search for"),
  path: z.string().optional().describe("Path to search within"),
  review_state: z
    .array(z.string())
    .optional()
    .describe("Workflow states to filter by"),
  sort_on: z
    .string()
    .optional()
    .describe(
      "Field to sort by (e.g., 'modified', 'created', 'sortable_title')"
    ),
  sort_order: z
    .enum(["ascending", "descending"])
    .optional()
    .describe("Sort order"),
  b_size: z
    .number()
    .optional()
    .describe("Batch size (number of results per page)"),
  b_start: z.number().optional().describe("Batch start (for pagination)"),
});

const PloneGetWorkflowInfoSchema = z.object({
  path: z.string().describe("Path to the content"),
});

const PloneTransitionWorkflowSchema = z.object({
  path: z.string().describe("Path to the content"),
  transition: z.string().describe("Workflow transition to execute"),
  comment: z.string().optional().describe("Comment for the transition"),
});

const PloneGetVocabulariesSchema = z.object({
  vocabulary: z.string().describe("Vocabulary name"),
  title: z.string().optional().describe("Filter by title"),
  token: z.string().optional().describe("Filter by token"),
});

// Dynamic block schemas using centralized registry
const PloneAddBlockSchema = z.object({
  path: z.string().describe("Path to the content"),
  blockType: z
    .enum(blockRegistry.getBlockTypesEnum())
    .describe("Type of block to add"),
  blockData: z.record(z.any()).describe("Block-specific data"),
  position: z
    .number()
    .optional()
    .describe("Position to insert the block (optional, defaults to end)"),
});

const PloneUpdateBlockSchema = z.object({
  path: z.string().describe("Path to the content"),
  blockId: z.string().describe("ID of the block to update"),
  blockData: z.record(z.any()).describe("New block data"),
});

const PloneRemoveBlockSchema = z.object({
  path: z.string().describe("Path to the content"),
  blockId: z.string().describe("ID of the block to remove"),
});

const PloneCreateBlocksLayoutSchema = z.object({
  blocks: z
    .array(
      z.object({
        type: z
          .enum(blockRegistry.getBlockTypesEnum())
          .describe("Type of block to create"),
        data: z
          .record(z.any())
          .describe("Block-specific data following the block specification"),
        position: z
          .number()
          .optional()
          .describe(
            "Position in the layout (optional, defaults to sequential order)"
          ),
      })
    )
    .describe(
      "Array of block specifications to process. You MUST call plone_get_block_schemas first to see available block types and their required fields. You MUST follow the block specifications EXACTLY, DO NOT invent your own fields. DO NOT add the content object's title in a text block. To set the page title, use the 'title' field of the content object itself when calling plone_create_content or plone_update_content. A Title block will be automatically created by Plone."
    ),
});

const PloneGetBlockSchemasSchema = z.object({
  blockType: z
    .enum(blockRegistry.getBlockTypesEnum())
    .optional()
    .describe(
      "Specific block type to get schema for (optional, returns all if not specified)."
    ),
});

// =============================================================================
// SECTION 4: MAIN MCP SERVER CLASS
// =============================================================================

class PloneMCPServer {
  private server: McpServer;
  private client: PloneClient | null = null;
  private preparedBlocks: {
    blocks: Record<string, any>;
    blocks_layout: { items: string[] };
    timestamp: number; // IMPROVEMENT: Add timestamp for expiration
  } | null = null;
  private readonly PREPARED_BLOCKS_TTL = 60000; // 60 seconds TTL

  constructor() {
    this.server = new McpServer(
      {
        name: "plone-mcp-server",
        version: "1.0.0",
        description:
          "A comprehensive toolkit for managing a Plone CMS. Use these tools to create, read, update, delete (CRUD), and search for content. It also provides powerful features for managing Volto blocks and content workflows.",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResources();
    this.setupPrompts();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.server.onerror = (error: any) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.server.close();
      process.exit(0);
    });
  }

  private wrapError(operation: string, error: unknown): Error {
    if (error instanceof z.ZodError) {
      return new Error(`[${operation}] Invalid parameters: ${error.message}`);
    }
    return new Error(
      `[${operation}] ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // =============================================================================
  // TOOL REGISTRATION
  // =============================================================================

  private setupToolHandlers(): void {
    // Configuration tools
    this.server.registerTool(
      "plone_configure",
      {
        title: "Configure Plone Connection",
        description:
          "Establishes and authenticates the connection to a Plone CMS. **Must be called once per session** before other tools can be used. Configuration can be provided via arguments or environment variables (PLONE_BASE_URL, PLONE_USERNAME, PLONE_PASSWORD, PLONE_TOKEN). Arguments take precedence over environment variables. To use environment variables only, call with an empty object: plone_configure({}). Example with arguments: plone_configure({baseUrl: 'https://demo.plone.org', username: 'admin', password: 'secret'}).",
        inputSchema: PloneConfigureSchema.shape,
      },
      async (args) => this.handleConfigure(args)
    );

    // Content management tools
    this.server.registerTool(
      "plone_get_content",
      {
        title: "Get Plone Content",
        description:
          "Retrieves the full JSON data for a single content item from Plone using its path. Example: plone_get_content({path: '/news/latest-update'})",
        inputSchema: PloneGetContentSchema.shape,
      },
      async (args) => this.handleGetContent(args)
    );

    this.server.registerTool(
      "plone_create_content",
      {
        title: "Create Plone Content",
        description:
          "Creates a new content item (e.g., a page or news article) in Plone. To add complex block-based content, first prepare the structure with `plone_create_blocks_layout`, then call this tool. Example: plone_create_content({parentPath: '/', type: 'Document', title: 'My Page', description: 'A sample page'})",
        inputSchema: PloneCreateContentSchema.shape,
      },
      async (args) => this.handleCreateContent(args)
    );

    this.server.registerTool(
      "plone_update_content",
      {
        title: "Update Plone Content",
        description:
          "Modifies an existing content item in Plone. Can update metadata (like title) and/or replace the entire block structure. Use `plone_create_blocks_layout` to prepare complex block updates. Example: plone_update_content({path: '/my-page', title: 'Updated Title'})",
        inputSchema: PloneUpdateContentSchema.shape,
      },
      async (args) => this.handleUpdateContent(args)
    );

    this.server.registerTool(
      "plone_delete_content",
      {
        title: "Delete Plone Content",
        description:
          "Permanently deletes a content item from Plone using its path. Example: plone_delete_content({path: '/old-content'})",
        inputSchema: PloneDeleteContentSchema.shape,
      },
      async (args) => this.handleDeleteContent(args)
    );

    // Search and discovery tools
    this.server.registerTool(
      "plone_search",
      {
        title: "Search Plone Content",
        description:
          "Performs a detailed search for content items, allowing filters by text, content type, path, and workflow state. Example: plone_search({query: 'annual report', portal_type: ['Document'], review_state: ['published']})",
        inputSchema: PloneSearchSchema.shape,
      },
      async (args) => this.handleSearch(args)
    );

    this.server.registerTool(
      "plone_get_site_info",
      {
        title: "Get Site Information",
        description:
          "Retrieves top-level information and metadata about the connected Plone site, such as available languages and Plone version.",
        inputSchema: {},
      },
      async (args) => this.handleGetSiteInfo(args)
    );

    this.server.registerTool(
      "plone_get_types",
      {
        title: "Get Content Types",
        description:
          "Lists all available content types that can be created in the Plone site (e.g., 'Document', 'Event').",
        inputSchema: {},
      },
      async (args) => this.handleGetTypes(args)
    );

    this.server.registerTool(
      "plone_get_vocabularies",
      {
        title: "Get Vocabulary Values",
        description:
          "Fetches the allowed values for a specific field, such as a list of categories or tags. Useful for finding valid inputs for content fields. Example: plone_get_vocabularies({vocabulary: 'plone.app.vocabularies.Keywords'})",
        inputSchema: PloneGetVocabulariesSchema.shape,
      },
      async (args) => this.handleGetVocabularies(args)
    );

    // Workflow tools
    this.server.registerTool(
      "plone_get_workflow_info",
      {
        title: "Get Workflow Information",
        description:
          "Shows the current workflow state (e.g., 'Published', 'Private') and available transitions for a content item. Example: plone_get_workflow_info({path: '/my-document'})",
        inputSchema: PloneGetWorkflowInfoSchema.shape,
      },
      async (args) => this.handleGetWorkflowInfo(args)
    );

    this.server.registerTool(
      "plone_transition_workflow",
      {
        title: "Execute Workflow Transition",
        description:
          "Changes the workflow state of a content item by executing a specific transition, like 'publish' or 'submit'. Example: plone_transition_workflow({path: '/my-document', transition: 'publish'})",
        inputSchema: PloneTransitionWorkflowSchema.shape,
      },
      async (args) => this.handleTransitionWorkflow(args)
    );

    // Block management tools
    this.server.registerTool(
      "plone_get_block_schemas",
      {
        title: "Get Block Schemas",
        description:
          "Lists all available Volto block types (e.g., 'slate', 'teaser', 'button') and their required data schemas. **Essential for understanding how to construct blocks.** Example: plone_get_block_schemas({blockType: 'teaser'})",
        inputSchema: PloneGetBlockSchemasSchema.shape,
      },
      async (args) => this.handleGetBlockSchemas(args)
    );

    this.server.registerTool(
      "plone_create_blocks_layout",
      {
        title: "Prepare Blocks Layout",
        description:
          "Prepares a complete block structure in memory (valid for 60 seconds). This structure is then used by the **next immediate call** to `plone_create_content` or `plone_update_content`. Use `plone_get_block_schemas` to learn what data each block type needs. The text displayed by the Title block is automatically managed by Plone, DO NOT add it in the block's data. Example: plone_create_blocks_layout({blocks: [{type: 'title'},{type: 'slate', data: {text: 'Hello World'}}]})",
        inputSchema: PloneCreateBlocksLayoutSchema.shape,
      },
      async (args) => this.handleCreateBlocksLayout(args)
    );

    this.server.registerTool(
      "plone_add_single_block",
      {
        title: "Add Single Block",
        description:
          "Adds a single new block to an existing content item without replacing other blocks. Specify the block type, data, and optional position. Example: plone_add_single_block({path: '/my-page', blockType: 'text', blockData: {text: 'New paragraph'}})",
        inputSchema: PloneAddBlockSchema.shape,
      },
      async (args) => this.handleAddBlock(args)
    );

    this.server.registerTool(
      "plone_update_single_block",
      {
        title: "Update Single Block",
        description:
          "Modifies the data of a single, existing block within a content item, identified by its block ID. Example: plone_update_single_block({path: '/my-page', blockId: 'abc123', blockData: {text: 'Updated text'}})",
        inputSchema: PloneUpdateBlockSchema.shape,
      },
      async (args) => this.handleUpdateBlock(args)
    );

    this.server.registerTool(
      "plone_remove_single_block",
      {
        title: "Remove Single Block",
        description:
          "Deletes a single block from a content item, identified by its block ID. Example: plone_remove_single_block({path: '/my-page', blockId: 'abc123'})",
        inputSchema: PloneRemoveBlockSchema.shape,
      },
      async (args) => this.handleRemoveBlock(args)
    );
  }

  // =============================================================================
  // TOOL HANDLERS - Configuration and Content Management
  // =============================================================================

  private requireClient(): PloneClient {
    if (!this.client) {
      throw new Error(
        "Plone client not configured. Please run plone_configure first."
      );
    }
    return this.client;
  }

  private async handleConfigure(args: unknown): Promise<CallToolResult> {
    try {
      const config = PloneConfigureSchema.parse(args);
      this.client = new PloneClient(config);

      // Test the connection
      await this.client.get("/");

      const textContent: TextContent = {
        type: "text",
        text: `Successfully configured connection to Plone site: ${config.baseUrl}`,
      };
      return { content: [textContent] };
    } catch (error) {
      throw this.wrapError("Configure", error);
    }
  }

  private async handleGetContent(args: unknown): Promise<CallToolResult> {
    try {
      const { path, expand } = PloneGetContentSchema.parse(args);
      const client = this.requireClient();

      const params: Record<string, any> = {};
      if (expand && expand.length > 0) {
        params.expand = expand.join(",");
      }

      const content = await client.get(path, params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("GetContent", error);
    }
  }

  private async handleCreateContent(args: unknown): Promise<CallToolResult> {
    try {
      const parsedArgs = PloneCreateContentSchema.parse(args);
      const client = this.requireClient();
      const {
        parentPath,
        type,
        title,
        description,
        id,
        blocks,
        blocks_layout,
        additionalFields,
      } = parsedArgs;

      const data: any = {
        "@type": type,
        title,
      };

      if (description) data.description = description;
      if (id) data.id = id;

      // Use the centralized helper to process blocks
      const blockData = this._handleBlockProcessing(
        blocks,
        blocks_layout,
        false
      );
      if (blockData) {
        data.blocks = blockData.blocks;
        data.blocks_layout = blockData.blocks_layout;
      }

      if (additionalFields) Object.assign(data, additionalFields);

      const content = await client.post(parentPath, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      // Ensure prepared blocks are cleared on any error
      if (this.preparedBlocks) {
        this.preparedBlocks = null;
      }
      throw this.wrapError("CreateContent", error);
    }
  }

  private async handleUpdateContent(args: unknown): Promise<CallToolResult> {
    try {
      const parsedArgs = PloneUpdateContentSchema.parse(args);
      const client = this.requireClient();
      const {
        path,
        title,
        description,
        blocks,
        blocks_layout,
        additionalFields,
      } = parsedArgs;

      if (!path) {
        throw new Error("Path is required for updating content");
      }

      const data: any = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;

      // Use the centralized helper, which will return null if no block changes are needed
      const blockData = this._handleBlockProcessing(
        blocks,
        blocks_layout,
        true
      );
      if (blockData) {
        data.blocks = blockData.blocks;
        data.blocks_layout = blockData.blocks_layout;
      }

      if (additionalFields) Object.assign(data, additionalFields);

      if (Object.keys(data).length === 0) {
        throw new Error("No changes specified for update");
      }

      const content = await client.patch(path, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      if (this.preparedBlocks) {
        this.preparedBlocks = null;
      }
      throw this.wrapError("UpdateContent", error);
    }
  }

  private async handleDeleteContent(args: unknown): Promise<CallToolResult> {
    try {
      const { path } = PloneDeleteContentSchema.parse(args);
      const client = this.requireClient();

      await client.delete(path);

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted content at path: ${path}`,
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("DeleteContent", error);
    }
  }

  // =============================================================================
  // TOOL HANDLERS - Search and Site Information
  // =============================================================================

  private async handleSearch(args: unknown): Promise<CallToolResult> {
    try {
      const parsedArgs = PloneSearchSchema.parse(args);
      const client = this.requireClient();
      const {
        query,
        portal_type,
        path,
        review_state,
        sort_on,
        sort_order,
        b_size,
        b_start,
      } = parsedArgs;

      const params: Record<string, any> = {};

      if (query) params.SearchableText = query;
      if (portal_type) params.portal_type = portal_type;
      if (path) params.path = path;
      if (review_state) params.review_state = review_state;
      if (sort_on) params.sort_on = sort_on;
      if (sort_order) params.sort_order = sort_order;
      if (b_size) params.b_size = b_size;
      if (b_start) params.b_start = b_start;

      const results = await client.get("/@search", params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("Search", error);
    }
  }

  private async handleGetSiteInfo(_args: unknown): Promise<CallToolResult> {
    try {
      const client = this.requireClient();
      const siteInfo = await client.get("/");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(siteInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("GetSiteInfo", error);
    }
  }

  private async handleGetTypes(_args: unknown): Promise<CallToolResult> {
    try {
      const client = this.requireClient();
      const types = await client.get("/@types");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(types, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("GetTypes", error);
    }
  }

  private async handleGetVocabularies(args: unknown): Promise<CallToolResult> {
    try {
      const parsedArgs = PloneGetVocabulariesSchema.parse(args);
      const client = this.requireClient();
      const { vocabulary, title, token } = parsedArgs;

      const params: Record<string, any> = {};
      if (title) params.title = title;
      if (token) params.token = token;

      const vocabularies = await client.get(
        `/@vocabularies/${vocabulary}`,
        params
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(vocabularies, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("GetVocabularies", error);
    }
  }

  // =============================================================================
  // TOOL HANDLERS - Workflow
  // =============================================================================

  private async handleGetWorkflowInfo(args: unknown): Promise<CallToolResult> {
    try {
      const { path } = PloneGetWorkflowInfoSchema.parse(args);
      const client = this.requireClient();

      const workflow = await client.get(`${path}/@workflow`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(workflow, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("GetWorkflowInfo", error);
    }
  }

  private async handleTransitionWorkflow(
    args: unknown
  ): Promise<CallToolResult> {
    try {
      const { path, transition, comment } =
        PloneTransitionWorkflowSchema.parse(args);
      const client = this.requireClient();

      const data: any = { transition };
      if (comment) data.comment = comment;

      const result = await client.post(`${path}/@workflow/${transition}`, data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("TransitionWorkflow", error);
    }
  }

  // =============================================================================
  // TOOL HANDLERS - Block Management
  // =============================================================================

  private async handleGetBlockSchemas(args: unknown): Promise<CallToolResult> {
    try {
      const { blockType } = PloneGetBlockSchemasSchema.parse(args);

      if (blockType && blockType !== '') {
        const spec = blockRegistry.getSpecification(blockType);
        if (!spec) {
          throw new Error(
            `Unknown block type: ${blockType}. Available types: ${blockRegistry
              .getBlockTypes()
              .join(", ")}`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  blockType: blockType,
                  specification: spec,
                  example: this.getBlockExample(blockType),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Return all block schemas with examples
      const examples: Record<string, any> = {};
      for (const type of blockRegistry.getBlockTypes()) {
        examples[type] = this.getBlockExample(type);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                availableTypes: blockRegistry.getBlockTypes(),
                specifications: blockRegistry.getSpecifications(),
                examples: examples,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("GetBlockSchemas", error);
    }
  }

  private async handleCreateBlocksLayout(
    args: unknown
  ): Promise<CallToolResult> {
    try {
      const { blocks } = PloneCreateBlocksLayoutSchema.parse(args);

      const processedBlocks: Record<string, any> = {};
      const blockIds: string[] = [];
      const blockInfo: Array<{ id: string; type: string }> = [];

      // Process each block in the array
      for (const blockSpec of blocks) {
        // Validate image URLs asynchronously before processing
        if (blockSpec.type === "image" && blockSpec.data?.url) {
          const isValid = await this.validateImageURL(blockSpec.data.url);
          if (!isValid) {
            throw this.wrapError(
              "CreateBlocksLayout",
              `Invalid or inaccessible image URL: ${blockSpec.data.url}`
            );
          }
        }

        const blockId = this.generateBlockId();
        const processedBlock = this.processBlock(
          blockSpec.type,
          blockSpec.data
        );

        processedBlocks[blockId] = processedBlock;
        blockIds.push(blockId);
        blockInfo.push({ id: blockId, type: blockSpec.type });
      }

      // Store the prepared blocks for immediate use with timestamp
      this.preparedBlocks = {
        blocks: processedBlocks,
        blocks_layout: { items: blockIds },
        timestamp: Date.now(),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully prepared ${
              blocks.length
            } blocks for next create/update operation (valid for 60 seconds). Blocks ready: ${blockInfo
              .map((block) => `${block.type}:[${block.id}]`)
              .join(", ")}`,
          },
        ],
      };
    } catch (error) {
      // Clear prepared blocks on error
      this.preparedBlocks = null;
      throw this.wrapError("CreateBlocksLayout", error);
    }
  }

  private async handleAddBlock(args: unknown): Promise<CallToolResult> {
    try {
      const { path, blockType, blockData, position } =
        PloneAddBlockSchema.parse(args);
      const client = this.requireClient();

      // First get the current content
      const content: PloneContent = await client.get(path);

      const blocks = content.blocks || {};
      const blocks_layout = content.blocks_layout || { items: [] };

      // Generate new block ID
      const blockId = this.generateBlockId();

      // Validate image URLs asynchronously before processing
      if (blockType === "image" && blockData?.url) {
        const isValid = await this.validateImageURL(blockData.url);
        if (!isValid) {
          throw this.wrapError(
            "AddBlock",
            `Invalid or inaccessible image URL: ${blockData.url}`
          );
        }
      }

      // Process block using centralized logic
      try {
        blocks[blockId] = this.processBlock(blockType, blockData);
      } catch (error) {
        throw new Error(
          `Error processing block data: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Insert at specified position or at the end
      if (
        position !== undefined &&
        position >= 0 &&
        position <= blocks_layout.items.length
      ) {
        blocks_layout.items.splice(position, 0, blockId);
      } else {
        blocks_layout.items.push(blockId);
      }

      // Update the content
      const updatedContent = await client.patch(path, {
        blocks,
        blocks_layout,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(updatedContent, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("AddBlock", error);
    }
  }

  private async handleUpdateBlock(args: unknown): Promise<CallToolResult> {
    try {
      const { path, blockId, blockData } = PloneUpdateBlockSchema.parse(args);
      const client = this.requireClient();

      // First get the current content
      const content: PloneContent = await client.get(path);

      const blocks = content.blocks || {};

      if (!blocks[blockId]) {
        const availableBlockIds = Object.keys(blocks);
        throw new Error(
          `Block with ID '${blockId}' not found. Available block IDs: ${availableBlockIds.join(
            ", "
          )}`
        );
      }

      // Update the specific block
      blocks[blockId] = {
        ...blocks[blockId],
        ...blockData,
      };

      // Update the content
      const updatedContent = await client.patch(path, { blocks });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(updatedContent, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("UpdateBlock", error);
    }
  }

  private async handleRemoveBlock(args: unknown): Promise<CallToolResult> {
    try {
      const { path, blockId } = PloneRemoveBlockSchema.parse(args);
      const client = this.requireClient();

      // First get the current content
      const content: PloneContent = await client.get(path);

      const blocks = content.blocks || {};
      const blocks_layout = content.blocks_layout || { items: [] };

      if (!blocks[blockId]) {
        const availableBlockIds = Object.keys(blocks);
        throw new Error(
          `Block with ID '${blockId}' not found. Available block IDs: ${availableBlockIds.join(
            ", "
          )}`
        );
      }

      // Remove the block
      delete blocks[blockId];

      // Remove from layout
      const index = blocks_layout.items.indexOf(blockId);
      if (index > -1) {
        blocks_layout.items.splice(index, 1);
      }

      // Update the content
      const updatedContent = await client.patch(path, {
        blocks,
        blocks_layout,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(updatedContent, null, 2),
          },
        ],
      };
    } catch (error) {
      throw this.wrapError("RemoveBlock", error);
    }
  }

  // =============================================================================
  // SECTION 5: HELPER METHODS
  // =============================================================================

  // Validate if the url is an image address, to avoid creation of blank image blocks
  private async validateImageURL(url: string): Promise<boolean> {
    try {
      // For data URLs, check MIME type
      if (url.startsWith("data:")) {
        return url.startsWith("data:image/");
      }

      // For external URLs
      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get("Content-Type");
      return contentType ? contentType.startsWith("image/") : false;
    } catch (error) {
      console.error(`Error validating image URL ${url}:`, error);
      return false;
    }
  }
  // IMPROVEMENT: Check for expired prepared blocks
  private isExpiredPreparedBlocks(): boolean {
    if (!this.preparedBlocks) return true;
    return (
      Date.now() - this.preparedBlocks.timestamp > this.PREPARED_BLOCKS_TTL
    );
  }

  /**
   * Centralized logic for processing blocks and layout for create/update operations.
   * It handles blocks from direct arguments, prepared state, or defaults.
   * It also enforces that a title block exists and is the first item in the layout.
   * @param blocks - Blocks from tool arguments.
   * @param blocks_layout - Blocks layout from tool arguments.
   * @param isUpdate - Flag to indicate if this is for an update operation, which has slightly different rules.
   * @returns An object with final blocks and layout, or null if no block operations should occur.
   */
  private _handleBlockProcessing(
    blocks: Record<string, any> | undefined,
    blocks_layout: Record<string, any> | undefined,
    isUpdate: boolean = false
  ): {
    blocks: Record<string, any>;
    blocks_layout: { items: string[] };
  } | null {
    // Determine if we should process blocks at all
    const hasProvidedBlocks = blocks || blocks_layout;
    const hasPreparedBlocks =
      this.preparedBlocks !== null && !this.isExpiredPreparedBlocks();

    if (!hasProvidedBlocks && !hasPreparedBlocks) {
      // For updates, if no blocks are provided, do nothing.
      // For creates, we will add a default title block later.
      if (isUpdate) {
        return null;
      }
    }

    // Use prepared blocks if available and not expired, otherwise use provided args
    let finalBlocks: Record<string, any>;
    let finalLayout: string[];

    if (hasPreparedBlocks && this.preparedBlocks) {
      finalBlocks = this.preparedBlocks.blocks;
      finalLayout = this.preparedBlocks.blocks_layout.items;
    } else {
      finalBlocks = blocks || {};
      finalLayout = blocks_layout?.items || Object.keys(finalBlocks);
    }

    // Always clear prepared blocks after they are consumed
    this.preparedBlocks = null;

    // Find the existing title block
    let titleBlockId = finalLayout.find(
      (id: string) => finalBlocks[id]?.["@type"] === "title"
    );

    if (!titleBlockId) {
      // If no title block exists, create one and add it to the front
      titleBlockId = this.generateBlockId();
      finalLayout.unshift(titleBlockId);
    } else if (finalLayout[0] !== titleBlockId) {
      // If it exists but isn't first, move it to the front
      finalLayout = finalLayout.filter((id: string) => id !== titleBlockId);
      finalLayout.unshift(titleBlockId);
    }

    // ALWAYS ensure the title block is clean and contains only the @type
    finalBlocks[titleBlockId] = { "@type": "title" };

    return {
      blocks: finalBlocks,
      blocks_layout: { items: finalLayout },
    };
  }

  private generateBlockId(): string {
    return uuidv4();
  }

  /**
   * Process a block
   */
  private processBlock(
    blockType: string,
    blockData: Record<string, any>
  ): Record<string, any> {
    if (blockType === "slate" || blockType === "text") {
      // Convert text block to Slate format
      const textContent = blockData.text || "";
      return {
        "@type": "slate",
        plaintext: textContent,
        value: markdownParse(textContent),
        theme: blockData.theme || "default",
      };
    } else if (blockType === "image") {
      // Basic validation for required fields
      if (
        !blockData ||
        typeof blockData.url !== "string" ||
        blockData.url.trim() === ""
      ) {
        throw this.wrapError(
          "ProcessBlock",
          `Missing or invalid image URL: ${String(blockData?.url)}`
        );
      }
      return {
        ...blockData,
        "@type": "image",
      };
    } else if (blockType === "teaser" || blockType === "__button") {
      // Transform href to required array format if it's a string
      const processedData: Record<string, any> = {
        ...blockData,
        "@type": blockType,
      };

      if (blockData.href) {
        if (typeof blockData.href === "string") {
          // Convert string href to required array format
          processedData.href = [{ "@id": blockData.href }];
        } else if (Array.isArray(blockData.href)) {
          // Already in array format, keep as-is
          processedData.href = blockData.href;
        } else {
          throw this.wrapError(
            "ProcessBlock",
            `Invalid href format for ${blockType} block. Expected string or array, got: ${typeof blockData.href}`
          );
        }
      }

      return processedData;
    } else {
      return {
        ...blockData,
        "@type": blockType,
      };
    }
  }

  /**
   * Get example block data for documentation
   */
  private getBlockExample(blockType: string): any {
    const examples: Record<string, any> = {
      teaser: {
        href: [
          {
            "@id": "https://example.com/news/latest-updates",
          },
        ],
        overwrite: true,
        title: "Latest Company Updates",
        head_title: "News",
        description: "Read about our recent achievements and announcements",
        preview_image: [
          {
            "@id": "https://example.com/images/latest-updates-preview.jpg",
            image_field: "image",
          },
        ],
        theme: "default",
        styles: {
          align: "left",
        },
      },
      slate: {
        text: "This is a paragraph of text content that will be converted to Slate format.",
        theme: "default",
      },
      __button: {
        href: [{ "@id": "https://example.com/contact", title: "Contact Page" }],
        title: "Contact Us",
        theme: "default",
        styles: {
          "align:noprefix": {
            "--block-alignment": "var(--align-center)",
          },
          "blockWidth:noprefix": {
            "--block-width": "var(--default-container-width)",
          },
        },
      },
      separator: {
        theme: "default",
        styles: {
          "align:noprefix": {
            "--block-alignment": "var(--align-left)",
          },
          "blockWidth:noprefix": {
            "--block-width": "var(--narrow-container-width)",
          },
          shortLine: true,
        },
      },
      image: {
        url: "https:/example.com/images/logo.png",
        alt: "Logo",
      },
    };

    return examples[blockType] || {};
  }

  // =============================================================================
  // RESOURCES SETUP
  // =============================================================================

  private setupResources(): void {
    // Dynamic Plone content resource
    this.server.registerResource(
      "plone-content",
      new ResourceTemplate("plone://{path}", { list: undefined }),
      {
        title: "Plone Content Item",
        description:
          "Provides direct read-only access to the full JSON of a Plone content item via its path.",
      },
      async (uri, { path }) => {
        if (!this.client) {
          throw new Error(
            "Plone client not configured. Please run plone_configure first."
          );
        }

        const normalizedPath = this.client.normalizePath(
          typeof path === "string" ? path : path[0] || ""
        );
        const content = await this.client.get(normalizedPath);

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(content, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    );

    // Plone site information resource
    this.server.registerResource(
      "plone-site",
      "plone://site",
      {
        title: "Plone Site Information",
        description:
          "Provides direct read-only access to the Plone site's root information object.",
      },
      async (uri) => {
        if (!this.client) {
          throw new Error(
            "Plone client not configured. Please run plone_configure first."
          );
        }

        const siteInfo = await this.client.get("/");

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(siteInfo, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    );

    // Plone content types resource
    this.server.registerResource(
      "plone-types",
      "plone://types",
      {
        title: "Plone Content Types",
        description:
          "Provides direct read-only access to the list of available content types.",
      },
      async (uri) => {
        if (!this.client) {
          throw new Error(
            "Plone client not configured. Please run plone_configure first."
          );
        }

        const types = await this.client.get("/@types");

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(types, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    );
  }

  // =============================================================================
  // PROMPTS SETUP
  // =============================================================================

  private setupPrompts(): void {
    // Content creation workflow prompts
    this.server.registerPrompt(
      "create-page-workflow",
      {
        title: "Create a Single Web Page",
        description:
          "A guided workflow to create a single web page with specific content and structure.",
        argsSchema: {
          contentType: z
            .string()
            .describe(
              "Type of content to create (e.g., 'Document', 'News Item')"
            ),
          purpose: z.string().describe("The purpose or topic of the page"),
          audience: z
            .string()
            .optional()
            .describe("The target audience for the page"),
        },
      },
      ({ contentType, purpose, audience }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text" as const,
              text: `My goal is to create a new ${contentType} page about "${purpose}"${
                audience ? ` for an audience of ${audience}` : ""
              }. Perform the following steps:

1.  Ensure the Plone connection is configured.
2.  Determine the best parent path for this new content.
3.  Create the page with a fitting title and description.
4.  Add relevant content blocks (like text and images) to build out the page.
5.  Finally, publish the page by transitioning its workflow state.

Begin with the first step.`,
            },
          },
        ],
      })
    );
    this.server.registerPrompt(
      "create-example-site-workflow",
      {
        title: "Create a Multi-Page Example Site",
        description:
          "A guided workflow to create a small, multi-page example website with interconnected content.",
        argsSchema: {
          contentTypes: z
            .string()
            .describe(
              "Types of content to create (e.g., 'Documents, News Items')"
            ),
          purpose: z
            .string()
            .describe("The overall theme or topic of the site"),
          audience: z
            .string()
            .optional()
            .describe("The target audience for the site"),
          numberOfPages: z
            .string()
            .optional()
            .describe("The number of pages to create (default is 3)"),
        },
      },
      ({ contentTypes, purpose, numberOfPages = "3", audience }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text" as const,
              text: `My goal is to create an example site with ${numberOfPages} pages of type ${contentTypes}, all centered around the theme of "${purpose}"${
                audience ? `, aimed at an audience of ${audience}` : ""
              }. Follow this plan:

1.  Ensure the Plone connection is configured.
2.  Establish a logical folder (Document type objects can be used as folders) structure for the new pages.
3.  Create each of the ${numberOfPages} pages with appropriate titles, descriptions, and content.
4.  Populate each page with relevant and structured content blocks.
5.  Ensure all created pages are published.

Begin this process step-by-step.`,
            },
          },
        ],
      })
    );
  }

  // =============================================================================
  // SERVER RUNTIME
  // =============================================================================

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Plone MCP server running on stdio");
  }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

const server = new PloneMCPServer();
server.run().catch(console.error);
