import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";
import { resolveUserName, getChannelInfo, formatTimestamp } from "../utils";

const readChannelDescription =
  "Reads messages from a Slack channel in reverse chronological order (newest to oldest).\n\nThis tool retrieves message history from any Slack channel the user has access to. It does NOT send messages, search across channels, or modify any data - it only reads existing messages from a single specified channel.\nTo read replies of a message use slack_read_thread by passing message_ts.\n";

const readChannelInputSchema = z.object({
  channel_id: z
    .string()
    .describe(
      "ID of the Channel, private group, or IM channel to fetch history for",
    ),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      "Number of messages to return, between 1 and 100. Default value is 100.",
    ),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  latest: z
    .string()
    .optional()
    .describe(
      "End of time range of messages to include in results (timestamp)",
    ),
  oldest: z
    .string()
    .optional()
    .describe(
      "Start of time range of messages to include in results (timestamp)",
    ),
  response_format: z
    .string()
    .optional()
    .describe(
      "Level of detail (default: 'detailed'). Options: 'detailed', 'concise'",
    ),
});

const messageSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  ts: z.string(),
  time_formatted: z.string(),
  text: z.string(),
});

const readChannelOutputSchema = z.object({
  channel: z.object({ id: z.string(), name: z.string() }),
  messages: z.array(messageSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function createReadChannelTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: readChannelDescription,
    inputSchema: readChannelInputSchema,
    outputSchema: readChannelOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.conversations.history({
        channel: args.channel_id,
        limit: args.limit,
        cursor: args.cursor,
        latest: args.latest,
        oldest: args.oldest,
      });

      const channelInfo = await getChannelInfo(client, args.channel_id);
      const rawMessages = result.messages ?? [];

      const messages = await Promise.all(
        rawMessages.map(async (m) => {
          const userId = m.user ?? "unknown";
          const userName =
            userId !== "unknown"
              ? await resolveUserName(client, userId)
              : "unknown";
          return {
            user_id: userId,
            user_name: userName,
            ts: m.ts ?? "",
            time_formatted: m.ts ? formatTimestamp(m.ts) : "",
            text: m.text ?? "",
          };
        }),
      );

      return {
        channel: { id: args.channel_id, name: channelInfo.name },
        messages,
        has_more: result.has_more ?? false,
        next_cursor: result.response_metadata?.next_cursor || undefined,
      };
    },
    toModelOutput: ({ output }) => {
      const header = `Channel: #${output.channel.name} (${output.channel.id})`;
      const msgBlocks = output.messages
        .map(
          (m) =>
            `=== Message from ${m.user_name} (${m.user_id}) at ${m.time_formatted} === \nMessage TS: ${m.ts}\n${m.text}`,
        )
        .join("\n\n");

      const messagesText = `${header}\n\n${msgBlocks}`;
      const paginationInfo = output.has_more
        ? `There are more messages available. To view the next page, use cursor: \`${output.next_cursor}\`\n`
        : "There are no more messages.\n";

      return {
        type: "text" as const,
        value: JSON.stringify({
          messages: messagesText,
          pagination_info: paginationInfo,
        }),
      };
    },
  });
}
