import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";

const joinChannelDescription =
  "Joins a Slack channel on behalf of the authenticated user (the bot/agent).\n\nThis tool adds the bot or user to a public channel so it can read and post messages there. It uses the `conversations.join` Slack API method.\n\n## When to Use\n- The agent needs to participate in a channel it is not yet a member of\n- Before reading or posting to a channel that returns a `not_in_channel` error\n- User explicitly asks the agent to join a specific channel\n\n## When NOT to Use\n- The agent is already a member of the channel\n- The channel is private (use an invite-based flow instead — `conversations.join` only works for public channels)\n- User wants to add *other* users to a channel (this tool only adds the authenticated bot/user)\n\n## Finding value for `channel_id` input:\n- Use `slack_search_channels` tool to find channel ID if user provides a channel name\n\n## Error Codes:\n- `channel_not_found`: The channel does not exist or is not visible to the bot\n- `method_not_supported_for_channel_type`: Cannot join a private channel or DM via this method\n- `is_archived`: The channel has been archived\n- `already_in_channel`: The bot is already a member (treated as success with a warning)\n";

const joinChannelInputSchema = z.object({
  channel_id: z.string().describe("ID of the public channel to join"),
});

const joinChannelOutputSchema = z.object({
  channel_id: z.string(),
  channel_name: z.string(),
  already_in_channel: z.boolean(),
});

export function createJoinChannelTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: joinChannelDescription,
    inputSchema: joinChannelInputSchema,
    outputSchema: joinChannelOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.conversations.join({
        channel: args.channel_id,
      });

      const channel = result.channel as {
        id?: string;
        name?: string;
      };

      // When the bot is already a member, Slack returns the join as a
      // success but includes `"warning": "already_in_channel"` per the
      // official API spec — there is no top-level boolean field for this.
      const alreadyInChannel = result.warning === "already_in_channel";

      return {
        channel_id: channel.id ?? args.channel_id,
        channel_name: channel.name ?? args.channel_id,
        already_in_channel: alreadyInChannel,
      };
    },
    toModelOutput: ({ output }) => ({
      type: "text" as const,
      value: JSON.stringify(output),
    }),
  });
}
