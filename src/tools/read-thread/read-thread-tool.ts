import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";
import { resolveUserName, formatTimestamp } from "../utils";

const readThreadDescription =
  "Fetches messages from a specific Slack thread conversation.\n\nThis tool retrieves the complete conversation from a thread, including the parent message and all replies. It does NOT create new threads, send replies, or search for threads - it only reads existing thread messages.\n";

const readThreadInputSchema = z.object({
  channel_id: z
    .string()
    .describe(
      "Channel, private group, or IM channel to fetch thread replies for",
    ),
  message_ts: z
    .string()
    .describe("Timestamp of the parent message to fetch replies for"),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      "Number of messages to return, between 1 and 1000. Default value is 100.",
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

const threadMessageSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  ts: z.string(),
  time_formatted: z.string(),
  text: z.string(),
});

const readThreadOutputSchema = z.object({
  parent: threadMessageSchema,
  replies: z.array(threadMessageSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

async function resolveMessage(
  client: WebClient,
  m: { user?: string; ts?: string; text?: string },
) {
  const userId = m.user ?? "unknown";
  const userName =
    userId !== "unknown" ? await resolveUserName(client, userId) : "unknown";
  return {
    user_id: userId,
    user_name: userName,
    ts: m.ts ?? "",
    time_formatted: m.ts ? formatTimestamp(m.ts) : "",
    text: m.text ?? "",
  };
}

export function createReadThreadTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: readThreadDescription,
    inputSchema: readThreadInputSchema,
    outputSchema: readThreadOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.conversations.replies({
        channel: args.channel_id,
        ts: args.message_ts,
        limit: args.limit,
        cursor: args.cursor,
        latest: args.latest,
        oldest: args.oldest,
      });

      const rawMessages = result.messages ?? [];
      const [rawParent, ...rawReplies] = rawMessages;

      const parent = rawParent
        ? await resolveMessage(client, rawParent)
        : { user_id: "", user_name: "", ts: "", time_formatted: "", text: "" };

      const replies = await Promise.all(
        rawReplies.map((m) => resolveMessage(client, m)),
      );

      return {
        parent,
        replies,
        has_more: result.has_more ?? false,
        next_cursor: result.response_metadata?.next_cursor || undefined,
      };
    },
    toModelOutput: ({ output }) => {
      const parentBlock = `=== THREAD PARENT MESSAGE ===\nFrom: ${output.parent.user_name} (${output.parent.user_id})\nTime: ${output.parent.time_formatted}\nMessage TS: ${output.parent.ts}\n${output.parent.text}`;

      let messagesText: string;
      if (output.replies.length === 0) {
        messagesText = `${parentBlock}\n\nNo thread messages\n`;
      } else {
        const replyBlocks = output.replies
          .map(
            (r, i) =>
              `--- Reply ${i + 1} of ${output.replies.length} ---\nFrom: ${r.user_name} (${r.user_id})\nTime: ${r.time_formatted}\nMessage TS: ${r.ts}\n${r.text}`,
          )
          .join("\n\n");
        messagesText = `${parentBlock}\n\n=== THREAD REPLIES (${output.replies.length} total) ===\n\n${replyBlocks}\n`;
      }

      const paginationInfo = output.has_more
        ? `There are more messages in this thread. To view the next page, use cursor: "${output.next_cursor}"\n`
        : "There are no more messages in this thread.\n";

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
