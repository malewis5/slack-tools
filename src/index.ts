import { WebClient } from "@slack/web-api";
import { createSendMessageTool } from "./tools/send-message/send-message-tool";
import { createScheduleMessageTool } from "./tools/schedule-message/schedule-message-tool";
import { createCreateCanvasTool } from "./tools/create-canvas/create-canvas-tool";
import { createSearchPublicTool } from "./tools/search-public/search-public-tool";
import { createSearchPublicAndPrivateTool } from "./tools/search-public-and-private/search-public-and-private-tool";
import { createSearchChannelsTool } from "./tools/search-channels/search-channels-tool";
import { createSearchUsersTool } from "./tools/search-users/search-users-tool";
import { createReadChannelTool } from "./tools/read-channel/read-channel-tool";
import { createReadThreadTool } from "./tools/read-thread/read-thread-tool";
import { createReadUserProfileTool } from "./tools/read-user-profile/read-user-profile-tool";
import type { Tool } from "ai";

export type SlackToolName =
  | "slack_send_message"
  | "slack_schedule_message"
  | "slack_create_canvas"
  | "slack_search_public"
  | "slack_search_public_and_private"
  | "slack_search_channels"
  | "slack_search_users"
  | "slack_read_channel"
  | "slack_read_thread"
  | "slack_read_user_profile";

export interface CreateSlackToolsOptions {
  /**
   * Controls which tools require human approval before execution.
   * - `true` — require approval for all tools
   * - `SlackToolName[]` — require approval only for the listed tools
   */
  needsApproval?: boolean | SlackToolName[];
}

function resolveApproval(
  toolName: SlackToolName,
  needsApproval?: boolean | SlackToolName[],
): boolean | undefined {
  if (needsApproval === undefined) return undefined;
  if (typeof needsApproval === "boolean") return needsApproval;
  return needsApproval.includes(toolName) ? true : undefined;
}

/**
 * Create all available Slack tools for the AI SDK.
 *
 * @param slackToken - A Slack user OAuth token (`xoxp-...`) with the required scopes.
 * @param options - Optional configuration (e.g. human-in-the-loop approval).
 * @returns An object of Slack tools ready to pass to `generateText`, `streamText`, or any AI SDK agent.
 *
 * @example
 * ```ts
 * import { createSlackTools } from "slack-tools";
 *
 * const tools = createSlackTools(process.env.SLACK_USER_TOKEN);
 *
 * const { text } = await generateText({
 *   model: "anthropic/claude-sonnet-4-5",
 *   tools,
 *   prompt: "Search for messages about the Q1 roadmap in #general",
 * });
 * ```
 */
export function createSlackTools(
  slackToken: string,
  options?: CreateSlackToolsOptions,
): Record<SlackToolName, Tool> {
  const client = new WebClient(slackToken);
  const approval = options?.needsApproval;

  return {
    slack_send_message: createSendMessageTool(
      client,
      resolveApproval("slack_send_message", approval),
    ),
    slack_schedule_message: createScheduleMessageTool(
      client,
      resolveApproval("slack_schedule_message", approval),
    ),
    slack_create_canvas: createCreateCanvasTool(
      client,
      resolveApproval("slack_create_canvas", approval),
    ),
    slack_search_public: createSearchPublicTool(
      client,
      resolveApproval("slack_search_public", approval),
    ),
    slack_search_public_and_private: createSearchPublicAndPrivateTool(
      client,
      resolveApproval("slack_search_public_and_private", approval),
    ),
    slack_search_channels: createSearchChannelsTool(
      client,
      resolveApproval("slack_search_channels", approval),
    ),
    slack_search_users: createSearchUsersTool(
      client,
      resolveApproval("slack_search_users", approval),
    ),
    slack_read_channel: createReadChannelTool(
      client,
      resolveApproval("slack_read_channel", approval),
    ),
    slack_read_thread: createReadThreadTool(
      client,
      resolveApproval("slack_read_thread", approval),
    ),
    slack_read_user_profile: createReadUserProfileTool(
      client,
      resolveApproval("slack_read_user_profile", approval),
    ),
  };
}
