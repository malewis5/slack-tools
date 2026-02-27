import { tool } from "ai";
import { z } from "zod";
import { type WebClient } from "@slack/web-api";

const searchUsersDescription =
  "Use this tool to find Slack users by name, email, or profile attributes when you need to identify specific people or get their user IDs for other operations.\n\n## When to Use\n- User asks to find someone by name (e.g., \"find John Smith\")\n- User wants to see who works in a specific department or role\n- You need a user ID for another operation but only have name/email information\n- User asks \"who are the engineers?\" or \"find people in marketing\"\n- Before mentioning users in messages when you need proper user IDs\n\n## When NOT to Use\n- When you already have a specific user ID (use `slack_read_user_profile` or target tool directly)\n- Searching for messages from users (use `slack_search_public` with from: filter)\n- User wants detailed profile information for a known user (use `slack_read_user_profile`)\n";

const searchUsersInputSchema = z.object({
  query: z
    .string()
    .describe(
      "Search query for finding users. Accepts names, email address, and other attributes in profile",
    ),
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
  response_format: z
    .string()
    .optional()
    .describe(
      "Level of detail (default: 'detailed'). Options: 'detailed', 'concise'",
    ),
});

const userResultSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  title: z.string(),
  email: z.string(),
  timezone: z.string(),
  profile_pic: z.string(),
  permalink: z.string(),
});

const searchUsersOutputSchema = z.object({
  query: z.string(),
  users: z.array(userResultSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});

export function createSearchUsersTool(
  client: WebClient,
  needsApproval?: boolean,
) {
  return tool({
    description: searchUsersDescription,
    inputSchema: searchUsersInputSchema,
    outputSchema: searchUsersOutputSchema,
    needsApproval,
    execute: async (args) => {
      const [listResult, authResult] = await Promise.all([
        client.users.list({ limit: args.limit ?? 20, cursor: args.cursor }),
        client.auth.test(),
      ]);

      const teamDomain = (authResult as { url?: string }).url?.replace(/\/$/, "") ?? "";

      const members = listResult.members ?? [];
      const query = args.query.toLowerCase();
      const matched = members.filter((m) => {
        if (m.deleted || m.is_bot) return false;
        const name = (m.real_name ?? "").toLowerCase();
        const username = (m.name ?? "").toLowerCase();
        const email = (m.profile?.email ?? "").toLowerCase();
        const title = (m.profile?.title ?? "").toLowerCase();
        return (
          name.includes(query) ||
          username.includes(query) ||
          email.includes(query) ||
          title.includes(query)
        );
      });

      const users = matched.map((m) => ({
        user_id: m.id ?? "",
        name: m.real_name ?? "",
        title: m.profile?.title ?? "",
        email: m.profile?.email ?? "",
        timezone: m.tz ?? "",
        profile_pic: m.profile?.image_512 ?? "",
        permalink: m.id ? `${teamDomain}/team/${m.id}` : "",
      }));

      const nextCursor = listResult.response_metadata?.next_cursor || undefined;

      return {
        query: args.query,
        users,
        has_more: !!nextCursor,
        next_cursor: nextCursor,
      };
    },
    toModelOutput: ({ output }) => {
      let resultsText: string;
      if (output.users.length === 0) {
        resultsText = `# Search Results for: ${output.query}\n\nNo users found.\n`;
      } else {
        const userBlocks = output.users
          .map((u, i) => {
            const lines = [
              `### Result ${i + 1} of ${output.users.length}`,
              `Name: ${u.name}`,
              `User ID: ${u.user_id}`,
              `Title: ${u.title}`,
              `Email: ${u.email}`,
              `Timezone: ${u.timezone}`,
            ];
            if (u.permalink) lines.push(`Profile: [View Profile](${u.permalink})`);
            if (u.profile_pic) lines.push(`Profile Pic: [Photo](${u.profile_pic})`);
            return lines.join("\n");
          })
          .join("\n\n---\n\n");
        resultsText = `# Search Results for: ${output.query}\n\n## Users (${output.users.length} results)\n${userBlocks}\n\n---\n\n`;
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
