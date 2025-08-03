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
import blocksSpecification from "./blocks.json" assert { type: "json" };
import { v4 as uuidv4 } from "uuid";

// Configuration schema
const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
});

type Config = z.infer<typeof ConfigSchema>;

// Tool parameter schemas
const PloneConfigureSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
});

// Create a well-formatted description that includes the full JSON specification
const createAddBlockDescription = (blocksSpec: any) => {
  const blockTypesList = Object.keys(blocksSpec)
    .map((type) => `"${type}"`)
    .join(", ");

  return `Add a content block to a Plone page. This tool supports multiple block types with specific schemas.

SUPPORTED BLOCK TYPES: ${blockTypesList}

BLOCK SPECIFICATIONS AND SCHEMAS:
${JSON.stringify(blocksSpec, null, 2)}

IMPORTANT GUIDELINES:
- Always include a "styles" object in blockData, even if empty
- Follow the exact schema structure for each block type
- Required fields must be provided for each block type
- Use appropriate properties for visual appearance and behavior`;
};

const addBlockSpecification = createAddBlockDescription(blocksSpecification);

const PloneAddBlockSchema = z.object({
  path: z.string(),
  blockType: z.enum(["teaser", "text", "separator", "__button"]),
  blockData: z.record(z.any()),
  position: z.number().optional(),
});

const PloneUpdateBlockSchema = z.object({
  path: z.string(),
  blockId: z.string(),
  blockData: z.record(z.any()),
});

const PloneRemoveBlockSchema = z.object({
  path: z.string(),
  blockId: z.string(),
});

// Types
interface PloneContent {
  "@type": string;
  title: string;
  blocks?: Record<string, any>;
  blocks_layout?: { items: string[] };
  [key: string]: any;
}

class PloneClient {
  private axios: AxiosInstance;

  constructor(public config: Config) {
    this.config = config;

    // Remove trailing slash from baseUrl if present
    const baseUrl = config.baseUrl.replace(/\/$/, "");

    this.axios = axios.create({
      baseURL: `${baseUrl}/++api++`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Set up authentication
    if (config.token) {
      this.axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${config.token}`;
    } else if (config.username && config.password) {
      this.axios.defaults.auth = {
        username: config.username,
        password: config.password,
      };
    }
  }

  async get(path: string, params?: Record<string, any>): Promise<any> {
    const response = await this.axios.get(path, { params });
    return response.data;
  }

  async post(path: string, data?: any): Promise<any> {
    const response = await this.axios.post(path, data);
    return response.data;
  }

  async patch(path: string, data?: any): Promise<any> {
    const response = await this.axios.patch(path, data);
    return response.data;
  }

  async delete(path: string): Promise<any> {
    const response = await this.axios.delete(path);
    return response.data;
  }
}

class PloneMCPServer {
  private server: McpServer;
  private client: PloneClient | null = null;

  constructor() {
    this.server = new McpServer(
      {
        name: "plone-mcp-server",
        version: "1.0.0",
        description: "MCP server for Plone CMS REST API integration",
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

  private setupToolHandlers(): void {
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
      return {
        content: [textContent],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid configuration: ${error.message}`);
      }
      throw new Error(
        `Configuration failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private requireClient(): PloneClient {
    if (!this.client) {
      throw new Error(
        "Plone client not configured. Please run plone_configure first."
      );
    }
    return this.client;
  }

  private async handleGetContent(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const { path, expand } = args;

    let url = path.startsWith("/") ? path : `/${path}`;
    const params: Record<string, any> = {};

    if (expand && expand.length > 0) {
      params.expand = expand.join(",");
    }

    const content = await client.get(url, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  }

  private async handleCreateContent(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const {
      parentPath,
      type,
      title,
      description,
      id,
      text,
      blocks,
      blocks_layout,
      additionalFields,
    } = args;

    const data: any = {
      "@type": type,
      title,
    };

    if (description) data.description = description;
    if (id) data.id = id;
    if (text) data.text = text;
    if (blocks) data.blocks = blocks;
    if (blocks_layout) data.blocks_layout = blocks_layout;
    if (additionalFields) Object.assign(data, additionalFields);

    let url = parentPath;
    if (!url.startsWith("/")) {
      url = `/${url}`;
    }
    if (url === "/") {
      url = "";
    }

    const content = await client.post(url, data);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  }

  private async handleUpdateContent(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const {
      path,
      title,
      description,
      text,
      blocks,
      blocks_layout,
      additionalFields,
    } = args;

    const data: any = {};
    if (title) data.title = title;
    if (description) data.description = description;
    if (text) data.text = text;
    if (blocks) data.blocks = blocks;
    if (blocks_layout) data.blocks_layout = blocks_layout;
    if (additionalFields) Object.assign(data, additionalFields);

    let url = path.startsWith("/") ? path : `/${path}`;

    const content = await client.patch(url, data);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  }

  private async handleDeleteContent(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const { path } = args;

    let url = path.startsWith("/") ? path : `/${path}`;

    await client.delete(url);

    return {
      content: [
        {
          type: "text",
          text: `Successfully deleted content at path: ${path}`,
        },
      ],
    };
  }

  private async handleSearch(args: any): Promise<CallToolResult> {
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
    } = args;

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
  }

  private async handleGetWorkflowInfo(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const { path } = args;

    let url = path.startsWith("/") ? path : `/${path}`;

    const workflow = await client.get(`${url}/@workflow`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(workflow, null, 2),
        },
      ],
    };
  }

  private async handleTransitionWorkflow(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const { path, transition, comment } = args;

    let url = path.startsWith("/") ? path : `/${path}`;

    const data: any = { transition };
    if (comment) data.comment = comment;

    const result = await client.post(`${url}/@workflow/${transition}`, data);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGetSiteInfo(_args: any): Promise<CallToolResult> {
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
  }

  private async handleGetTypes(_args: any): Promise<CallToolResult> {
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
  }

  private async handleGetVocabularies(args: any): Promise<CallToolResult> {
    const client = this.requireClient();
    const { vocabulary, title, token } = args;

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
  }

  // Utility methods for generating UUIDs and managing blocks
  private generateBlockId(): string {
    const blockID = uuidv4();
    return blockID;
  }

  // Centralized path normalization utility
  private normalizePath(path: string): string {
    if (!path) return "";
    // Remove trailing slash, ensure leading slash
    let normalized = path.replace(/\/$/, "");
    if (!normalized.startsWith("/") && normalized !== "") {
      normalized = `/${normalized}`;
    }
    return normalized;
  }

  // Resources setup
  private setupResources(): void {
    // Dynamic Plone content resource
    this.server.registerResource(
      "plone-content",
      new ResourceTemplate("plone://{path}", { list: undefined }),
      {
        title: "Plone Content",
        description: "Access Plone content items by path",
      },
      async (uri, { path }) => {
        if (!this.client) {
          throw new Error(
            "Plone client not configured. Please run plone_configure first."
          );
        }

        const normalizedPath = this.normalizePath(
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
        description: "General information about the Plone site",
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
        description: "Available content types in the Plone site",
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

  // Prompts setup
  private setupPrompts(): void {
    // Content creation workflow prompt
    this.server.registerPrompt(
      "create-page-workflow",
      {
        title: "Create Page Workflow",
        description:
          "Guide through creating a new page with structured content",
        argsSchema: {
          contentType: z
            .string()
            .describe("Type of content to create (Document, News Item, etc.)"),
          purpose: z.string().describe("Purpose or topic of the page"),
          audience: z.string().optional().describe("Target audience"),
        },
      },
      ({ contentType, purpose, audience }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text" as const,
              text: `I want to create a ${contentType} about "${purpose}"${
                audience ? ` for ${audience}` : ""
              }. Please help me:

1. First, configure the Plone connection if not already done
2. Choose an appropriate parent path for this content
3. Create the content with a good title and description
4. Add relevant blocks (text, images, etc.) to structure the content
5. Review and publish the content

Let's start by configuring the connection and then proceed step by step.`,
            },
          },
        ],
      })
    );
  }

  // Block-specific handlers

  private async handleAddBlock(args: unknown): Promise<CallToolResult> {
    try {
      const { path, blockType, blockData, position } =
        PloneAddBlockSchema.parse(args);
      const client = this.requireClient();

      let url = path.startsWith("/") ? path : `/${path}`;

      // First get the current content
      const content: PloneContent = await client.get(url);

      const blocks = content.blocks || {};
      const blocks_layout = content.blocks_layout || { items: [] };

      // Generate new block ID
      const blockId = this.generateBlockId();

      // Handle different block types with proper structure
      if (blockType === "text") {
        // Convert text block to Slate format
        const textContent = blockData.text || "";
        blocks[blockId] = {
          "@type": "slate",
          plaintext: textContent,
          value: [
            {
              children: [
                {
                  text: textContent,
                },
              ],
              type: "p",
            },
          ],
          theme: blockData.theme || "default",
        };
      } else {
        // For other block types, use the provided data with correct @type
        blocks[blockId] = {
          ...blockData,
          "@type": blockType,
        };
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
      const updatedContent = await client.patch(url, { blocks, blocks_layout });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(updatedContent, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid add block parameters: ${error.message}`);
      }
      throw error;
    }
  }

  private async handleUpdateBlock(args: unknown): Promise<CallToolResult> {
    try {
      const { path, blockId, blockData } = PloneUpdateBlockSchema.parse(args);
      const client = this.requireClient();

      let url = path.startsWith("/") ? path : `/${path}`;

      // First get the current content
      const content: PloneContent = await client.get(url);

      const blocks = content.blocks || {};

      if (!blocks[blockId]) {
        throw new Error(`Block with ID '${blockId}' not found`);
      }

      // Update the specific block
      blocks[blockId] = {
        ...blocks[blockId],
        ...blockData,
      };

      // Update the content
      const updatedContent = await client.patch(url, { blocks });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(updatedContent, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid update block parameters: ${error.message}`);
      }
      throw error;
    }
  }

  private async handleRemoveBlock(args: unknown): Promise<CallToolResult> {
    try {
      const { path, blockId } = PloneRemoveBlockSchema.parse(args);
      const client = this.requireClient();

      let url = path.startsWith("/") ? path : `/${path}`;

      // First get the current content
      const content: PloneContent = await client.get(url);

  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Plone MCP server running on stdio");
  }
}

const server = new PloneMCPServer();
server.run().catch(console.error);
