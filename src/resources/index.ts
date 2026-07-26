import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ploneContentResource } from "./content.js";
import { ploneSiteResource } from "./site.js";
import { ploneTypesResource } from "./types.js";


export function registerResources(server: McpServer) {
  server.registerResource(
    ploneContentResource.config.name,
    ploneContentResource.config.uriTemplate,
    {
      description: ploneContentResource.config.description,
      mimeType: ploneContentResource.config.mimeType,
    },
    ploneContentResource.handler
  );

  // Register static resources
  server.registerResource(
    ploneSiteResource.config.name,
    ploneSiteResource.config.uri,
    {
      description: ploneSiteResource.config.description,
      mimeType: ploneSiteResource.config.mimeType,
    },
    ploneSiteResource.handler
  );

  server.registerResource(
    ploneTypesResource.config.name,
    ploneTypesResource.config.uri,
    {
      description: ploneTypesResource.config.description,
      mimeType: ploneTypesResource.config.mimeType,
    },
    ploneTypesResource.handler
  );
}
