import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ploneConfigure } from "./plone_configure.js";
import { ploneAddSingleBlock } from "./plone_add_single_block.js";
import { ploneCreateBlocksLayout } from "./plone_create_blocks_layout.js";
import { ploneCreateContent } from "./plone_create_content.js";
import { ploneCreateUser } from "./plone_create_user.js";
import { ploneDeleteContent } from "./plone_delete_content.js";
import { ploneGetBlockSchemas } from "./plone_get_block_schemas.js";
import { ploneGetContent } from "./plone_get_content.js";
import { ploneGetNavigationTree } from "./plone_get_navigation_tree.js";
import { ploneGetSiteInfo } from "./plone_get_site_info.js";
import { ploneGetTypeSchema } from "./plone_get_type_schema.js";
import { ploneGetTranslation } from "./plone_get_translation.js";
import { ploneGetTypes } from "./plone_get_types.js";
import { ploneGetVocabularies } from "./plone_get_vocabularies.js";
import { ploneGetWorkflowInfo } from "./plone_get_workflow_info.js";
import { ploneLinkTranslation } from "./plone_link_translation.js";
import { ploneRemoveSingleBlock } from "./plone_remove_single_block.js";
import { ploneSearch } from "./plone_search.js";
import { ploneTransitionWorkflow } from "./plone_transition_workflow.js";
import { ploneUnlinkTranslation } from "./plone_unlink_translation.js";
import { ploneUpdateContent } from "./plone_update_content.js";
import { ploneUpdateSingleBlock } from "./plone_update_single_block.js";
import { ploneUpdateUser } from "./plone_update_user.js";

/**
 * Registers all tools with the provided McpServer instance.
 * Supports filtering via ENABLED_TOOLS environment variable.
 */
export function registerTools(server: McpServer) {
  const enabledToolsEnv = process.env.ENABLED_TOOLS;
  const enabledTools = enabledToolsEnv
    ? new Set(enabledToolsEnv.split(",").map((t) => t.trim()))
    : null;

  const tools = [
    ploneConfigure,
    ploneAddSingleBlock,
    ploneCreateBlocksLayout,
    ploneCreateContent,
    ploneCreateUser,
    ploneDeleteContent,
    ploneGetBlockSchemas,
    ploneGetContent,
    ploneGetNavigationTree,
    ploneGetSiteInfo,
    ploneGetTranslation,
    ploneGetTypeSchema,
    ploneGetTypes,
    ploneGetVocabularies,
    ploneGetWorkflowInfo,
    ploneLinkTranslation,
    ploneRemoveSingleBlock,
    ploneSearch,
    ploneTransitionWorkflow,
    ploneUnlinkTranslation,
    ploneUpdateContent,
    ploneUpdateSingleBlock,
    ploneUpdateUser,
  ];

  for (const tool of tools) {
    const isConfigure = tool.config.name === "plone_configure";
    if (isConfigure || !enabledTools || enabledTools.has(tool.config.name)) {
      server.registerTool(
        tool.config.name,
        {
          description: tool.config.description,
          inputSchema: tool.config.inputSchema,
        },
        tool.handler,
      );
    }
  }
}
