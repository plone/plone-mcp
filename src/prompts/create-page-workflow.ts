import { z } from "zod";

export const ploneCreatePageWorkflow = {
  config: {
    name: "create-page-workflow",
    description:
      "A guided workflow to create a single web page with specific content and structure.",
    argsSchema: z.object({
      contentType: z
        .string()
        .describe("Type of content to create (e.g., 'Document', 'News Item')"),
      purpose: z.string().describe("The purpose or topic of the page"),
      audience: z
        .string()
        .optional()
        .describe("The target audience for the page"),
    }),
  },
  handler: async (args: {
    contentType: string;
    purpose: string;
    audience?: string;
  }) => {
    const { contentType, purpose, audience } = args;

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `My goal is to create a new ${contentType} page about "${purpose}"${audience ? ` for an audience of ${audience}` : ""
              }. Perform the following steps:

1.  Determine the best parent path for this new content.
2.  Look up the available block types with plone_get_block_schemas.
3.  Create the page in a single plone_create_content call, with a fitting title, a description, and relevant content blocks (like text and images) passed as block_specs.
4.  Finally, publish the page by transitioning its workflow state.

Begin with the first step.`,
          },
        },
      ],
    };
  },
};
