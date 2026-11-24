import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import { toolResult } from "../utils/tool-result.js";

const inputSchema = z.object({
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
      "Field to sort by (e.g., 'modified', 'created', 'sortable_title')",
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

const outputSchema = z.looseObject({
  items: z.array(z.looseObject({ "@id": z.string(), title: z.string() })),
  items_total: z.number(),
});

export const ploneSearch = {
  config: {
    name: "plone_search",
    description:
      "Performs a detailed search for content items, allowing filters by text, content type, path, and workflow state. Example: plone_search({query: 'annual report', portal_type: ['Document'], review_state: ['published']})",
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const client = getClient(ctx);
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

      const params: Record<string, unknown> = {};

      if (query) params.SearchableText = query;
      if (portal_type) params.portal_type = portal_type;
      if (path) params.path = path;
      if (review_state) params.review_state = review_state;
      if (sort_on) params.sort_on = sort_on;
      if (sort_order) params.sort_order = sort_order;
      if (typeof b_size !== "undefined") params.b_size = b_size;
      if (typeof b_start !== "undefined") params.b_start = b_start;

      const results = await client.get("/@search", params);

      return toolResult(results);
    } catch (error) {
      throw wrapError("Search", error);
    }
  },
};
