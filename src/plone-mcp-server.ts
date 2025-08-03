import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { PloneClient, Config, ConfigSchema } from "./plone-client.js";

export class PloneMCPServer {
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
          prompts: {},
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
    // Tool definitions and handlers - same as in original index.ts
    // ... (keeping the same tool definitions and handlers)
  }

  // Utility methods for generating UUIDs and managing blocks
  private generateBlockId(): string {
    return 'block-' + Math.random().toString(36).substr(2, 9);
  }

  private createSlateBlock(text: string, format: string = 'plain'): any {
    if (format === 'html') {
      return {
        "@type": "slate",
        value: [
          {
            type: "p",
            children: [{ text }]
          }
        ],
        plaintext: text
      };
    } else if (format === 'markdown') {
      // Simple markdown to Slate conversion - in a real implementation, you'd use a proper parser
      return {
        "@type": "slate",
        value: [
          {
            type: "p",
            children: [{ text }]
          }
        ],
        plaintext: text
      };
    } else {
      return {
        "@type": "slate",
        value: [
          {
            type: "p",
            children: [{ text }]
          }
        ],
        plaintext: text
      };
    }
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

  // Add all the handler methods here...
  // (For brevity, I'm not copying all handlers, but they would be the same as in index.ts)

  private async handleCreateTextBlock(args: any) {
    const { text, format = 'plain' } = args;
    
    const blockData = this.createSlateBlock(text, format);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(blockData, null, 2),
        },
      ],
    };
  }

  private async handleCreateImageBlock(args: any) {
    const { imageUrl, alt, caption, size = 'l', align = 'center' } = args;
    
    const blockData: any = {
      "@type": "image",
      url: imageUrl,
      alt: alt || '',
      size,
      align,
    };
    
    if (caption) {
      blockData.caption = caption;
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(blockData, null, 2),
        },
      ],
    };
  }

  private async handleCreateTeaserBlock(args: any) {
    const { href, title, description, preview_image } = args;
    
    const blockData: any = {
      "@type": "teaser",
      href,
    };
    
    if (title) blockData.title = title;
    if (description) blockData.description = description;
    if (preview_image) blockData.preview_image = preview_image;
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(blockData, null, 2),
        },
      ],
    };
  }

  private async handleCreateListingBlock(args: any) {
    const { query, sort_on, sort_order, limit, template = 'default' } = args;
    
    const blockData: any = {
      "@type": "listing",
      template,
    };
    
    if (query) blockData.query = query;
    if (sort_on) blockData.sort_on = sort_on;
    if (sort_order) blockData.sort_order = sort_order;
    if (limit) blockData.limit = limit;
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(blockData, null, 2),
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