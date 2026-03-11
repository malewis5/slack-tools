import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";

const deleteMessageDescription =
  "Deletes a message that was previously sent by the authenticated user (the bot/agent).\n\nThis tool removes a message from a Slack channel using the `chat.delete` API method. The bot can only delete its own messages unless it has admin privileges.\n\n## When to Use\n- The agent needs to remove a message it previously sent\n- User asks the agent to delete or retract a specific message\n- Cleaning up temporary or incorrect messages the agent posted\n\n## When NOT to Use\n- Trying to delete messages sent by other users (will fail unless the token has admin scope)\n- The message has already been deleted\n- User wants to edit a message instead of deleting it\n\n## Required Inputs:\n- `channel_id`: The channel where the message was posted\n- `message_ts`: The timestamp (`ts`) of the message to delete. This is returned in the `message_context` of `slack_send_message`.\n\n## Error Codes:\n- `message_not_found`: The message does not exist or was already deleted\n- `channel_not_found`: Invalid channel_id or the bot does not have access\n- `cant_delete_message`: The bot does not have permission to delete this message (e.g., it was sent by another user)\n- `compliance_exports_prevent_deletion`: Compliance settings prevent message deletion\n";

const deleteMessageInputSchema = z.object({
  channel_id: z
    .string()
    .describe("ID of the channel containing the message to delete"),
  message_ts: z
    .string()
    .describe("Timestamp of the message to delete (e.g., '1234567890.123456')"),
});

const deleteMessageOutputSchema = z.object({
  ok: z.boolean(),
  channel_id: z.string(),
  deleted_ts: z.string(),
});

export function createDeleteMessageTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: deleteMessageDescription,
    inputSchema: deleteMessageInputSchema,
    outputSchema: deleteMessageOutputSchema,
    needsApproval,
    execute: async (args) => {
      const result = await client.chat.delete({
        channel: args.channel_id,
        ts: args.message_ts,
      });

      return {
        ok: result.ok ?? true,
        channel_id: result.channel ?? args.channel_id,
        deleted_ts: result.ts ?? args.message_ts,
      };
    },
    toModelOutput: ({ output }) => ({
      type: "text" as const,
      value: JSON.stringify(output),
    }),
  });
}
