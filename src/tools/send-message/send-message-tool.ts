import { tool } from "ai";
import { z } from "zod";
import { type ChatPostMessageArguments, type WebClient } from "@slack/web-api";

const sendMessageDescription =
  "Sends a message to a Slack channel identified by a channel_id.\nTo send a message to a user, you can use their user_id as the channel_id. Use `slack_read_user_profile` to find the current user's ID. Please return message link to the user along with a friendly message.\n\n## When to Use\n- User asks to send a message to a specific channel or person\n- User wants to post an announcement or update\n- User requests to share information or content with others\n- User wants to send a direct message to someone\n- User wants to reply to a specific message in a thread\n- User wants to immediately post a finalized message to Slack\n\n## When NOT to Use\n- User only wants to read messages from a channel (use `slack_read_channel` instead)\n- User wants to search for messages or content (use `slack_search_public` or related search tools)\n- User is asking questions about channel information without wanting to post (use `slack_search_channels` to find channels)\n- User wants to get user information without messaging them (use `slack_read_user_profile` instead)\n- Message content is empty or purely informational requests\n- User is just exploring or browsing Slack data\n- Channel is externally shared (Slack Connect channel) - posting to externally shared channels is not supported\n\n## Thread Replies (Optional):\n- To reply to a message in a thread, provide the `thread_ts` parameter with the timestamp of the parent message\n- `thread_ts`: (optional) Timestamp of the message to reply to (e.g., \"1234567890.123456\")\n- `reply_broadcast`: (optional) Boolean, default false. If true, the reply will also be posted to the channel. Only works when `thread_ts` is provided.\n\n## `message` input guidelines:\n- Message input should be markdown formatted\n- Do not send sensitive information in any links (specifically query params)\n- Markdown text elements are limited to 5,000 characters\n- Table content is limited to 10,000 characters total\n- Messages cannot be empty (must contain content)\n\n## Finding value for `channel_id` input:\n- Use `slack_search_channels` tool to find channel ID if user provides a channel name\n- Use `slack_search_users` tool to find user ID if user provides a user's name, then use their user_id as the channel_id\n\n## Error Codes:\n- `msg_too_long`: `message` content exceeds length limits\n- `no_text`: `message` is missing content\n- `invalid_blocks`: `message` format is invalid or contains unsupported elements\n- `channel_not_found`: Invalid channel_id provided or user does not have access to the channel\n- `permission_denied`: Insufficient permissions to post to the channel\n- `mcp_externally_shared_channel_restricted`: Cannot post to externally shared channels (Slack Connect channels)\n- `thread_reply_not_available`: Thread reply feature is not enabled for this app\n\n## What NOT to Expect:\n- Does NOT support: scheduling messages for later, message templates\n- Cannot: edit previously sent messages, delete messages\n\n";

const sendMessageInputSchema = z.object({
  channel_id: z.string().describe("ID of the Channel"),
  message: z.string().describe("Add a message"),
  thread_ts: z
    .string()
    .optional()
    .describe(
      "Provide another message's ts value to make this message a reply",
    ),
  reply_broadcast: z.boolean().optional().describe("Also send to conversation"),
});

const sendMessageOutputSchema = z.object({
  message_link: z.string(),
  message_context: z.object({
    message_ts: z.string(),
    channel_id: z.string(),
  }),
});

export function createSendMessageTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: sendMessageDescription,
    inputSchema: sendMessageInputSchema,
    outputSchema: sendMessageOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.chat.postMessage({
        channel: args.channel_id,
        text: args.message,
        thread_ts: args.thread_ts,
        reply_broadcast: args.reply_broadcast,
      } as ChatPostMessageArguments);
      const { permalink } = await client.chat.getPermalink({
        channel: result.channel!,
        message_ts: result.ts!,
      });

      return {
        message_link: permalink!,
        message_context: {
          message_ts: result.ts!,
          channel_id: result.channel!,
        },
      };
    },
    toModelOutput: ({ output }) => ({
      type: "text" as const,
      value: JSON.stringify(output),
    }),
  });
}
