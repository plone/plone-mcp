import { describe, it, expect, vi, afterEach } from "vitest";
import { registerTools } from "plone-mcp/tools/index";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

const destructive = (idempotentHint: boolean): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint,
  openWorldHint: false,
});

const additive = (idempotentHint: boolean): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint,
  openWorldHint: false,
});

const readOnly: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

const expected: Record<string, ToolAnnotations> = {
  plone_configure: { ...additive(true), openWorldHint: true },
  plone_get_block_schemas: readOnly,
  plone_get_content: readOnly,
  plone_get_navigation_tree: readOnly,
  plone_get_site_info: readOnly,
  plone_get_translation: readOnly,
  plone_get_type_schema: readOnly,
  plone_get_types: readOnly,
  plone_get_vocabularies: readOnly,
  plone_get_workflow_info: readOnly,
  plone_get_working_copy: readOnly,
  plone_search: readOnly,
  plone_add_single_block: additive(false),
  plone_copy_content: additive(false),
  plone_create_blocks_layout: additive(true),
  plone_create_content: additive(false),
  plone_create_user: additive(false),
  plone_create_working_copy: additive(false),
  plone_link_translation: additive(true),
  plone_cancel_working_copy: destructive(true),
  plone_checkin_working_copy: destructive(true),
  plone_delete_content: destructive(true),
  plone_move_content: destructive(false),
  plone_remove_single_block: destructive(true),
  plone_transition_workflow: destructive(false),
  plone_unlink_translation: destructive(true),
  plone_update_content: destructive(true),
  plone_update_single_block: destructive(true),
  plone_update_user: destructive(true),
};

function collectRegistrations() {
  const registerTool = vi.fn();
  registerTools({ registerTool } as unknown as McpServer);
  return new Map<string, { annotations?: ToolAnnotations }>(
    registerTool.mock.calls.map(([name, config]) => [name, config]),
  );
}

describe("tool annotations", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers every tool with its expected annotations", () => {
    const registered = collectRegistrations();

    expect([...registered.keys()].sort()).toEqual(
      Object.keys(expected).sort(),
    );
    for (const [name, config] of registered) {
      expect(config.annotations, name).toEqual(expected[name]);
    }
  });

  it("marks every get and search tool as read-only", () => {
    for (const [name, config] of collectRegistrations()) {
      const isRead = name.startsWith("plone_get_") || name === "plone_search";
      expect(config.annotations?.readOnlyHint, name).toBe(isRead);
    }
  });

  it("keeps annotations when ENABLED_TOOLS filters tools", () => {
    vi.stubEnv("ENABLED_TOOLS", "plone_delete_content");
    const registered = collectRegistrations();

    expect([...registered.keys()].sort()).toEqual([
      "plone_configure",
      "plone_delete_content",
    ]);
    expect(registered.get("plone_delete_content")?.annotations).toEqual(
      expected.plone_delete_content,
    );
  });
});
