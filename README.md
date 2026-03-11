# slack-tools

[![npm version](https://img.shields.io/npm/v/slack-tools)](https://www.npmjs.com/package/slack-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[AI SDK](https://ai-sdk.dev) tools for [Slack](https://api.slack.com). Typed, structured tool calls for AI agents. No MCP transport required.

## Installation

```shell
npm install slack-tools
# or
yarn add slack-tools
# or
pnpm add slack-tools
# or
bun add slack-tools
```

## Quick Start

```ts
import { generateText } from "ai";
import { createSlackTools } from "slack-tools";

const tools = createSlackTools(process.env.SLACK_USER_TOKEN);

const { text } = await generateText({
  model: "anthropic/claude-sonnet-4-5",
  tools,
  prompt: "Search for messages about the Q1 roadmap in #general",
});
```

The model string uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), which provides access to OpenAI, Anthropic, Google, and other providers through a single API.

## API Reference

### createSlackTools

Returns all available Slack tools, ready to pass to `generateText`, `streamText`, or any AI SDK agent.

```ts
import { createSlackTools } from "slack-tools";

const tools = createSlackTools(process.env.SLACK_USER_TOKEN);
```

#### Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `slackToken` | `string` | Yes | A Slack user OAuth token (`xoxp-...`) with the required scopes. |
| `options` | `CreateSlackToolsOptions` | No | Configuration options (see below). |

#### Options

| Name | Type | Default | Description |
|---|---|---|---|
| `needsApproval` | `boolean \| SlackToolName[]` | `undefined` | Controls which tools require human approval before execution. Pass `true` to require approval for all tools, or an array of tool names for selective approval. |

```ts
// Require approval for all tools
const tools = createSlackTools(process.env.SLACK_USER_TOKEN, {
  needsApproval: true,
});

// Require approval only for write operations
const tools = createSlackTools(process.env.SLACK_USER_TOKEN, {
  needsApproval: [
    "slack_send_message",
    "slack_schedule_message",
    "slack_create_canvas",
    "slack_join_channel",
    "slack_delete_message",
  ],
});
```

#### Returns

An object containing the following tools:

| Tool | Description |
|---|---|
| `slack_send_message` | Send a message to a channel or user. |
| `slack_schedule_message` | Schedule a message for future delivery. |
| `slack_create_canvas` | Create a new Slack Canvas document. |
| `slack_search_public` | Search messages in public channels. |
| `slack_search_public_and_private` | Search messages across all channels (public, private, DMs). |
| `slack_search_channels` | Find channels by name, topic, or purpose. |
| `slack_search_users` | Find users by name, email, or title. |
| `slack_read_channel` | Read message history from a channel. |
| `slack_read_thread` | Read a thread (parent message and replies). |
| `slack_read_user_profile` | Get detailed profile information for a user. |
| `slack_join_channel` | Join a public channel on behalf of the bot/agent. |
| `slack_delete_message` | Delete a message previously sent by the bot/agent. |

Each tool includes `inputSchema`, `outputSchema`, `execute`, and `toModelOutput`.

## Required Scopes

Your Slack app needs the following user token scopes:

`chat:write`, `canvases:read`, `canvases:write`, `channels:history`, `channels:join`, `groups:history`, `im:history`, `mpim:history`, `search:read.public`, `search:read.private`, `search:read.mpim`, `search:read.im`, `search:read.files`, `search:read.users`, `users:read`, `users:read.email`

## Comparison with Slack MCP

This package was built by running each tool against the [Slack MCP server](https://api.slack.com/docs/mcp) and comparing responses side-by-side. The goal was to match the MCP's behavior as closely as the public Slack API allows.

| Tool | slack-tools | Slack MCP | Notes |
|---|---|---|---|
| Send message | ✅ | ✅ | Equivalent output |
| Schedule message | ✅ | ✅ | Equivalent output |
| Create canvas | ✅ | ✅ | Equivalent output |
| Search public messages | ✅ | ✅ | MCP includes message context and reply counts via internal APIs |
| Search all messages | ✅ | ✅ | Same as above |
| Search channels | ✅ | ✅ | MCP includes channel permalinks |
| Search users | ✅ | ✅ | Equivalent output including profile permalinks |
| Read channel | ✅ | ✅ | Equivalent output |
| Read thread | ✅ | ✅ | Equivalent output |
| Read user profile | ✅ | ✅ | Equivalent output |
| Join channel | ✅ | ❌ | Not available in Slack MCP |
| Delete message | ✅ | ❌ | Not available in Slack MCP |
| Read canvas | ❌ | ✅ | Slack's public API does not support reading canvas content |
| Send message draft | ❌ | ✅ | `chat.draft` is not available in the public Slack Web API |

The MCP returns all results as stringified text inside `content[0].text`. This package returns typed objects from `execute` and provides `toModelOutput` for model-friendly text formatting, making it easy to programmatically compose follow-up actions from tool results.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:

- Check the [AI SDK documentation](https://ai-sdk.dev)
- Review the [Slack Web API documentation](https://api.slack.com/web)
- [Open an issue](https://github.com/malewis5/slack-tools/issues) in this repository

## License

[MIT](./LICENSE)
