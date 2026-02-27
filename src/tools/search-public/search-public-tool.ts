import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";
import { formatTimestamp, resolveUserName } from "../utils";

const searchPublicDescription =
  "Searches for messages, files in public Slack channels ONLY.\n\n`slack_search_public` does NOT generally require user consent for use, whereas you should request and wait for user consent to use `slack_search_public_and_private`.\n\n---\n`query` parameter should include a keyword search or a natural language question and any search modifiers.\n\nSearch modifiers:\n\nLocation filters:\n  in:channel-name     Search in specific channel (no # prefix)\n  in:<#C123456>       Search in channel by ID\n  -in:channel         Exclude channel\n  in:<@U123456>       In DMs with a user by ID\n  in:@<username>      In DMs with a user by username (as found in slack_read_user_profile tool)\n  with:<@U123456>     Search threads/DMs with user\n\nUser filters:\n  from:<@U123456>   Messages from user with ID U123456 - angle brackets are literal (e.g., from:<@U123456>)\n  from:username     Messages from user with Slack username (e.g., from:janedoe) (as found in slack_read_user_profile tool)\n  to:<@U123456>     Messages to user with ID U123456 - angle brackets are literal (e.g., to:<@U123456>)\n  to:me             Messages sent directly to you\n  creator:@user     Canvases created by user\n\nContent filters:\n  is:thread         Only threaded messages\n  is:saved          Your saved items\n  has:pin           Pinned messages\n  has:star          Your starred items\n  has:link          Messages with links\n  has:file          Messages with attachments\n  has::emoji:       Messages with specific reaction\n  hasmy::emoji:     Messages you reacted to\n\nDate filters:\n  before:YYYY-MM-DD   Before date\n  after:YYYY-MM-DD    After date\n  on:YYYY-MM-DD       On specific date\n  during:month        During month\n  during:year         During year\n";

const searchPublicInputSchema = z.object({
  query: z
    .string()
    .describe("Search query (e.g., 'bug report', 'from:<@Jane> in:dev')"),
  content_types: z
    .string()
    .optional()
    .describe("Comma-separated content types: messages, files"),
  context_channel_id: z
    .string()
    .optional()
    .describe("Context channel ID to boost search results for a channel"),
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
  after: z
    .string()
    .optional()
    .describe("Only messages after this Unix timestamp (inclusive)"),
  before: z
    .string()
    .optional()
    .describe("Only messages before this Unix timestamp (inclusive)"),
  include_bots: z
    .boolean()
    .optional()
    .describe("Include bot messages (default: false)"),
  sort: z
    .string()
    .optional()
    .describe(
      "Sort by relevance or date (default: 'score'). Options: 'score', 'timestamp'",
    ),
  sort_dir: z
    .string()
    .optional()
    .describe("Sort direction (default: 'desc'). Options: 'asc', 'desc'"),
  response_format: z
    .string()
    .optional()
    .describe(
      "Level of detail (default: 'detailed'). Options: 'detailed', 'concise'",
    ),
});

const contextMessageSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  ts: z.string(),
  text: z.string(),
});

const searchMessageSchema = z.object({
  channel_id: z.string(),
  channel_name: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  ts: z.string(),
  time_formatted: z.string(),
  text: z.string(),
  permalink: z.string(),
  reply_count: z.number(),
  context_before: z.array(contextMessageSchema),
  context_after: z.array(contextMessageSchema),
});

const searchPublicOutputSchema = z.object({
  query: z.string(),
  messages: z.array(searchMessageSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function createSearchPublicTool(client: WebClient) {
  return tool({
    description: searchPublicDescription,
    inputSchema: searchPublicInputSchema,
    outputSchema: searchPublicOutputSchema,
    execute: async (args) => {
      const result = await client.search.messages({
        query: args.query,
        sort: args.sort as "score" | "timestamp" | undefined,
        sort_dir: args.sort_dir as "asc" | "desc" | undefined,
        count: args.limit,
        cursor: args.cursor,
      });

      const matches = result.messages?.matches ?? [];

      type ContextMsg = {
        user?: string;
        username?: string;
        text?: string;
        ts?: string;
      };
      function extractContext(...sources: (unknown | undefined)[]) {
        return (sources.filter(Boolean) as ContextMsg[]).map((c) => ({
          user_id: c.user ?? "",
          user_name: c.username ?? "",
          ts: c.ts ?? "",
          text: c.text ?? "",
        }));
      }

      const messages = await Promise.all(
        matches.map(async (m) => {
          const channel = m.channel as
            | { id?: string; name?: string }
            | undefined;
          const raw = m as Record<string, unknown>;
          const userName = m.user
            ? await resolveUserName(client, m.user)
            : (m.username ?? "");
          return {
            channel_id: channel?.id ?? "",
            channel_name: channel?.name ?? "",
            user_id: m.user ?? "",
            user_name: userName,
            ts: m.ts ?? "",
            time_formatted: m.ts ? formatTimestamp(m.ts) : "",
            text: m.text ?? "",
            permalink: m.permalink ?? "",
            reply_count: (raw.reply_count as number) ?? 0,
            context_before: extractContext(raw.previous_2, raw.previous),
            context_after: extractContext(raw.next, raw.next_2),
          };
        }),
      );

      const pagination = result.messages?.pagination as
        | { next_cursor?: string }
        | undefined;
      const nextCursor = pagination?.next_cursor || undefined;

      return {
        query: args.query,
        messages,
        has_more: !!nextCursor,
        next_cursor: nextCursor,
      };
    },
    toModelOutput: ({ output }) => {
      let resultsText: string;
      if (output.messages.length === 0) {
        resultsText = `# Search Results for: ${output.query}\n\nNo messages found.\n`;
      } else {
        const msgBlocks = output.messages
          .map((m, i) => {
            const lines = [
              `### Result ${i + 1} of ${output.messages.length}`,
              `Channel: #${m.channel_name} (ID: ${m.channel_id})`,
              `From: ${m.user_name} (ID: ${m.user_id}) `,
              `Time: ${m.time_formatted}`,
              `Message_ts: ${m.ts}`,
            ];
            if (m.reply_count > 0) lines.push(`Reply count: ${m.reply_count}`);
            lines.push(`Permalink: [link](${m.permalink})`);
            lines.push(`Text: \n${m.text}`);
            if (m.context_before.length > 0) {
              const ctx = m.context_before
                .map(
                  (c) =>
                    `- From: ${c.user_name} (ID: ${c.user_id}) \n  Message_ts: ${c.ts}\n  ${c.text}`,
                )
                .join("\n");
              lines.push(`Context before: \n${ctx}`);
            }
            if (m.context_after.length > 0) {
              const ctx = m.context_after
                .map(
                  (c) =>
                    `- From: ${c.user_name} (ID: ${c.user_id}) \n  Message_ts: ${c.ts}\n  ${c.text}`,
                )
                .join("\n");
              lines.push(`Context after: \n${ctx}`);
            }
            return lines.join("\n");
          })
          .join("\n\n---\n\n");
        resultsText = `# Search Results for: ${output.query}\n\n## Messages (${output.messages.length} results)\n${msgBlocks}\n\n---\n\n`;
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
