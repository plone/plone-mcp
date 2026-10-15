import { z } from "zod";

export const ploneCreateExampleSiteWorkflow = {
  config: {
    name: "create-example-site-workflow",
    description:
      "A guided workflow to create a small, multi-page example website with interconnected content.",
    argsSchema: z.object({
      contentTypes: z
        .string()
        .describe("Types of content to create (e.g., 'Documents, News Items')"),
      purpose: z.string().describe("The overall theme or topic of the site"),
      audience: z
        .string()
        .optional()
        .describe("The target audience for the site"),
      numberOfPages: z
        .string()
        .optional()
        .describe("The number of pages to create (default is 3)"),
    }),
  },
  handler: async (args: {
    contentTypes: string;
    purpose: string;
    numberOfPages?: string;
    audience?: string;
  }) => {
    const { contentTypes, purpose, numberOfPages = "3", audience } = args;

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `My goal is to create an example site with ${numberOfPages} pages of type ${contentTypes}, all centered around the theme of "${purpose}"${audience ? `, aimed at an audience of ${audience}` : ""
              }. Follow this plan:

1.  Establish a logical folder (Document type objects can be used as folders) structure for the new pages.
2.  Look up the available block types with plone_get_block_schemas.
3.  Create each of the ${numberOfPages} pages with one plone_create_content call per page, with an appropriate title, a description, and relevant, structured content blocks passed as block_specs.
4.  Ensure all created pages are published.

Begin this process step-by-step.`,
          },
        },
      ],
    };
  },
};
