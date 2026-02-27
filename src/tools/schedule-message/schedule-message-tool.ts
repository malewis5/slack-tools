import { tool } from "ai";
import { z } from "zod";
import {
  type ChatScheduleMessageArguments,
  type WebClient,
} from "@slack/web-api";
import { formatTimestamp, getChannelInfo } from "../utils";

const scheduleMessageDescription =
  "Schedules a message to be sent to a Slack channel at a specified future time.\n\nThis tool schedules a message for future delivery. It does NOT send the message immediately - the message will be posted at the time specified in the post_at parameter. Once scheduled, the message cannot be edited through additional tool calls. If the user wants to edit, reschedule, or delete the message, they should use the \"Drafts and sent\" feature in the Slack UI.\n\n## When to Use\n- User wants to schedule an announcement for a specific date/time\n- User needs to post a reminder at a future time\n- User wants to schedule a message in a thread for later\n- User needs to time a message for when team members are online\n\n## When NOT to Use\n- User wants to send a message immediately (use slack_send_message instead)\n- User wants to edit an already scheduled message (not supported). The user should use the \"Drafts and sent\" feature in the Slack UI\n- User needs to attach files to the scheduled message (not supported)\n- Channel is externally shared (Slack Connect channel) - scheduling messages in externally shared channels is not supported\n\n## Args:\n\tchannel_id (str, required): Channel ID where message will be scheduled (e.g., \"C1234567890\")\n\tmessage (str, required): Message content in markdown format\n\tpost_at (int, required): Unix timestamp for when message should be sent. Must be 10+ seconds in future, max 120 days\n\tthread_ts (Optional[str]): Message timestamp to reply to (for thread replies)\n\treply_broadcast (Optional[bool]): Broadcast thread reply to channel. Default: false. Only works with thread_ts\n\n## Returns:\n\tresult (str): Markdown-formatted confirmation message containing:\n\t\t- Success confirmation message\n\t\t- Scheduled Message ID\n\t\t- Channel name and ID where message will post\n\t\t- Human-readable timestamp in user's timezone with unix timestamp in parenthesis\n\n\tExample output:\n\t\tMessage scheduled successfully!\n\t\tScheduled Message ID: Dr018YQVLM0B\n\t\tChannel: my-team-channel (C1234567890)\n\t\tPost Time: 2026-02-09 13:36:00 MST (1737558000)\n\n## Examples:\n\t- \"Schedule announcement for tomorrow 9am\" -> Calculate Unix timestamp for 9am tomorrow, call slack_schedule_message\n\t- \"Post reminder in 1 hour\" -> Calculate timestamp 1 hour from now\n\t- \"Schedule thread reply for 3pm\" -> Use thread_ts parameter with future timestamp\n\n## Finding value for channel_id:\n- Use slack_search_channels tool to find channel ID if user provides a channel name\n- Use slack_search_users tool to find user ID if user provides a user's name, then use their user_id as the channel_id\n\n## Timestamp Format:\n- post_at must be a Unix timestamp (integer): e.g., 1770765540\n- Must be at least 10 seconds in the future\n- Cannot be more than 120 days in the future\n\n## Error Codes:\n- time_in_past: post_at is less than 10 seconds in the future\n- time_too_far: post_at exceeds 120 days in the future\n- invalid_post_at_type: post_at must be an integer (Unix timestamp)\n- no_text: message content is empty\n- channel_not_found: Invalid channel_id or user lacks access\n- restricted_too_many: Too many messages scheduled (max 30 per 5-minute window per channel)\n- message_limit_exceeded: Team hit message abuse limits\n- permission_denied: Insufficient permissions to post to channel\n- mcp_externally_shared_channel_restricted: Cannot schedule messages in externally shared channels (Slack Connect channels)\n\n## What NOT to Expect:\n❌ Does NOT support: Editing or canceling scheduled messages after creation (the user should use the \"Drafts and sent\" feature in the Slack UI)\n❌ Does NOT support: Attaching files to scheduled messages\n❌ Cannot: Send messages immediately (use slack_send_message for immediate posting)\n❌ Cannot: Schedule messages more than 120 days in advance\n";

const scheduleMessageInputSchema = z.object({
  channel_id: z.string().describe("Channel where message will be scheduled"),
  message: z.string().describe("Message content to schedule"),
  post_at: z
    .number()
    .int()
    .describe(
      "Unix timestamp when message should be sent (10 sec min future, 120 days max)",
    ),
  thread_ts: z
    .string()
    .optional()
    .describe("Message timestamp to reply to (for thread replies)"),
  reply_broadcast: z
    .boolean()
    .optional()
    .describe("Broadcast thread reply to channel"),
});

const scheduleMessageOutputSchema = z.object({
  scheduled_message_id: z.string(),
  channel_id: z.string(),
  channel_name: z.string(),
  post_at: z.number(),
  post_at_formatted: z.string(),
});

export function createScheduleMessageTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: scheduleMessageDescription,
    inputSchema: scheduleMessageInputSchema,
    outputSchema: scheduleMessageOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.chat.scheduleMessage({
        channel: args.channel_id,
        text: args.message,
        post_at: args.post_at,
        thread_ts: args.thread_ts,
        reply_broadcast: args.reply_broadcast,
      } as ChatScheduleMessageArguments);

      const channelInfo = await getChannelInfo(client, args.channel_id);
      const postAt =
        typeof result.post_at === "number"
          ? result.post_at
          : Number(result.post_at);

      return {
        scheduled_message_id: result.scheduled_message_id ?? "",
        channel_id: result.channel ?? args.channel_id,
        channel_name: channelInfo.name,
        post_at: postAt,
        post_at_formatted: formatTimestamp(String(postAt)),
      };
    },
    toModelOutput: ({ output }) => ({
      type: "text" as const,
      value: JSON.stringify({
        result: `Message scheduled successfully!\n\nScheduled Message ID: ${output.scheduled_message_id}\nChannel: ${output.channel_name} (${output.channel_id})\nPost Time: ${output.post_at_formatted} (${output.post_at})`,
      }),
    }),
  });
}
