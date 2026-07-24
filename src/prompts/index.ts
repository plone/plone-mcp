import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ploneCreatePageWorkflow } from "./create-page-workflow.js";
import { ploneCreateExampleSiteWorkflow } from "./create-example-site-workflow.js";


export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    ploneCreatePageWorkflow.config.name,
    {
      description: ploneCreatePageWorkflow.config.description,
      argsSchema: ploneCreatePageWorkflow.config.argsSchema,
    },
    ploneCreatePageWorkflow.handler
  );

  server.registerPrompt(
    ploneCreateExampleSiteWorkflow.config.name,
    {
      description: ploneCreateExampleSiteWorkflow.config.description,
      argsSchema: ploneCreateExampleSiteWorkflow.config.argsSchema,
    },
    ploneCreateExampleSiteWorkflow.handler
  );
}
