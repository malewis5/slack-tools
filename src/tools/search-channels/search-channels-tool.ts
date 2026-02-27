import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";
import { resolveUserName, formatTimestamp } from "../utils";

const searchChannelsDescription =
  "Use this tool to find Slack channels by name or description when you need to identify specific channels before performing other operations.\n\n## When to Use\n- User asks to find channels with specific names or topics\n- User wants to see what channels exist matching certain criteria\n- You need a channel ID for another operation but only have partial name information\n- User asks \"what channels do we have for [topic]?\"\n- Before using other channel-specific tools when you don't have the exact channel ID\n\n## When NOT to Use\n- User already provided a specific channel ID (use the target tool directly)\n- Searching for message content within channels (use slack_search_public instead)\n- User wants to read messages from a known channel ID (use slack_read_channel)\n";

const searchChannelsInputSchema = z.object({
  query: z.string().describe("Search query for finding channels"),
  channel_types: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of channel types. Defaults to public_channel. Example: public_channel,private_channel",
    ),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      "Number of results to return, up to a max of 20. Defaults to 20.",
    ),
  response_format: z
    .string()
    .optional()
    .describe(
      "Level of detail (default: 'detailed'). Options: 'detailed', 'concise'",
    ),
  include_archived: z
    .boolean()
    .optional()
    .describe("Include archived channels in the search results"),
});

const channelResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  creator_id: z.string(),
  creator_name: z.string(),
  created: z.string(),
  topic: z.string(),
  purpose: z.string(),
  is_archived: z.boolean(),
});

const searchChannelsOutputSchema = z.object({
  query: z.string(),
  channels: z.array(channelResultSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function createSearchChannelsTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: searchChannelsDescription,
    inputSchema: searchChannelsInputSchema,
    outputSchema: searchChannelsOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.conversations.list({
        types: args.channel_types ?? "public_channel",
        limit: args.limit ?? 20,
        cursor: args.cursor,
        exclude_archived: !args.include_archived,
      });

      const allChannels = result.channels ?? [];
      const query = args.query.toLowerCase();
      const matched = allChannels.filter((ch) => {
        const name = (ch.name ?? "").toLowerCase();
        const purpose = (ch.purpose?.value ?? "").toLowerCase();
        const topic = (ch.topic?.value ?? "").toLowerCase();
        return (
          name.includes(query) || purpose.includes(query) || topic.includes(query)
        );
      });

      const channels = await Promise.all(
        matched.map(async (ch) => {
          const creatorId = ch.creator ?? "";
          const creatorName = creatorId
            ? await resolveUserName(client, creatorId)
            : "";
          return {
            id: ch.id ?? "",
            name: ch.name ?? "",
            creator_id: creatorId,
            creator_name: creatorName,
            created: ch.created
              ? formatTimestamp(String(ch.created))
              : "",
            topic: ch.topic?.value ?? "",
            purpose: ch.purpose?.value ?? "",
            is_archived: ch.is_archived ?? false,
          };
        }),
      );

      const nextCursor = result.response_metadata?.next_cursor || undefined;

      return {
        query: args.query,
        channels,
        has_more: !!nextCursor,
        next_cursor: nextCursor,
      };
    },
    toModelOutput: ({ output }) => {
      let resultsText: string;
      if (output.channels.length === 0) {
        resultsText = `# Search Results for: ${output.query}\n\nNo channels found.\n`;
      } else {
        const channelBlocks = output.channels
          .map((ch, i) => {
            const lines = [
              `### Result ${i + 1} of ${output.channels.length}`,
              `Name: #${ch.name}`,
              `Channel ID: ${ch.id}`,
              `Creator: ${ch.creator_name} (<@${ch.creator_id}>)`,
              `Created: ${ch.created}`,
            ];
            if (ch.topic) lines.push(`Topic: ${ch.topic}`);
            if (ch.purpose) lines.push(`Purpose: ${ch.purpose}`);
            lines.push(`Is Archived: ${ch.is_archived}`);
            return lines.join("\n");
          })
          .join("\n\n---\n\n");
        resultsText = `# Search Results for: ${output.query}\n\n## Channels (${output.channels.length} results)\n${channelBlocks}\n\n---\n\n`;
      }

      const paginationInfo = output.has_more
        ? `For the next page of results use cursor \`${output.next_cursor}\`\n`
        : "End of results - No more pages available.\n";

      return {
        type: "text" as const,
        value: JSON.stringify({
          results: resultsText,
          pagination_info: paginationInfo,
        }),
      };
    },
  });
}
