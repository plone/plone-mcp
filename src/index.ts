#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { z } from "zod";

// Configuration schema
const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
});

type Config = z.infer<typeof ConfigSchema>;

class PloneClient {
  private axios: AxiosInstance;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    
    // Remove trailing slash from baseUrl if present
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    
    this.axios = axios.create({
      baseURL: `${baseUrl}/++api++`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Set up authentication
    if (config.token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${config.token}`;
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
  private server: Server;
  private client: PloneClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "plone-mcp-server",
        version: "1.0.0",
        description: "MCP server for Plone CMS REST API integration",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "plone_configure",
            description: "Configure connection to Plone site",
            inputSchema: {
              type: "object",
              properties: {
                baseUrl: {
                  type: "string",
                  description: "Base URL of the Plone site (e.g., https://example.com/plone)",
                },
                username: {
                  type: "string",
                  description: "Username for authentication (optional if using token)",
                },
                password: {
                  type: "string",
                  description: "Password for authentication (optional if using token)",
                },
                token: {
                  type: "string",
                  description: "JWT token for authentication (optional if using username/password)",
                },
              },
              required: ["baseUrl"],
            },
          },
          {
            name: "plone_get_content",
            description: "Get content from Plone site by path or UID",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to content (e.g., '/folder/document' or just 'document' for root level)",
                },
                expand: {
                  type: "array",
                  items: { type: "string" },
                  description: "Components to expand (e.g., ['breadcrumbs', 'actions', 'workflow'])",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "plone_create_content",
            description: "Create new content in Plone",
            inputSchema: {
              type: "object",
              properties: {
                parentPath: {
                  type: "string",
                  description: "Path where to create the content (e.g., '/folder' or '' for root)",
                },
                type: {
                  type: "string",
                  description: "Content type to create (e.g., 'Document', 'Folder', 'News Item')",
                },
                title: {
                  type: "string",
                  description: "Title of the new content",
                },
                description: {
                  type: "string",
                  description: "Description of the new content",
                },
                id: {
                  type: "string",
                  description: "ID for the new content (optional, will be auto-generated if not provided)",
                },
                text: {
                  type: "string",
                  description: "Body text for content types that support it",
                },
                additionalFields: {
                  type: "object",
                  description: "Additional fields specific to the content type",
                },
              },
              required: ["parentPath", "type", "title"],
            },
          },
          {
            name: "plone_update_content",
            description: "Update existing content in Plone",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the content to update",
                },
                title: {
                  type: "string",
                  description: "New title",
                },
                description: {
                  type: "string",
                  description: "New description",
                },
                text: {
                  type: "string",
                  description: "New body text",
                },
                additionalFields: {
                  type: "object",
                  description: "Additional fields to update",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "plone_delete_content",
            description: "Delete content from Plone",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the content to delete",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "plone_search",
            description: "Search for content in Plone",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query text",
                },
                portal_type: {
                  type: "array",
                  items: { type: "string" },
                  description: "Content types to search for",
                },
                path: {
                  type: "string",
                  description: "Path to search within",
                },
                review_state: {
                  type: "array",
                  items: { type: "string" },
                  description: "Workflow states to filter by",
                },
                sort_on: {
                  type: "string",
                  description: "Field to sort by (e.g., 'modified', 'created', 'sortable_title')",
                },
                sort_order: {
                  type: "string",
                  enum: ["ascending", "descending"],
                  description: "Sort order",
                },
                b_size: {
                  type: "number",
                  description: "Batch size (number of results per page)",
                },
                b_start: {
                  type: "number",
                  description: "Batch start (for pagination)",
                },
              },
            },
          },
          {
            name: "plone_get_workflow_info",
            description: "Get workflow information for content",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the content",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "plone_transition_workflow",
            description: "Execute a workflow transition",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the content",
                },
                transition: {
                  type: "string",
                  description: "Workflow transition to execute",
                },
                comment: {
                  type: "string",
                  description: "Comment for the transition",
                },
              },
              required: ["path", "transition"],
            },
          },
          {
            name: "plone_get_site_info",
            description: "Get information about the Plone site",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "plone_get_types",
            description: "Get available content types",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "plone_get_vocabularies",
            description: "Get vocabulary values",
            inputSchema: {
              type: "object",
              properties: {
                vocabulary: {
                  type: "string",
                  description: "Vocabulary name",
                },
                title: {
                  type: "string",
                  description: "Filter by title",
                },
                token: {
                  type: "string",
                  description: "Filter by token",
                },
              },
              required: ["vocabulary"],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "plone_configure":
            return await this.handleConfigure(args);
          case "plone_get_content":
            return await this.handleGetContent(args);
          case "plone_create_content":
            return await this.handleCreateContent(args);
          case "plone_update_content":
            return await this.handleUpdateContent(args);
          case "plone_delete_content":
            return await this.handleDeleteContent(args);
          case "plone_search":
            return await this.handleSearch(args);
          case "plone_get_workflow_info":
            return await this.handleGetWorkflowInfo(args);
          case "plone_transition_workflow":
            return await this.handleTransitionWorkflow(args);
          case "plone_get_site_info":
            return await this.handleGetSiteInfo(args);
          case "plone_get_types":
            return await this.handleGetTypes(args);
          case "plone_get_vocabularies":
            return await this.handleGetVocabularies(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async handleConfigure(args: any) {
    try {
      const config = ConfigSchema.parse(args);
      this.client = new PloneClient(config);
      
      // Test the connection
      await this.client.get('/');
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully configured connection to Plone site: ${config.baseUrl}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Configuration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private requireClient(): PloneClient {
    if (!this.client) {
      throw new Error("Plone client not configured. Please run plone_configure first.");
    }
    return this.client;
  }

  private async handleGetContent(args: any) {
    const client = this.requireClient();
    const { path, expand } = args;
    
    let url = path.startsWith('/') ? path : `/${path}`;
    const params: Record<string, any> = {};
    
    if (expand && expand.length > 0) {
      params.expand = expand.join(',');
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

  private async handleCreateContent(args: any) {
    const client = this.requireClient();
    const { parentPath, type, title, description, id, text, additionalFields } = args;
    
    const data: any = {
      "@type": type,
      title,
    };
    
    if (description) data.description = description;
    if (id) data.id = id;
    if (text) data.text = text;
    if (additionalFields) Object.assign(data, additionalFields);
    
    let url = parentPath;
    if (!url.startsWith('/')) {
      url = `/${url}`;
    }
    if (url === '/') {
      url = '';
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

  private async handleUpdateContent(args: any) {
    const client = this.requireClient();
    const { path, title, description, text, additionalFields } = args;
    
    const data: any = {};
    if (title) data.title = title;
    if (description) data.description = description;
    if (text) data.text = text;
    if (additionalFields) Object.assign(data, additionalFields);
    
    let url = path.startsWith('/') ? path : `/${path}`;
    
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

  private async handleDeleteContent(args: any) {
    const client = this.requireClient();
    const { path } = args;
    
    let url = path.startsWith('/') ? path : `/${path}`;
    
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

  private async handleSearch(args: any) {
    const client = this.requireClient();
    const { query, portal_type, path, review_state, sort_on, sort_order, b_size, b_start } = args;
    
    const params: Record<string, any> = {};
    
    if (query) params.SearchableText = query;
    if (portal_type) params.portal_type = portal_type;
    if (path) params.path = path;
    if (review_state) params.review_state = review_state;
    if (sort_on) params.sort_on = sort_on;
    if (sort_order) params.sort_order = sort_order;
    if (b_size) params.b_size = b_size;
    if (b_start) params.b_start = b_start;
    
    const results = await client.get('/@search', params);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async handleGetWorkflowInfo(args: any) {
    const client = this.requireClient();
    const { path } = args;
    
    let url = path.startsWith('/') ? path : `/${path}`;
    
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

  private async handleTransitionWorkflow(args: any) {
    const client = this.requireClient();
    const { path, transition, comment } = args;
    
    let url = path.startsWith('/') ? path : `/${path}`;
    
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

  private async handleGetSiteInfo(args: any) {
    const client = this.requireClient();
    
    const siteInfo = await client.get('/');
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(siteInfo, null, 2),
        },
      ],
    };
  }

  private async handleGetTypes(args: any) {
    const client = this.requireClient();
    
    const types = await client.get('/@types');
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(types, null, 2),
        },
      ],
    };
  }

  private async handleGetVocabularies(args: any) {
    const client = this.requireClient();
    const { vocabulary, title, token } = args;
    
    const params: Record<string, any> = {};
    if (title) params.title = title;
    if (token) params.token = token;
    
    const vocabularies = await client.get(`/@vocabularies/${vocabulary}`, params);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(vocabularies, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Plone MCP server running on stdio");
  }
}

const server = new PloneMCPServer();
server.run().catch(console.error);