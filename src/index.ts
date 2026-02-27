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

export function createSlackTools(slackToken: string) {
  const client = new WebClient(slackToken);

  return {
    slack_send_message: createSendMessageTool(client),
    slack_schedule_message: createScheduleMessageTool(client),
    slack_create_canvas: createCreateCanvasTool(client),
    slack_search_public: createSearchPublicTool(client),
    slack_search_public_and_private: createSearchPublicAndPrivateTool(client),
    slack_search_channels: createSearchChannelsTool(client),
    slack_search_users: createSearchUsersTool(client),
    slack_read_channel: createReadChannelTool(client),
    slack_read_thread: createReadThreadTool(client),
    slack_read_user_profile: createReadUserProfileTool(client),
  };
}
