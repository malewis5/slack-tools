import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";

const createCanvasDescription =
  "Creates a Canvas, which is a Slack-native document. Format all content as Markdown. You can add sections, include links, references, and any other information you deem relevant. Please return canvas link to the user along with a friendly message.\n\n## Canvas Formatting Guidelines:\n\n### Content Structure:\n- Use Markdown formatting for all content\n- Create clear sections with headers (# ## ###)\n- Use bullet points (- or *) for lists\n- Use numbered lists (1. 2. 3.) for sequential items\n- Include links using [text](url) format\n- Use **bold** and *italic* for emphasis\n\n### Supported Elements:\n- Headers (H1, H2, H3)\n- Text formatting (bold, italic, strikethrough)\n- Lists (bulleted and numbered)\n- Links and references\n- Tables (basic markdown table syntax)\n- Code blocks with syntax highlighting\n- User mentions (@username)\n- Channel mentions (#channel-name)\n\n### Best Practices:\n- Start with a clear title that describes the document purpose\n- Use descriptive section headers to organize content\n- Keep paragraphs concise and scannable\n- Include relevant links and references\n- Use consistent formatting throughout the document\n- Add context and explanations for complex topics\n\n## Parameters:\n- `title` (required): The title of the Canvas document\n- `content` (required): The Markdown-formatted content for the Canvas\n\n## Error Codes:\n- `not_supported_free_team`: Canvas creation not supported on free teams\n- `user_not_found`: The specified user ID is invalid or not found\n- `canvas_disabled_user_team`: Canvas feature is not enabled for this team\n- `invalid_rich_text_content`: Content format is invalid\n- `permission_denied`: User lacks permission to create Canvas documents\n\n## When to Use\n- User requests creating a document, report, or structured content\n- User wants to document meeting notes, project specs, or knowledge articles\n- User asks to create a collaborative document that others can edit\n- User needs to organize and format substantial content with headers, lists, and links\n- User wants to create a persistent document for team reference\n\n## When NOT to Use\n- User only wants to send a simple message (use `slack_send_message` instead)\n- User wants to read or view an existing Canvas\n- User is asking questions about Canvas features without wanting to create one\n- User wants to share brief information that doesn't need document structure\n- User just wants to search for existing documents\n\n\n\n## Examples:\n✅ Use:\n- Create meeting notes with agenda and action items\n- Document project specifications and requirements\n- Create knowledge base articles with structured content\n- Generate reports with data and analysis\n\nWhat NOT to Expect:\n❌ Does NOT: edit existing canvases, set user-specific permissions\n\n";

const createCanvasInputSchema = z.object({
  title: z.string().describe("Concise but descriptive name for the canvas"),
  content: z.string().describe("The content of the canvas in Markdown format"),
});

const createCanvasOutputSchema = z.object({
  canvas_id: z.string(),
  canvas_url: z.string(),
});

export function createCreateCanvasTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: createCanvasDescription,
    inputSchema: createCanvasInputSchema,
    outputSchema: createCanvasOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.canvases.create({
        title: args.title,
        document_content: {
          type: "markdown",
          markdown: args.content,
        },
      });

      const authInfo = await client.auth.test();
      const baseUrl = (authInfo.url ?? "").replace(/\/$/, "");
      const teamId = authInfo.team_id ?? "";

      return {
        canvas_id: result.canvas_id!,
        canvas_url: `${baseUrl}/docs/${teamId}/${result.canvas_id}`,
      };
    },
    toModelOutput: ({ output }) => ({
      type: "text" as const,
      value: JSON.stringify(output),
    }),
  });
}
